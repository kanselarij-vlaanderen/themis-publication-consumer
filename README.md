# themis-publication-consumer

Consumer service to sync Themis publications from external sources based on delta files provided by [themis-publication-producer](http://github.com/kanselarij-vlaanderen/themis-publication-producer). At regular intervals the consumer checks for new publication files and ingests the data found in the files. If the publications include documents, the documents are synced as well. All data is ingested in the same graph.

## Tutorials
### Add the service to a stack
Add the service to your `docker-compose.yml`:

```
  publication-consumer:
    image: kanselarij/themis-publication-consumer
    environment:
      SYNC_BASE_URL: 'https://publications.kaleidos.vlaanderen.be' # replace with the publications URL
    volume:
      - ./data/files:/share
```

Change the `SYNC_BASE_URL` to the application hosting the producer server.

The mounted volume `./data/files` is the location where the documents that are downloaded from Kaleidos, will be stored.

Optionally, a volume can be mounted at `/tmp`. The files downloaded from the producer service are stored in this folder. However, on successfull ingest the file will be removed.

## Reference
### Configuration
The following environment variables are required:
* `SYNC_BASE_URL`: base URL of the stack hosting the producer API (e.g. https://publications.kaleidos.vlaanderen.be)

The following environment variables are optional:
* `SYNC_FILES_PATH (default: /publications)`: relative path to the endpoint to retrieve publications files from
* `DOWNLOAD_FILES_PATH (default: /files/:id/download)`: relative path to the endpoint to download publication files from. `:id` will be replaced with the uuid of the file.
* `DOWNLOAD_DOCUMENT_PATH (default: /kaleidos-files/:id/download)`: relative path to the endpoint to download public Kaleidos documents from. `:id` will be replaced with the uuid of the file.
* `MU_APPLICATION_GRAPH (default: http://mu.semte.ch/graphs/publication-tasks)`: target graph in which all data regarding tasks is stored
* `MU_TMP_BASE_GRAPH_URI (default: http://mu.semte.ch/graphs/import/)`: base URI for the temporary graph in which data will be ingested. The base URI is appended with a timestamp.
* `INGEST_INTERVAL (in ms, default: -1)`: interval at which the consumer needs to sync data automatically. If negative, sync can only be triggered manually via the API endpoint.
* `START_FROM_DELTA_TIMESTAMP (ISO datetime, default: now)`: timestamp to start sync data from (e.g. "2020-07-05T13:57:36.344Z")
* `BATCH_SIZE (default: 100)`: amount of triples to insert/delete in one SPARQL query
* `PING_DB_INTERVAL (in seconds, default: 2)`: interval to check whether the database is up on startup

### Model
#### Used prefixes
| Prefix | URI                                                       |
|--------|-----------------------------------------------------------|
| dct    | http://purl.org/dc/terms/                                 |
| adms   | http://www.w3.org/ns/adms#                                |
| ext    | http://mu.semte.ch/vocabularies/ext                       |

#### Sync task
##### Class
`ext:SyncTask`
##### Properties
| Name       | Predicate        | Range           | Definition                                                                                                                                       |
|------------|------------------|-----------------|--------------------------------------------------------------------------------------------------------------------------------------------------|
| status     | `adms:status`    | `rdfs:Resource` | Status of the sync task, initially set to `<http://kanselarij.vo.data.gift/services/themis-publication-consumer/sync-task-statuses/not-started>` |
| created    | `dct:created`    | `xsd:dateTime`  | Datetime of creation of the task                                                                                                                 |
| deltaUntil | `ext:deltaUntil` | `xsd:dateTime`  | Datetime of the latest successfully ingested sync file as part of the task execution                                                             |

#### Sync task statuses
The status of the sync task will be updated to reflect the progress of the task. The following statuses are known:
* http://kanselarij.vo.data.gift/services/themis-publication-consumer/sync-task-statuses/not-started
* http://kanselarij.vo.data.gift/services/themis-publication-consumer/sync-task-statuses/ongoing
* http://kanselarij.vo.data.gift/services/themis-publication-consumer/sync-task-statuses/success
* http://kanselarij.vo.data.gift/services/themis-publication-consumer/sync-task-statuses/failed

#### Release task
##### Class
`ext:ReleaseTask`
##### Properties
| Name    | Predicate     | Range           | Definition                                                                                                        |
|---------|---------------|-----------------|-------------------------------------------------------------------------------------------------------------------|
| status  | `adms:status` | `rdfs:Resource` | Status of the release task, initially set to `<http://kanselarij.vo.data.gift/release-task-statuses/not-started>` |
| created | `dct:created` | `xsd:dateTime`  | Datetime of creation of the task                                                                                  |
| source  | `dct:source`  | `rdfs:Resource` | URI of the graph containing the data to be released                                                               |


### Data flow
At regular intervals, the service will schedule a sync task. Execution of a task consists of the following steps:

1. Retrieve the timestamp to start the sync from
1. Query the producer service for all publication files since that specific timestamp
2. Download the content of each publication file
3. Ingest each publication file in the `MU_APPLICATION_GRAPH`

If one file fails to be ingested, the remaining files in the queue are blocked since the files must always be handled in order.

All triples of a file are stored in a temporary import graph. On successfull ingest of a file, a new `ext:ReleaseTask` is scheduled with status `not-started` to trigger the release of the dataset.

If a publication file contains a triple like `?doc a <http://www.semanticdesktop.org/ontologies/2007/03/22/nfo#FileDataObject>`, the document (PDF, zip, ...) is downloaded from the Kaleidos server and stored in `/share`. If the download of the document fails, the sync flow will NOT be blocked.

The service makes 2 core assumptions that must be respected at all times:
1. At any moment we know that the latest `ext:deltaUntil` timestamp on a task, either in failed/ongoing/success state, reflects the timestamp of the latest delta file that has been completly and successfully consumed
2. Maximum 1 sync task is running at any moment in time

### API
```
POST /ingest
```

Schedule and execute a sync task. A successfully completed sync task will result in a new release task.

The endpoint is triggered internally at frequent intervals and should normally not be triggered by an external party.
