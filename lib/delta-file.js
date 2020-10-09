import fs from 'fs-extra';
import fetch from 'node-fetch';
import { sparqlEscapeString, sparqlEscapeUri } from 'mu';
import { querySudo as query, updateSudo as update } from '@lblod/mu-auth-sudo';
import { syncDocuments } from './document';
import {
  MU_APPLICATION_GRAPH,
  SYNC_BASE_URL,
  SYNC_FILES_ENDPOINT,
  DOWNLOAD_FILE_ENDPOINT,
  BATCH_SIZE
} from '../config';

class DeltaFile {
  constructor(data) {
    this.id = data.id;
    this.created = data.attributes.created;
    this.name = data.attributes.name;
  }

  get downloadUrl() {
    return DOWNLOAD_FILE_ENDPOINT.replace(':id', this.id);
  }

  get tmpFilepath() {
    return `/tmp/${this.id}.json`;
  }

  async consume(onFinishCallback) {
    const writeStream = fs.createWriteStream(this.tmpFilepath);
    writeStream.on('finish', () => this.ingest(onFinishCallback));

    try {
      const result = await fetch(this.downloadUrl);
      if (result.ok) {
        result.body
          .on('error', function(err) {
            console.log(`Something went wrong while downloading file from ${this.downloadUrl}`);
            console.log(err);
            onFinishCallback(this, false);
          })
          .pipe(writeStream);
      } else {
        throw new Error(`Request to download file returned status code ${result.status}`);
      }
    } catch (e) {
      console.log(`Something went wrong while consuming the file ${this.id}`);
      await onFinishCallback(this, false);
    }
  }

  async ingest(onFinishCallback) {
    console.log(`Start ingesting file ${this.id} stored at ${this.tmpFilepath}`);
    const delay = ms => new Promise(res => setTimeout(res, ms)); // helper function
    try {
      const changeSets = await fs.readJson(this.tmpFilepath, { encoding: 'utf-8' });
      for (let { inserts, deletes } of changeSets) {
        const sessions = getSessionsToIngest(inserts);
        for (let session of sessions) {
          console.log(`Session <${session}> will be ingested. Remove all previously ingested data about the session first.`);
          await deleteSession(session);
        }
        await delay(5000); //  TODO remove workaround to wait 5s so mu-search has time to process the delete-session query
        await insertTriples(inserts);
        await deleteTriples(deletes);
        await syncDocuments(inserts);
      }
      console.log(`Successfully finished ingesting file ${this.id} stored at ${this.tmpFilepath}`);
      await onFinishCallback(this, true);
      await fs.unlink(this.tmpFilepath);
    } catch (e) {
      console.log(`Something went wrong while ingesting file ${this.id} stored at ${this.tmpFilepath}`);
      console.log(e);
      await onFinishCallback(this, false);
    }
  }
}

async function getUnconsumedFiles(since) {
  try {
    const url = `${SYNC_FILES_ENDPOINT}?since=${since.toISOString()}`;
    const result = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/vnd.api+json'
      },
    });

    if (result.ok) {
      const jsonResult = await result.json();
      return jsonResult.data.map(f => new DeltaFile(f));
    } else {
      throw new Error(`Request to fetch unconsumed files returned status code ${result.status}`);
    }
  } catch (e) {
    console.log(`Unable to retrieve unconsumed files from ${SYNC_FILES_ENDPOINT}`);
    throw e;
  }
}

function getSessionsToIngest(inserts) {
  const sessionTriples = inserts.filter(t => {
    return t.predicate.value === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type'
      && t.object.value === 'http://data.vlaanderen.be/ns/besluit#Zitting';
  });
  return sessionTriples.map(t => t.subject.value);
}

async function deleteSession(session) {
  const result = await query(`
    PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
    SELECT DISTINCT ?newsItem
    WHERE {
      GRAPH <${MU_APPLICATION_GRAPH}> {
         <${session}> ext:publishedNieuwsbriefInfo ?newsItem .
      }
    }
  `);
  const newsItems = result.results.bindings.map(b => b['newsItem'].value);

  for (let newsItem of newsItems) {
    await update(`
      PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
      PREFIX nie: <http://www.semanticdesktop.org/ontologies/2007/01/19/nie#>
      PREFIX besluitvorming: <http://data.vlaanderen.be/ns/besluitvorming#>
      DELETE {
        GRAPH <${MU_APPLICATION_GRAPH}> {
          <${newsItem}> ext:documentVersie ?documentVersion .
          ?documentVersion ext:file ?logicalFile .
          ?series besluitvorming:heeftVersie ?documentVersion .
          ?physicalFile nie:dataSource ?logicalFile .

          ?documentVersion ?documentVersionP ?documentVersionO .
          ?series ?seriesP ?seriesO .
          ?logicalFile ?logicalFileP ?logicalFileO .
          ?physicalFile ?physicalFileP ?physicalFileO .
        }
      } WHERE {
        GRAPH <${MU_APPLICATION_GRAPH}> {
          <${newsItem}> ext:documentVersie ?documentVersion .
          FILTER NOT EXISTS {
            ?newsItem2 ext:documentVersie ?documentVersion .
          }
          FILTER ( ?newsItem2 != <${newsItem}> )

          ?documentVersion ext:file ?logicalFile .
          ?series besluitvorming:heeftVersie ?documentVersion .
          ?physicalFile nie:dataSource ?logicalFile .

          ?documentVersion ?documentVersionP ?documentVersionO .
          ?series ?seriesP ?seriesO .
          ?logicalFile ?logicalFileP ?logicalFileO .
          ?physicalFile ?physicalFileP ?physicalFileO .
        }
      }
    `);

    await update(`
      DELETE WHERE {
        GRAPH <${MU_APPLICATION_GRAPH}> {
          ?procedurestap <http://www.w3.org/ns/prov#generated> <${newsItem}> ; ?p ?o .
        }
      }
    `);

    await update(`
      DELETE WHERE {
        GRAPH <${MU_APPLICATION_GRAPH}> {
          <${newsItem}> ?p ?o .
        }
      }
    `);
  }

  await update(`
      DELETE WHERE {
        GRAPH <${MU_APPLICATION_GRAPH}> {
          <${session}> ?p ?o .
        }
      }

      ;

      DELETE WHERE {
        GRAPH <${MU_APPLICATION_GRAPH}> {
          ?s ?p <${session}> .
        }
      }
  `);
}

async function insertTriples(triples) {
  for (let i = 0; i < triples.length; i += BATCH_SIZE) {
    console.log(`Inserting triples in batch: ${i}-${i + BATCH_SIZE}`);
    const batch = triples.slice(i, i + BATCH_SIZE);
    const statements = toStatements(batch);
    await update(`
      INSERT DATA {
          GRAPH <${MU_APPLICATION_GRAPH}> {
              ${statements}
          }
      }
    `);
  }
}

async function deleteTriples(triples) {
  for (let i = 0; i < triples.length; i += BATCH_SIZE) {
    console.log(`Deleting triples in batch: ${i}-${i + BATCH_SIZE}`);
    const batch = triples.slice(i, i + BATCH_SIZE);
    const statements = toStatements(batch);
    await update(`
      DELETE DATA {
          GRAPH <${MU_APPLICATION_GRAPH}> {
              ${statements}
          }
      }
    `);
  }
}

function toStatements(triples) {
  const escape = function(rdfTerm) {
    const { type, value, datatype, "xml:lang":lang } = rdfTerm;
    if (type == "uri") {
      return sparqlEscapeUri(value);
    } else if (type == "literal" || type == "typed-literal") {
      // We ignore xsd:string datatypes because Virtuoso doesn't treat those as default datatype
      // Eg. SELECT * WHERE { ?s mu:uuid "4983948" } will not return any value if the uuid is a typed literal
      // Since the n3 npm library used by the producer explicitely adds xsd:string on non-typed literals
      // we ignore the xsd:string on ingest
      if (datatype && datatype != 'http://www.w3.org/2001/XMLSchema#string')
        return `${sparqlEscapeString(value)}^^${sparqlEscapeUri(datatype)}`;
      else if (lang)
        return `${sparqlEscapeString(value)}@${lang}`;
      else
        return `${sparqlEscapeString(value)}`;
    } else
      console.log(`Don't know how to escape type ${type}. Will escape as a string.`);
      return sparqlEscapeString(value);
  };
  return triples.map(function(t) {
    const subject = escape(t.subject);
    const predicate = escape(t.predicate);
    const object = escape(t.object);
    return `${subject} ${predicate} ${object} . `;
  }).join('');
}

export {
  getUnconsumedFiles
}
