Note: This is the change log file for Azure Storage JavaScript Client Library.

2017.02 Version 2.0.0-prerelease.1

* Added bundle scripts to generate Azure Storage JavaScript Client Library.
* Added npm command `npm run genjs` to generate JavaScript Client Library more conveniently.
* Fixed compatibility issues for browsers and browserify:
	* Enabling MD5 checking when uploading blobs will buffer all the trunks
	* Chrome compatibility issue, cannot upload blobs totally more than 500MB
	* Table Service mergeEntity cannot work
	* In case of an error, Firefox/Edge/IE cannot return correct stacktrace responses. Will throw Error.captureStackTrace is not a function”
	* Microsoft Edge may crash after stream-http’s update
	* 403 Authorization error when using Azure Storage Key
	* azureutil.pathExistsSync is not found
	* IE - Number.isNaN is not a function
	* 403 Authorization error for some DELETE operations
* Added samples for Azure Storage JavaScript Client Library.