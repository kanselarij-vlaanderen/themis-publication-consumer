# valvas-publication-consumer

This service queries an endpoint given by the environment variables, retrieves a list of delta files, downloads them and adds the information that they contain to the database

This service can be customized with the following environment variables:

| Variable | Description |
|---|---|
| INGEST_INTERVAL | How long is the interval in ms till the service queries the endpoint again |
| SYNC_BASE_URL | The base url for the syncs |
| SYNC_FILES_PATH | The path for getting the list of ttl files |
| DOWNLOAD_FILE_PATH | The path for downloading the files the path should have ':id' in it, that will be replaced by the id of the file |

