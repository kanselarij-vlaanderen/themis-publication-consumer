import { app, errorHandler, uuid, sparqlEscapeUri, sparqlEscapeDateTime, sparqlEscapeString, sparqlEscapeInt } from 'mu';
import bodyParser from 'body-parser';
import {INGEST_INTERVAL, SYNC_FILES_ENDPOINT, DOWNLOAD_FILE_ENDPOINT} from './config'
import fetch from 'node-fetch'
import { querySudo as query, updateSudo as update } from '@lblod/mu-auth-sudo';
import fs from 'fs'
import path from 'path'

const serviceUri = 'http://redpencil.data.gift/services/valvas-publication-consumer';

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));

// parse application/json
app.use(bodyParser.json());

function triggerIngest() {
  console.log(`Executing scheduled function at ${new Date().toISOString()}`);
  ingestFiles()
  setTimeout( triggerIngest, INGEST_INTERVAL );
}

triggerIngest()

async function ingestFiles() {
  const sinceQueryString = `
    PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
    select ?since where {
      ${sparqlEscapeUri(serviceUri)} ext:lastIngestion ?since
    }
  `

  const sinceQueryResult = await query(sinceQueryString)
  console.log(sinceQueryResult)
  let since = undefined
  if(sinceQueryResult.results.bindings[0]) {
    since = sinceQueryResult.results.bindings[0].since.value
  }
  since = new Date(since)
  console.log(since)
  const files = await getFilesFromEndpoint(since)
  const downloadedFiles = []
  for(let i = 0; i < files.length; i++) {
    const downloadedFile = await downloadFile(files[i])
    downloadedFiles.push(downloadedFile)
  }
  for(let j = 0; j<downloadedFiles.length; j++) {
    await processFile(downloadedFiles[j])
  }
  console.log('Finished processing times')
  await updateSinceTime()
}

async function getFilesFromEndpoint(since) {
  const syncResponse = await fetch(SYNC_FILES_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      since
    })
  })
  const syncJson = await syncResponse.json()
  return syncJson
}

async function updateSinceTime() {
  const since = new Date()
  await update(`
    PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
    DELETE WHERE 
    {
      GRAPH <http://mu.semte.ch/application> {
        ${sparqlEscapeUri(serviceUri)} ext:lastIngestion ?since.
      }
    }
  `);
  await update(`
    PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
    INSERT DATA {
      GRAPH <http://mu.semte.ch/application> {
        ${sparqlEscapeUri(serviceUri)} ext:lastIngestion ${sparqlEscapeDateTime(since)}.
      }
    }
  `);
}

async function downloadFile(fileUri) {
  const fileUuid = fileUri.split('/').pop()
  const downloadUrl = DOWNLOAD_FILE_ENDPOINT.replace(':id', fileUuid)
  const response = await fetch(downloadUrl, {
    method: 'GET'
  })
  if(response.status === 500) {
    const error = await response.text()
    throw error
  }
  const fileName = response.headers.get('content-disposition').replace('attachment; filename="', '').slice(0, -1)
  const fileContent = await response.text()
  fs.writeFileSync(path.join('/share/' , fileName), fileContent)
  await addFileToDB(path.join('/share/', fileName))
  return fileName
}

async function addFileToDB(filePath) {
  const fileStats = fs.statSync(filePath);
  const location = filePath.split('/').pop();
  const [fileName, fileExtension] = location.split('.');
  const fileInfo = {
    name: fileName,
    extension: fileExtension,
    format: 'application/json',
    created: new Date(fileStats.birthtime),
    size: fileStats.size,
    location: location
  };
  const logicalFileUuid = uuid();
  const logicalFileURI = `http://data.lblod.info/files/${logicalFileUuid}`;
  const physicalFileUuid = uuid();
  const physicalFileURI = `share://${fileInfo.location}`;
  const queryString = `
    PREFIX nfo: <http://www.semanticdesktop.org/ontologies/2007/03/22/nfo#>
    PREFIX dct: <http://purl.org/dc/terms/>
    PREFIX dbpedia: <http://dbpedia.org/ontology/>
    PREFIX nie: <http://www.semanticdesktop.org/ontologies/2007/01/19/nie#>
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>

    INSERT DATA {
      GRAPH <http://mu.semte.ch/graphs/public> {
        ${sparqlEscapeUri(logicalFileURI)} a nfo:FileDataObject;
          mu:uuid ${sparqlEscapeString(logicalFileUuid)};
          nfo:fileName ${sparqlEscapeString(fileInfo.name)};
          dct:format ${sparqlEscapeString(fileInfo.format)};
          nfo:fileSize ${sparqlEscapeInt(fileInfo.size)};
          dbpedia:fileExtension ${sparqlEscapeString(fileInfo.extension)};
          dct:created ${sparqlEscapeDateTime(fileInfo.created)};
          dct:creator ${sparqlEscapeUri(serviceUri)}.
        ${sparqlEscapeUri(physicalFileURI)} a nfo:FileDataObject;
          mu:uuid ${sparqlEscapeString(physicalFileUuid)};
          nfo:fileName ${sparqlEscapeString(fileInfo.name)};
          dct:format ${sparqlEscapeString(fileInfo.format)};
          nfo:fileSize ${sparqlEscapeInt(fileInfo.size)};
          dbpedia:fileExtension ${sparqlEscapeString(fileInfo.extension)};
          dct:created ${sparqlEscapeDateTime(fileInfo.created)};
          nie:dataSource ${sparqlEscapeUri(logicalFileURI)};
          dct:creator ${sparqlEscapeUri(serviceUri)}.
      }
    }
  `;
  await query(queryString);
  return logicalFileURI;
}

async function processFile(fileName) {
  console.log('------------')
  console.log(`Processing file ${fileName}`)
  const fileData = JSON.parse(fs.readFileSync(path.join('/share/', fileName), {encoding: 'utf8'}))
  const inserts = fileData.delta.inserts
  if(inserts.length > 0 && inserts.length < 10) {
    await insertData(inserts)
  } else if(inserts.length > 10) {
    for(let i = 0; i < inserts.length / 10; i++) {
      await insertData(inserts.slice(10*i, 10*(i+1)))
    }
  }
}

async function insertData(inserts) {
  const queryString = `
    INSERT DATA {
      GRAPH <http://mu.semte.ch/graphs/public> {
        ${inserts.map(processInsert).join('\n')}
      }
    }
  `
  await query(queryString)
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function processInsert({subject, predicate, object}) {
  return `${processTripleElement(subject)} ${processTripleElement(predicate)} ${processTripleElement(object)}.`
}

function processTripleElement(element) {
  if(element.type === 'uri') {
    return sparqlEscapeUri(element.value)
  }
  if(element.type === 'literal') {
    if(element.datatype === 'http://www.w3.org/2001/XMLSchema#string') {
      return sparqlEscapeString(element.value.replace('\t', ''))
    }
    if(element.datatype === 'http://www.w3.org/2001/XMLSchema#dateTime') {
      return sparqlEscapeDateTime(element.value)
    }
    if(element.datatype === 'http://www.w3.org/2001/XMLSchema#integer') {
      return sparqlEscapeInt(element.value)
    }
  }
  console.log('----------------------------------------------------------------------------------------------------')
  console.log('----------------------------------------------------------------------------------------------------')
  console.log('----------------------------------------------------------------------------------------------------')
  console.log('NOT FOUND NOT FOUND')
  console.log('----------------------------------------------------------------------------------------------------')
  console.log('----------------------------------------------------------------------------------------------------')
  console.log('----------------------------------------------------------------------------------------------------')
  console.log(element)
  console.log('----------------------------------------------------------------------------------------------------')
  console.log('----------------------------------------------------------------------------------------------------')
  console.log('----------------------------------------------------------------------------------------------------')
}

app.get('/test', async (req, res) => {
  res.send('Hello World');
});

app.use(errorHandler);
