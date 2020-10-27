const INGEST_INTERVAL = process.env.INGEST_INTERVAL || -1;
const SYNC_BASE_URL = process.env.SYNC_BASE_URL || 'https://valvas-publications.vlaanderen.be';
const SYNC_FILES_PATH = process.env.SYNC_FILES_PATH || '/publications';
const SYNC_FILES_ENDPOINT = `${SYNC_BASE_URL}${SYNC_FILES_PATH}`;
const DOWNLOAD_FILE_PATH = process.env.DOWNLOAD_FILE_PATH || '/files/:id/download';
const DOWNLOAD_FILE_ENDPOINT = `${SYNC_BASE_URL}${DOWNLOAD_FILE_PATH}`;
const DOWNLOAD_DOCUMENT_PATH = process.env.DOWNLOAD_DOCUMENT_PATH || '/kaleidos-files/:id/download';
const DOWNLOAD_DOCUMENT_ENDPOINT = `${SYNC_BASE_URL}${DOWNLOAD_DOCUMENT_PATH}`;
const MU_APPLICATION_GRAPH = 'http://mu.semte.ch/graphs/publication-tasks';
const MU_TMP_BASE_GRAPH_URI = 'http://mu.semte.ch/graphs/import/';
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE) || 100;

export {
  INGEST_INTERVAL,
  SYNC_BASE_URL,
  SYNC_FILES_ENDPOINT,
  DOWNLOAD_FILE_ENDPOINT,
  DOWNLOAD_DOCUMENT_ENDPOINT,
  MU_APPLICATION_GRAPH,
  MU_TMP_BASE_GRAPH_URI,
  BATCH_SIZE
}
