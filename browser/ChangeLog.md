Note: This is the change log file for Azure Storage JavaScript Client Library.

2019.08 Version 3.0.100

* [Breaking] SharedKey based authentication and SAS generation will not be supported in browser bundles.

2019.04 Version 2.10.103

* Generated browser compatible JavaScript files based on Microsoft Azure Storage SDK for Node.js 2.10.3.
* Fixed callback not being called in _getBlobToLocalFile.
* Removed retryInfo.retryable check in retrypolicyfilter.js.
* Removed comment about maxResults.
* Fixed Travis-CI failed validation.
* Updated latest links and descriptions to V10 SDK in readme.md.

2018.10 Version 2.10.102

ALL
* Generated browser compatible JavaScript files based on Microsoft Azure Storage SDK for Node.js 2.10.2.
* Optimized browser samples and other documents.
* Added JSv10 link and docs.microsoft.com link.

FILE
* Fixed an issue that empty text isn’t supported in `createFileFromText`.

2018.08 Version 2.10.101

ALL
* Generated browser compatible JavaScript files based on Microsoft Azure Storage SDK for Node.js 2.10.1.
* Fixed a bug that content type value is incorrect for json.
* Fixed an issue that user agent is set in browser environment.

2018.06 Version 2.10.100

ALL
* Generated browser compatible JavaScript files based on Microsoft Azure Storage SDK for Node.js 2.10.0.
* Updated storage service version to 2018-03-28.

BLOB
* Fixed a bug that `DeleteRetentionPolicy.Days` should be `number` instead of `string` when calling `getServiceProperties`.
* Added a method `getAccountProperties` to `blobService`.
* Added a method `createBlockFromURL` to `blobService`.
* Added support for static website service properties (in preview).

2018.05 Version 2.9.100-preview

ALL
* Generated browser compatible JavaScript files based on Microsoft Azure Storage SDK for Node.js 2.9.0-preview.
* Updated storage service version to 2017-11-09.
* Added `/* eslint-disable */` to generated JS files to avoid eslint warnings when using with create-react-app.
* Added `progress` event for `SpeedSummary` class, which will be triggered when every progress updates.

BLOB
* Added `createBlobServiceWithTokenCredential()` to create `BlobService` object with bearer tokens such as OAuth access token (in preview).
* Added support for '$web' as a valid blob container name for static website.
* Added support for write-once read-many containers (in preview).
* The `Get Container Properties` and `List Containers` APIs now return two new properties indicating whether the container has an immutability policy or a legal hold.
* The `Get Blob Properties` and `List Blobs` APIs now return the creation time of the blob as a property.

QUEUE
* Added `createQueueServiceWithTokenCredential()` to create `QueueService` object with bearer tokens such as OAuth access token (in preview).

2018.04 Version 2.8.100

* Fixed a bug that retry policy will not retry for XHR error in browsers.
* Updated README.md under browser folder to make it more clear about the zip file downloading link.
* Updated github.io API reference title to include JavaScript.
* Updated local HTTP server requirements for IE11 and Chrome 56 in samples and documents.
* Added support for running UT/FT in browsers like Chrome based on Karma, with command `npm run jstest`.
* Generated browser compatible JavaScript files based on Microsoft Azure Storage SDK for Node.js 2.8.2.

2018.03 Version 0.2.8-preview.15

* Supported UMD module standard.
* Dropped `azure-storage.common.js`.
* Generated browser compatible JavaScript files based on Microsoft Azure Storage SDK for Node.js 2.8.1.

2018.02 Version 0.2.8-preview.14

* Generated browser compatible JavaScript files based on Microsoft Azure Storage SDK for Node.js 2.8.0.

2017.12 Version 0.2.7-preview.13

* Generated browser compatible JavaScript files based on Microsoft Azure Storage SDK for Node.js 2.7.0.

2017.10 Version 0.2.6-preview.12

* Generated browser compatible JavaScript files based on Microsoft Azure Storage SDK for Node.js 2.6.0.

2017.09 Version 0.2.5-preview.11

* Generated browser compatible JavaScript files based on Microsoft Azure Storage SDK for Node.js 2.5.0.

2017.08 Version 0.2.4-preview.10

* Generated browser compatible JavaScript files based on Microsoft Azure Storage SDK for Node.js 2.4.0.

2017.08 Version 0.2.3-preview.9

* Generated browser compatible JavaScript files based on Microsoft Azure Storage SDK for Node.js 2.3.0.

2017.08 Version 0.2.2-preview.8

* Generated browser compatible JavaScript files based on Microsoft Azure Storage SDK for Node.js 2.2.2.

2017.07 Version 0.2.2-preview.7

* Added browser specific APIs for blobs and files uploading.
    * `BlobService.createBlockBlobFromBrowserFile`
    * `BlobService.createPageBlobFromBrowserFile`
    * `BlobService.createAppendBlobFromBrowserFile`
    * `BlobService.appendFromBrowserFile`
    * `FileService.createFileFromBrowserFile`
* Updated samples with above new added APIs.
* Dropped dependency to browserify-fs.

2017.07 Version 0.2.2-preview.6

* Generated browser compatible JavaScript files based on Microsoft Azure Storage SDK for Node.js 2.2.1.

2017.06 Version 0.2.2-preview.5

* Generated browser compatible JavaScript files based on Microsoft Azure Storage SDK for Node.js 2.2.0.

2017.05 Version 0.2.1-preview.4

* Reduced footprint of the generated JavaScript files.
* Removed 7 local-file related APIs which are limited by browser's sandbox.

2017.03 Version 0.2.1-preview.3

* Fixed missing 100% upload progress issue in blob sample for uploading blobs smaller than 32MB.
* Added speedSummary code example in the blob & file samples.

2017.03 Version 0.2.1-preview.2

* Generated browser compatible JavaScript files based on Microsoft Azure Storage SDK for Node.js 2.1.0.

2017.03 Version 0.2.0-preview.1

* Generated browser compatible JavaScript files based on Microsoft Azure Storage SDK for Node.js 2.0.0.
* Added bundle scripts to generate Azure Storage JavaScript Client Library.
* Added npm command `npm run genjs` to generate JavaScript Client Library.
* Added samples for Azure Storage JavaScript Client Library.