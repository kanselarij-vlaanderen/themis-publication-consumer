const INGEST_INTERVAL = process.env.INGEST_INTERVAL || -1;
const SYNC_BASE_URL = process.env.SYNC_BASE_URL || 'https://valvas-publications.vlaanderen.be';
const SYNC_FILES_PATH = process.env.SYNC_FILES_PATH || '/publications';
const SYNC_FILES_ENDPOINT = `${SYNC_BASE_URL}${SYNC_FILES_PATH}`;
const DOWNLOAD_FILE_PATH = process.env.DOWNLOAD_FILE_PATH || '/files/:id/download';
const DOWNLOAD_FILE_ENDPOINT = `${SYNC_BASE_URL}${DOWNLOAD_FILE_PATH}`;
const DOWNLOAD_DOCUMENT_PATH = process.env.DOWNLOAD_DOCUMENT_PATH || '/kaleidos-files/:id/download';
const DOWNLOAD_DOCUMENT_ENDPOINT = `${SYNC_BASE_URL}${DOWNLOAD_DOCUMENT_PATH}`;
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE) || 100;
const EMAIL_FROM_ADDRESS = process.env.EMAIL_FROM_ADDRESS ?? 'noreply@kaleidos.vlaanderen.be';
const EMAIL_TO_ADDRESS_ON_FAILURE = process.env.EMAIL_TO_ADDRESS_ON_FAILURE ?? '';

// constants
const MU_APPLICATION_GRAPH = 'http://mu.semte.ch/graphs/publication-tasks';
const MU_TMP_BASE_GRAPH_URI = 'http://mu.semte.ch/graphs/import/';
const RELEASE_TASK_NOT_STARTED_STATUS = 'http://kanselarij.vo.data.gift/release-task-statuses/not-started';
const RESOURCE_BASE_URI  = 'http://themis.vlaanderen.be';
const EMAIL_GRAPH_URI = "http://mu.semte.ch/graphs/system/email";
const EMAIL_OUTBOX_URI = "http://themis.vlaanderen.be/id/mail-folders/d9a415a4-b5e5-41d0-80ee-3f85d69e318c"

export {
  INGEST_INTERVAL,
  SYNC_BASE_URL,
  SYNC_FILES_ENDPOINT,
  DOWNLOAD_FILE_ENDPOINT,
  DOWNLOAD_DOCUMENT_ENDPOINT,
  MU_APPLICATION_GRAPH,
  MU_TMP_BASE_GRAPH_URI,
  BATCH_SIZE,
  EMAIL_FROM_ADDRESS,
  EMAIL_TO_ADDRESS_ON_FAILURE,
  RELEASE_TASK_NOT_STARTED_STATUS,
  RESOURCE_BASE_URI,
  EMAIL_GRAPH_URI,
  EMAIL_OUTBOX_URI
}
