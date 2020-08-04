const INGEST_INTERVAL = process.env.INGEST_INTERVAL || -1;
const SYNC_BASE_URL = process.env.SYNC_BASE_URL || 'https://valvas-publications.vlaanderen.be';
const SYNC_FILES_PATH = process.env.SYNC_FILES_PATH || '/publications';
const SYNC_FILES_ENDPOINT = `${SYNC_BASE_URL}${SYNC_FILES_PATH}`;
const DOWNLOAD_FILE_PATH = process.env.DOWNLOAD_FILE_PATH || '/files/:id/download';
const DOWNLOAD_FILE_ENDPOINT = `${SYNC_BASE_URL}${DOWNLOAD_FILE_PATH}`;
const DOWNLOAD_DOCUMENT_PATH = process.env.DOWNLOAD_DOCUMENT_PATH || '/kaleidos-files/:id/download';
const DOWNLOAD_DOCUMENT_ENDPOINT = `${SYNC_BASE_URL}${DOWNLOAD_DOCUMENT_PATH}`;
const MU_APPLICATION_GRAPH = 'http://mu.semte.ch/graphs/public';

export {
  INGEST_INTERVAL,
  SYNC_BASE_URL,
  SYNC_FILES_ENDPOINT,
  DOWNLOAD_FILE_ENDPOINT,
  DOWNLOAD_DOCUMENT_ENDPOINT,
  MU_APPLICATION_GRAPH
}
