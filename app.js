import { app, errorHandler } from 'mu';
import bodyParser from 'body-parser';
import { sparqlEscapeUri, sparqlEscapeDateTime, query } from 'mu';
import {INGEST_INTERVAL, SYNC_FILES_ENDPOINT} from './config'
import fetch from 'node-fetch'

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
  console.log(since)
  since = new Date(since)
  console.log(since)
  const files = await getFilesFromEndpoint(since)
  console.log(files)
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
  await query(`
    PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
    DELETE WHERE 
    {
      GRAPH <http://mu.semte.ch/graphs/public> {
        ${sparqlEscapeUri(serviceUri)} ext:lastIngestion ?since
      }
    }
  `);
  await query(`
    PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
    INSERT DATA {
      GRAPH <http://mu.semte.ch/graphs/public> {
        ${sparqlEscapeUri(serviceUri)} ext:lastIngestion ${sparqlEscapeDateTime(since)}
      }
    }
  `);
}


app.get('/test', async (req, res) => {
  res.send('Hello World');
});

app.use(errorHandler);
