import fs from 'fs-extra';
import fetch from 'node-fetch';
import { DOWNLOAD_DOCUMENT_ENDPOINT } from '../config';
import { querySudo as query } from '@lblod/mu-auth-sudo';

class Document {
  constructor({ id, locationUri }) {
    this.id = id;
    this.locationUri = locationUri;
  }

  get downloadUrl() {
    return DOWNLOAD_DOCUMENT_ENDPOINT.replace(':id', this.id);
  }

  get filepath() {
    return this.locationUri.replace('share://', '/share/');
  }

  async download() {
    const writeStream = fs.createWriteStream(this.filepath);

    try {
      const result = await fetch(this.downloadUrl);
      if (result.ok) {
        result.body
          .on('error', function(err) {
            console.log(`Something went wrong while handling response of downloading file from ${this.downloadUrl}`);
            console.log(err);
            throw new Error(`Something went wrong while handling response of downloading file from ${this.downloadUrl}`);
          })
          .pipe(writeStream);
      } else {
        throw new Error(`Request to download file returned status code ${result.status}`);
      }
    } catch (e) {
      console.log(`Something went wrong while downloading file from ${this.downloadUrl}`);
      console.log(e);
      throw new Error(`Something went wrong while downloading file from ${this.downloadUrl}`);
    }
  }
}

async function syncDocuments(inserts) {
  const documents = inserts.filter(t => {
    return t.predicate.value == 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type'
      && t.object.value == 'http://www.semanticdesktop.org/ontologies/2007/03/22/nfo#FileDataObject';
  }).map(t => t.subject.value);

  let downloadCount = 0;
  for (let document of documents) {
    const result = await query(`
      PREFIX nfo: <http://www.semanticdesktop.org/ontologies/2007/03/22/nfo#>
      PREFIX nie: <http://www.semanticdesktop.org/ontologies/2007/01/19/nie#>
      PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
      SELECT ?uuid ?file WHERE {
        <${document}> a nfo:FileDataObject ;
          mu:uuid ?uuid .
        ?file nie:dataSource <${document}>
      } LIMIT 1
    `);
    if (result.results.bindings.length) {
      const binding = result.results.bindings[0];
      const uuid = binding['uuid'].value;
      const locationUri = binding['file'].value;
      console.log(`Copying document <${locationUri}> from Kaleidos to Valvas`);
      await new Document({ id: uuid, locationUri }).download();
      downloadCount++;
    }
  }
  console.log(`Copied ${downloadCount} files from Kaleidos to Valvas`);
}

export { syncDocuments }
