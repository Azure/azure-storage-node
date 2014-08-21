// 
// Copyright (c) Microsoft and contributors.  All rights reserved.
// 
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//   http://www.apache.org/licenses/LICENSE-2.0
// 
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// 
// See the License for the specific language governing permissions and
// limitations under the License.
// 

// Module dependencies.
var fs = require('fs');
var qs = require('querystring');
var url = require('url');
var util = require('util');
var mime = require('mime');
var _ = require('underscore');
var crypto = require('crypto');
var extend = require('extend');

var azureCommon = require('./../../common/common');
var azureutil = azureCommon.util;
var SR = azureCommon.SR;
var validate = azureCommon.validate;
var SpeedSummary = azureCommon.SpeedSummary;
var StorageServiceClient = azureCommon.StorageServiceClient;
var WebResource = azureCommon.WebResource;

// Constants
var Constants = azureCommon.Constants;
var FileConstants = Constants.FileConstants;
var HeaderConstants = Constants.HeaderConstants;
var HttpConstants = Constants.HttpConstants;
var QueryStringConstants = Constants.QueryStringConstants;
var RequestLocationMode = Constants.RequestLocationMode;

// Streams
var BatchOperation = azureCommon.BatchOperation;
var SpeedSummary = azureCommon.SpeedSummary;
var ChunkAllocator = azureCommon.ChunkAllocator;
var ChunkStream = azureCommon.ChunkStream;
var ChunkStreamWithStream = azureCommon.ChunkStreamWithStream;
var FileReadStream = azureCommon.FileReadStream;

// Models requires
var ShareResult = require('./models/shareresult');
var DirectoryResult = require('./models/directoryresult');
var FileResult = require('./models/fileresult');

var FileUtilities = require('./fileutilities');

/**
* Creates a new FileService object.
* If no connection string or storageaccount and storageaccesskey are provided,
* the AZURE_STORAGE_CONNECTION_STRING or AZURE_STORAGE_ACCOUNT and AZURE_STORAGE_ACCESS_KEY environment variables will be used.
* @class
* The FileService class is used to perform operations on the Microsoft Azure File Service.
* The File Service provides storage for binary large objects, and provides functions for working with data stored in files.
* 
* For more information on the File Service, as well as task focused information on using it in a Node.js application, see
* [How to Use the File Service from Node.js](http://azure.microsoft.com/en-us/documentation/articles/storage-nodejs-how-to-use-file-storage/).
* The following defaults can be set on the file service.
* defaultTimeoutIntervalInMs                          The default timeout interval, in milliseconds, to use for request made via the file service.
* defaultMaximumExecutionTimeInMs                     The default maximum execution time across all potential retries, for requests made via the file service.
* defaultLocationMode                                 The default location mode for requests made via the file service.
* parallelOperationThreadCount                        The number of parallel operations that may be performed when uploading a file.
* @constructor
* @extends {StorageServiceClient}
*
* @param {string} [storageAccountOrConnectionString]  The storage account or the connection string.
* @param {string} [storageAccessKey]                  The storage access key.
* @param {string|object} [host]                       The host address. To define primary only, pass a string. 
*                                                     Otherwise 'host.primaryHost' defines the primary host and 'host.secondaryHost' defines the secondary host.
*/
function FileService(storageAccountOrConnectionString, storageAccessKey, host) {
  var storageServiceSettings = StorageServiceClient.getStorageSettings(storageAccountOrConnectionString, storageAccessKey, host);

  FileService['super_'].call(this,
    storageServiceSettings._name,
    storageServiceSettings._key,
    storageServiceSettings._fileEndpoint,
    storageServiceSettings._usePathStyleUri,
    storageServiceSettings._sasToken);

  this.parallelOperationThreadCount = Constants.DEFAULT_PARALLEL_OPERATION_THREAD_COUNT;
}

util.inherits(FileService, StorageServiceClient);

// Utility methods

/**
* Create resource name
* @ignore
*
* @param {string} share          Share name
* @param {string} [directory]    Directory name
* @param {string} [file]         File name
* @return {string} The encoded resource name.
*/
function createResourceName(share, directory, file) {
  var encode = function(name) {
    var value = encodeURIComponent(name);
    value = value.replace(/%2F/g, '/');
    value = value.replace(/%5C/g, '/');
    value = value.replace(/\+/g, '%20');  
    return value;         
  }

  var name = share;

  if (directory) {
    // if directory does not start with '/', add it
    if (directory.indexOf(0) !== '/') {
      name += ('/');
    }

    name += encode(directory);
  } 

  if (file) {
    // if the current path does not end with '/', add it
    if (name.indexOf(name.length - 1) !== '/') {
      name += ('/');
    }
    
    name += encode(file);
  }

  return name;
};

// Account methods

/**
* Lists a segment containing a collection of share items under the specified account.
*
* @this {FileService}
* @param {object}             currentToken                                A continuation token returned by a previous listing operation. Please use 'null' or 'undefined' if this is the first operation.
* @param {object}             [options]                                   The request options.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to. 
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.maxResults]                        Specifies the maximum number of shares to return per call to Azure storage.
* @param {string}             [options.include]                           Include this parameter to specify that the share's metadata be returned as part of the response body. (allowed values: '', 'metadata')
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResult}  callback                                        `error` will contain information
*                                                                         if an error occurs; otherwise `result` will contain `entries` and `continuationToken`. 
*                                                                         `entries`  gives a list of shares and the `continuationToken` is used for the next listing operation.
*                                                                         `response` will contain information related to this operation.
*/
FileService.prototype.listSharesSegmented = function (currentToken, optionsOrCallback, callback) {
  this.listSharesSegmentedWithPrefix(null /* prefix */, currentToken, optionsOrCallback, callback);
};

/**
* Lists a segment containing a collection of share items whose names begin with the specified prefix under the specified account.
*
* @this {FileService}
* @param {string}             prefix                                      The prefix of the share name.
* @param {object}             currentToken                                A continuation token returned by a previous listing operation. Please use 'null' or 'undefined' if this is the first operation.
* @param {object}             [options]                                   The request options.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to. 
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {string}             [options.prefix]                            Filters the results to return only shares whose name begins with the specified prefix.
* @param {int}                [options.maxResults]                        Specifies the maximum number of shares to return per call to Azure storage.
* @param {string}             [options.include]                           Include this parameter to specify that the share's metadata be returned as part of the response body. (allowed values: '', 'metadata')
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResult}  callback                                        `error` will contain information
*                                                                         if an error occurs; otherwise `result` will contain `entries` and `continuationToken`. 
*                                                                         `entries`  gives a list of shares and the `continuationToken` is used for the next listing operation.
*                                                                         `response` will contain information related to this operation.
*/
FileService.prototype.listSharesSegmentedWithPrefix = function (prefix, currentToken, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('listShares', function (v) {
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  var webResource = WebResource.get()
    .withQueryOption(QueryStringConstants.COMP, 'list')
    .withQueryOption(QueryStringConstants.MAX_RESULTS, options.maxResults)
    .withQueryOption(QueryStringConstants.INCLUDE, options.include);

  if(!azureutil.objectIsNull(currentToken)) {
    webResource.withQueryOption(QueryStringConstants.MARKER, currentToken.nextMarker);
  }

  webResource.withQueryOption(QueryStringConstants.PREFIX, prefix);

  //options.requestLocationMode = azureutil.getNextListingLocationMode(currentToken);

  var processResponseCallback = function (responseObject, next) {
    responseObject.listSharesResult = null;

    if (!responseObject.error) {
      responseObject.listSharesResult = {
        entries: null,
        continuationToken: null
      };
      responseObject.listSharesResult.entries = [];

      var shares = [];

      if (responseObject.response.body.EnumerationResults.Shares && responseObject.response.body.EnumerationResults.Shares.Share) {
        shares = responseObject.response.body.EnumerationResults.Shares.Share;
        if (!_.isArray(shares)) {
          shares = [ shares ];
        }
      }

      shares.forEach(function (currentShare) {
        var shareResult = ShareResult.parse(currentShare);
        responseObject.listSharesResult.entries.push(shareResult);
      });

      if(responseObject.response.body.EnumerationResults.NextMarker) {
        responseObject.listSharesResult.continuationToken = {
          nextMarker: null,
          targetLocation: null
        };

        responseObject.listSharesResult.continuationToken.nextMarker = responseObject.response.body.EnumerationResults.NextMarker;
        responseObject.listSharesResult.continuationToken.targetLocation = responseObject.targetLocation;
      }
    }

    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.listSharesResult, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

// Share methods

/**
* Checks whether or not a share exists on the service.
*
* @this {FileService}
* @param {string}             share                                   The share name.
* @param {object}             [options]                               The request options.
* @param {LocationMode}       [options.locationMode]                  Specifies the location mode used to decide which location the request should be sent to. 
*                                                                     Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]           The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]      The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                     The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                     execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResult}  callback                                    `error` will contain information
*                                                                     if an error occurs; otherwise `result` will
*                                                                     be true if the share exists, or false if the share does not exist. 
*                                                                     `response` will contain information related to this operation.
*/
FileService.prototype.doesShareExist = function (share, optionsOrCallback, callback) {
  this._doesShareExist(share, false, optionsOrCallback, callback);
};

/**
* Creates a new share under the specified account.
* If a share with the same name already exists, the operation fails.
*
* @this {FileService}
* @param {string}             share                               The share name.
* @param {object}             [options]                           The request options.
* @param {LocationMode}       [options.locationMode]              Specifies the location mode used to decide which location the request should be sent to. 
*                                                                 Please see StorageUtilities.LocationMode for the possible values.
* @param {object}             [options.metadata]                  The metadata key/value pairs.
* @param {int}                [options.timeoutIntervalInMs]       The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]  The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                 The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                 execution time is checked intermittently while performing requests, and before executing retries.                                  
* @param {errorOrResult}  callback                                `error` will contain information
*                                                                 if an error occurs; otherwise `result` will contain
*                                                                 the share information.
*                                                                 `response` will contain information related to this operation.
*/
FileService.prototype.createShare = function (share, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('createShare', function (v) {
    v.string(share, 'share');
    v.shareNameIsValid(share);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  var webResource = WebResource.put(share)
    .withQueryOption(QueryStringConstants.RESTYPE, 'share');

  webResource.addOptionalMetadataHeaders(options.metadata);

  var processResponseCallback = function (responseObject, next) {
    responseObject.shareResult = null;
    if (!responseObject.error) {
      responseObject.shareResult = new ShareResult(share);
      responseObject.shareResult.getPropertiesFromHeaders(responseObject.response.headers);

      if (options.metadata) {
        responseObject.shareResult.metadata = options.metadata;
      }
    }

    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.shareResult, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

/**
* Creates a new share under the specified account if the share does not exists.
*
* @this {FileService}
* @param {string}             share                                     The share name.
* @param {object}             [options]                                 The request options.
* @param {LocationMode}       [options.locationMode]                    Specifies the location mode used to decide which location the request should be sent to. 
*                                                                       Please see StorageUtilities.LocationMode for the possible values.
* @param {object}             [options.metadata]                        The metadata key/value pairs.
* @param {int}                [options.timeoutIntervalInMs]             The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]        The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                       The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                       execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResult}  callback                                      `error` will contain information
*                                                                       if an error occurs; otherwise `result` will
*                                                                       be true if the share was created, or false if the share
*                                                                       already exists.
*                                                                       `response` will contain information related to this operation.
*
* @example
* var azure = require('azure-storage');
* var FileService = azure.createFileService();
* FileService.createShareIfNotExists('taskshare', function(error) {
*   if(!error) {
*     // Share created or already existed
*   }
* }); 
*/
FileService.prototype.createShareIfNotExists = function (share, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('createShareIfNotExists', function (v) {
    v.string(share, 'share');
    v.shareNameIsValid(share);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  var self = this;
  self._doesShareExist(share, true, options, function(error, exists, response) {
    if(error){
      callback(error, exists, response);
    } else if (exists) {
      response.isSuccessful = true;
      callback(error, false, response);
    } else {
      self.createShare(share, options, function (createError, responseShare, createResponse) {
        var created;
        if(!createError){
          created = true;
        }
        else if (createError && createError.statusCode === HttpConstants.HttpResponseCodes.Conflict && createError.code === Constants.FileErrorCodeStrings.SHARE_ALREADY_EXISTS) {
          // If it was created before, there was no actual error.
          createError = null;
          created = false;
          createResponse.isSuccessful = true;
        }

        callback(createError, created, createResponse);
      });
    }
  });
};

/**
* Retrieves a share and its properties from a specified account.
*
* @this {FileService}
* @param {string}             share                               The share name.
* @param {object}             [options]                           The request options.
* @param {LocationMode}       [options.locationMode]              Specifies the location mode used to decide which location the request should be sent to. 
*                                                                 Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]       The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]  The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                 The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                 execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResult}  callback                                `error` will contain information
*                                                                 if an error occurs; otherwise `result` will contain
*                                                                 information for the share.
*                                                                 `response` will contain information related to this operation.
*/
FileService.prototype.getShareProperties = function (share, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('getShareProperties', function (v) {
    v.string(share, 'share');
    v.shareNameIsValid(share);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  var webResource = WebResource.head(share)
    .withQueryOption(QueryStringConstants.RESTYPE, 'share');

  //options.requestLocationMode = Constants.RequestLocationMode.PRIMARY_OR_SECONDARY;

  var self = this;
  var processResponseCallback = function (responseObject, next) {
    responseObject.shareResult = null;
    if (!responseObject.error) {
      responseObject.shareResult = new ShareResult(share);
      responseObject.shareResult.metadata = self.parseMetadataHeaders(responseObject.response.headers);
      responseObject.shareResult.getPropertiesFromHeaders(responseObject.response.headers);
    }

    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.shareResult, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

/**
* Returns all user-defined metadata for the share.
*
* @this {FileService}
* @param {string}             share                                     The share name.
* @param {object}             [options]                                 The request options.
* @param {LocationMode}       [options.locationMode]                    Specifies the location mode used to decide which location the request should be sent to. 
*                                                                       Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]             The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]        The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                       The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                       execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResult}  callback                                      `error` will contain information
*                                                                       if an error occurs; otherwise `result` will contain
*                                                                       information for the share.
*                                                                       `response` will contain information related to this operation.
*/
FileService.prototype.getShareMetadata = function (share, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('getShareMetadata', function (v) {
    v.string(share, 'share');
    v.shareNameIsValid(share);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  var webResource = WebResource.head(share)
    .withQueryOption(QueryStringConstants.RESTYPE, 'share')
    .withQueryOption(QueryStringConstants.COMP, 'metadata');

  //options.requestLocationMode = Constants.RequestLocationMode.PRIMARY_OR_SECONDARY;

  var self = this;
  var processResponseCallback = function (responseObject, next) {
    responseObject.shareResult = null;
    if (!responseObject.error) {
      responseObject.shareResult = new ShareResult(share);
      responseObject.shareResult.metadata = self.parseMetadataHeaders(responseObject.response.headers);
      responseObject.shareResult.getPropertiesFromHeaders(responseObject.response.headers);
    }

    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.shareResult, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

/**
* Sets the share's metadata.
*
* Calling the Set Share Metadata operation overwrites all existing metadata that is associated with the share.
* It's not possible to modify an individual name/value pair.
*
* @this {FileService}
* @param {string}             share                               The share name.
* @param {object}             metadata                            The metadata key/value pairs.
* @param {object}             [options]                           The request options.
* @param {LocationMode}       [options.locationMode]              Specifies the location mode used to decide which location the request should be sent to. 
*                                                                 Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]       The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]  The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                 The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                 execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResponse}  callback                              `error` will contain information
*                                                                 if an error occurs; otherwise 
*                                                                 `response` will contain information related to this operation.
*/
FileService.prototype.setShareMetadata = function (share, metadata, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('setShareMetadata', function (v) {
    v.string(share, 'share');
    v.object(metadata, 'metadata');
    v.shareNameIsValid(share);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  var webResource = WebResource.put(share)
    .withQueryOption(QueryStringConstants.RESTYPE, 'share')
    .withQueryOption(QueryStringConstants.COMP, 'metadata');

  webResource.addOptionalMetadataHeaders(metadata);

  var processResponseCallback = function (responseObject, next) {
    responseObject.shareResult = null;
    if (!responseObject.error) {
      responseObject.shareResult = new ShareResult(share);
      responseObject.shareResult.getPropertiesFromHeaders(responseObject.response.headers);
    }

    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.shareResult, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

/**
* Marks the specified share for deletion.
* The share and any files contained within it are later deleted during garbage collection.
*
* @this {FileService}
* @param {string}             share                               The share name.
* @param {object}             [options]                           The request options.
* @param {LocationMode}       [options.locationMode]              Specifies the location mode used to decide which location the request should be sent to. 
*                                                                 Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]       The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]  The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                 The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                 execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResponse}  callback                              `error` will contain information
*                                                                 if an error occurs; otherwise
*                                                                 `response` will contain information related to this operation.
*/
FileService.prototype.deleteShare = function (share, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('deleteShare', function (v) {
    v.string(share, 'share');
    v.shareNameIsValid(share);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  var webResource = WebResource.del(share)
    .withQueryOption(QueryStringConstants.RESTYPE, 'share');
  
  var processResponseCallback = function (responseObject, next) {
    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

/**
* Marks the specified share for deletion if it exists.
* The share and any files contained within it are later deleted during garbage collection.
*
* @this {FileService}
* @param {string}             share                           		The share name.
* @param {object}             [options]                           The request options.
* @param {LocationMode}       [options.locationMode]              Specifies the location mode used to decide which location the request should be sent to. 
*                                                                 Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]       The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]  The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                 The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                 execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResult} callback                                 `error` will contain information
*                                                                 if an error occurs; otherwise `result` will 
*                                                                 be true if the share exists and was deleted, or false if the share
*                                                                 did not exist.
*                                                                 `response` will contain information related to this operation.
*/
FileService.prototype.deleteShareIfExists = function (share, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('deleteShareIfExists', function (v) {
    v.string(share, 'share');
    v.shareNameIsValid(share);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  var self = this;
  self._doesShareExist(share, true, options, function(error, exists, response) {
    if(error){
      callback(error, exists, response);
    } else if (!exists) {
      response.isSuccessful = true;
      callback(error, false, response);
    } else {
      self.deleteShare(share, options, function (deleteError, deleteResponse) {
        var deleted;
        if (!deleteError){
          deleted = true;
        } else if (deleteError && deleteError.statuscode === HttpConstants.HttpResponseCodes.NotFound && deleteError.code === Constants.FileErrorCodeStrings.SHARE_NOT_FOUND) {
          // If it was deleted already, there was no actual error.
          deleted = false;
          deleteError = null;
          deleteResponse.isSuccessful = true;
        }

        callback(deleteError, deleted, deleteResponse);
      });
    }
  });
};

// Directory methods

/**
* Checks whether or not a directory exists on the service.
*
* @this {FileService}
* @param {string}             share                           				The share name.
* @param {string}             directory                               The directory name. Use '' to refer to the base directory.
* @param {object}             [options]                               The request options.
* @param {LocationMode}       [options.locationMode]                  Specifies the location mode used to decide which location the request should be sent to. 
*                                                                     Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]           The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]      The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                     The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                     execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResult}  callback                                    `error` will contain information
*                                                                     if an error occurs; otherwise `result` will
*                                                                     be true if the directory exists, or false if the directory does not exist. 
*                                                                     `response` will contain information related to this operation.
*/
FileService.prototype.doesDirectoryExist = function (share, directory, optionsOrCallback, callback) {
  this._doesDirectoryExist(share, directory, false, optionsOrCallback, callback);
};

/**
* Creates a new directory under the specified account.
* If a directory with the same name already exists, the operation fails.
*
* @this {FileService}
* @param {string}             share                           		The share name.
* @param {string}             directory                           The directory name.
* @param {object}             [options]                           The request options.
* @param {LocationMode}       [options.locationMode]              Specifies the location mode used to decide which location the request should be sent to. 
*                                                                 Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]       The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]  The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                 The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                 execution time is checked intermittently while performing requests, and before executing retries.                                  
* @param {errorOrResult}  callback                                `error` will contain information
*                                                                 if an error occurs; otherwise `result` will contain
*                                                                 the directory information.
*                                                                 `response` will contain information related to this operation.
*/
FileService.prototype.createDirectory = function (share, directory, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('createDirectory', function (v) {
  	v.string(share, 'share');
    v.string(directory, 'directory');
    v.shareNameIsValid(share);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  var webResource = WebResource.put(createResourceName(share, directory))
    .withQueryOption(QueryStringConstants.RESTYPE, 'directory');

  webResource.addOptionalMetadataHeaders(options.metadata);

  var processResponseCallback = function (responseObject, next) {
    responseObject.directoryResult = null;
    if (!responseObject.error) {
      responseObject.directoryResult = new DirectoryResult(directory);
      responseObject.directoryResult.getPropertiesFromHeaders(responseObject.response.headers);
    }

    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.directoryResult, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

/**
* Creates a new directory under the specified account if the directory does not exists.
*
* @this {FileService}
* @param {string}             share                           					The share name.
* @param {string}             directory                                 The directory name.
* @param {object}             [options]                                 The request options.
* @param {LocationMode}       [options.locationMode]                    Specifies the location mode used to decide which location the request should be sent to. 
*                                                                       Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]             The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]        The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                       The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                       execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResult}  callback                                      `error` will contain information
*                                                                       if an error occurs; otherwise `result` will
*                                                                       be true if the directory was created, or false if the directory
*                                                                       already exists.
*                                                                       `response` will contain information related to this operation.
*
* @example
* var azure = require('azure-storage');
* var FileService = azure.createFileService();
* FileService.createDirectoryIfNotExists('taskshare', taskdirectory', function(error) {
*   if(!error) {
*     // Directory created or already existed
*   }
* }); 
*/
FileService.prototype.createDirectoryIfNotExists = function (share, directory, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('createDirectoryIfNotExists', function (v) {
  	v.string(share, 'share');
    v.string(directory, 'directory');
    v.shareNameIsValid(share);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  var self = this;
  self._doesDirectoryExist(share, directory, true, options, function(error, exists, response) {
    if(error){
      callback(error, exists, response);
    } else if (exists) {
      response.isSuccessful = true;
      callback(error, false, response);
    } else {
      self.createDirectory(share, directory, options, function (createError, responseDirectory, createResponse) {
        var created;
        if(!createError){
          created = true;
        }
        else if (createError && createError.statusCode === HttpConstants.HttpResponseCodes.Conflict && createError.code === Constants.StorageErrorCodeStrings.RESOURCE_ALREADY_EXISTS) {
          // If it was created before, there was no actual error.
          createError = null;
          created = false;
          createResponse.isSuccessful = true;
        }

        callback(createError, created, createResponse);
      });
    }
  });
};

/**
* Retrieves a directory and its properties from a specified account.
*
* @this {FileService}
* @param {string}             share                           		The share name.
* @param {string}             directory                           The directory name. Use '' to refer to the base directory.
* @param {object}             [options]                           The request options.
* @param {LocationMode}       [options.locationMode]              Specifies the location mode used to decide which location the request should be sent to. 
*                                                                 Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]       The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]  The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                 The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                 execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResult}  callback                                `error` will contain information
*                                                                 if an error occurs; otherwise `result` will contain
*                                                                 information for the directory.
*                                                                 `response` will contain information related to this operation.
*/
FileService.prototype.getDirectoryProperties = function (share, directory, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('getDirectoryProperties', function (v) {
  	v.string(share, 'share');
    v.stringAllowEmpty(directory, 'directory');
    v.shareNameIsValid(share);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  var webResource = WebResource.head(createResourceName(share, directory))
    .withQueryOption(QueryStringConstants.RESTYPE, 'directory');

  //options.requestLocationMode = Constants.RequestLocationMode.PRIMARY_OR_SECONDARY;

  var self = this;
  var processResponseCallback = function (responseObject, next) {
    responseObject.directoryResult = null;
    if (!responseObject.error) {
      responseObject.directoryResult = new DirectoryResult(directory);
      responseObject.directoryResult.getPropertiesFromHeaders(responseObject.response.headers);
    }

    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.directoryResult, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

/**
* Marks the specified directory for deletion. The directory must be empty before it can be deleted.
*
* @this {FileService}
* @param {string}             share                           		The share name.
* @param {string}             directory                           The directory name.
* @param {object}             [options]                           The request options.
* @param {LocationMode}       [options.locationMode]              Specifies the location mode used to decide which location the request should be sent to. 
*                                                                 Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]       The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]  The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                 The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                 execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResponse}  callback                              `error` will contain information
*                                                                 if an error occurs; otherwise
*                                                                 `response` will contain information related to this operation.
*/
FileService.prototype.deleteDirectory = function (share, directory, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('deleteDirectory', function (v) {
  	v.string(share, 'share');
    v.string(directory, 'directory');
    v.shareNameIsValid(share);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  var webResource = WebResource.del(createResourceName(share, directory))
    .withQueryOption(QueryStringConstants.RESTYPE, 'directory');
  
  var processResponseCallback = function (responseObject, next) {
    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

/**
* Marks the specified directory for deletion if it exists. The directory must be empty before it can be deleted.
*
* @this {FileService}
* @param {string}             share                           		The share name.
* @param {string}             directory                           The directory name.
* @param {object}             [options]                           The request options.
* @param {LocationMode}       [options.locationMode]              Specifies the location mode used to decide which location the request should be sent to. 
*                                                                 Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]       The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]  The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                 The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                 execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResult} callback                                 `error` will contain information
*                                                                 if an error occurs; otherwise `result` will 
*                                                                 be true if the directory exists and was deleted, or false if the directory
*                                                                 did not exist.
*                                                                 `response` will contain information related to this operation.
*/
FileService.prototype.deleteDirectoryIfExists = function (share, directory, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('deleteDirectoryIfExists', function (v) {
  	v.string(share, 'share');
    v.string(directory, 'directory');
    v.shareNameIsValid(share);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  var self = this;
  self._doesDirectoryExist(share, directory, true, options, function(error, exists, response) {
    if(error){
      callback(error, exists, response);
    } else if (!exists) {
      response.isSuccessful = true;
      callback(error, false, response);
    } else {
      self.deleteDirectory(share, directory, options, function (deleteError, deleteResponse) {
        var deleted;
        if (!deleteError){
          deleted = true;
        } else if (deleteError && deleteError.statuscode === HttpConstants.HttpResponseCodes.NotFound && deleteError.code === Constants.StorageErrorCodeStrings.RESOURCE_NOT_FOUND) {
          // If it was deleted already, there was no actual error.
          deleted = false;
          deleteError = null;
          deleteResponse.isSuccessful = true;
        }

        callback(deleteError, deleted, deleteResponse);
      });
    }
  });
};

/**
* Lists a segment containing a collection of file items in the directory.
*
* @this {FileService}
* @param {string}             share                           	The share name.
* @param {string}             directory                         The directory name. Use '' to refer to the base directory.
* @param {object}             currentToken                      A continuation token returned by a previous listing operation. Please use 'null' or 'undefined' if this is the first operation.
* @param {object}             [options]                         The request options.
* @param {int}                [options.maxResults]              Specifies the maximum number of files to return per call to Azure ServiceClient. This does NOT affect list size returned by this function. (maximum: 5000)
* @param {LocationMode}       [options.locationMode]            Specifies the location mode used to decide which location the request should be sent to. 
*                                                               Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]     The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                               The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                               execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResult}  callback                              `error` will contain information
*                                                               if an error occurs; otherwise `result` will contain
*                                                               entries.files, entries.directories and the continuationToken for the next listing operation.
*                                                               `response` will contain information related to this operation.
*/
FileService.prototype.listFilesAndDirectoriesSegmented = function (share, directory, currentToken, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('listFilesSegmented', function (v) {
  	v.string(share, 'share');
    v.stringAllowEmpty(directory, 'directory');
    v.shareNameIsValid(share);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  var webResource = WebResource.get(createResourceName(share, directory))
    .withQueryOption(QueryStringConstants.RESTYPE, 'directory')
    .withQueryOption(QueryStringConstants.COMP, 'list')
    .withQueryOption(QueryStringConstants.MAX_RESULTS, options.maxResults);

  if (!azureutil.objectIsNull(currentToken)) {
    webResource.withQueryOption(QueryStringConstants.MARKER, currentToken.nextMarker);
  }
  
  //options.requestLocationMode = azureutil.getNextListingLocationMode(currentToken);

  var processResponseCallback = function (responseObject, next) {
    responseObject.listResult = null;
    if (!responseObject.error) {
      responseObject.listResult = {
        entries: null,
        continuationToken: null
      };

      responseObject.listResult.entries = {};
      responseObject.listResult.entries.files = [];
      responseObject.listResult.entries.directories = [];
      var files = [];
      var directories = [];

      // parse files
      if (responseObject.response.body.EnumerationResults.Entries.File) {
        files = responseObject.response.body.EnumerationResults.Entries.File;
        if (!_.isArray(files)) {
          files = [ files ];
        }
      }

      files.forEach(function (currentFile) {
        var fileResult = FileResult.parse(currentFile);
        responseObject.listResult.entries.files.push(fileResult);
      });

      // parse directories
      if (responseObject.response.body.EnumerationResults.Entries.Directory) {
        directories = responseObject.response.body.EnumerationResults.Entries.Directory;
        if (!_.isArray(directories)) {
          directories = [ directories ];
        }
      }

      directories.forEach(function (currentDirectory) {
        var directoryResult = DirectoryResult.parse(currentDirectory);
        responseObject.listResult.entries.directories.push(directoryResult);
      });

      // parse continuation token
      if(responseObject.response.body.EnumerationResults.NextMarker) {
        responseObject.listResult.continuationToken = {
          nextMarker: null,
          targetLocation: null
        };

        responseObject.listResult.continuationToken.nextMarker = responseObject.response.body.EnumerationResults.NextMarker;
        responseObject.listResult.continuationToken.targetLocation = responseObject.targetLocation;
      }
    }

    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.listResult, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

// File methods

/**
* Retrieves a file or directory URL.
*
* @param {string}                   share                		 The share name.
* @param {string}                   directory                The directory name. Use '' to refer to the base directory.
* @param {string}                   [file]                   The file name. File names may not start or end with the delimiter '/'.
* @param {boolean}                  [primary]                A boolean representing whether to use the primary or the secondary endpoint.
* @return {string}                                           The formatted URL string.
* @example
* var azure = require('azure-storage');
* var FileService = azure.createFileService();
* var url = FileService.getUrl(shareName, directoryName, fileName, true);
*/
FileService.prototype.getUrl = function (share, directory, file, primary) {
  validate.validateArgs('getUrl', function (v) {
  	v.string(share, 'share');
    v.stringAllowEmpty(directory, 'directory');
    v.shareNameIsValid(share);
  });

  var host;
  if(!azureutil.objectIsNull(primary) && primary === false) {
    host = this.host.secondaryHost;
  }
  else {
    host = this.host.primaryHost;
  }

  var name = createResourceName(share, directory, file);
  return url.resolve(host, url.format({pathname: this._getPath('/' + name)}));
};

/**
* Returns all user-defined metadata, standard HTTP properties, and system properties for the file.
* It does not return or modify the content of the file.
*
* @this {FileService}
* @param {string}             share                           						The share name.
* @param {string}             directory                                   The directory name. Use '' to refer to the base directory.
* @param {string}             file                                        The file name. File names may not start or end with the delimiter '/'.
* @param {object}             [options]                                   The request options.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to. 
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResult}  callback                                        `error` will contain information
*                                                                         if an error occurs; otherwise `result` will contain
*                                                                         information about the file.
*                                                                         `response` will contain information related to this operation.
*/
FileService.prototype.getFileProperties = function (share, directory, file, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('getFileProperties', function (v) {
  	v.string(share, 'share');
    v.stringAllowEmpty(directory, 'directory');
    v.string(file, 'file');
    v.shareNameIsValid(share);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  var resourceName = createResourceName(share, directory, file);
  var webResource = WebResource.head(resourceName);

  //options.requestLocationMode = Constants.RequestLocationMode.PRIMARY_OR_SECONDARY;

  var self = this;
  var processResponseCallback = function (responseObject, next) {
    responseObject.fileResult = null;
    if (!responseObject.error) {
      responseObject.fileResult = new FileResult(share, directory, file);
      responseObject.fileResult.metadata = self.parseMetadataHeaders(responseObject.response.headers);
      responseObject.fileResult.getPropertiesFromHeaders(responseObject.response.headers, true);
    }

    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.fileResult, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

/**
* Returns all user-defined metadata for the specified file.
* It does not modify or return the content of the file.
*
* @this {FileService}
* @param {string}             share                           						The share name.
* @param {string}             directory                                   The directory name. Use '' to refer to the base directory.
* @param {string}             file                                        The file name. File names may not start or end with the delimiter '/'.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to. 
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResult}  callback                                        `error` will contain information
*                                                                         if an error occurs; otherwise `result` will contain
*                                                                         information about the file.
*                                                                         `response` will contain information related to this operation.
*/
FileService.prototype.getFileMetadata = function (share, directory, file, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('getFileMetadata', function (v) {
  	v.string(share, 'share');
    v.stringAllowEmpty(directory, 'directory');
    v.string(file, 'file');
    v.shareNameIsValid(share);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  var resourceName = createResourceName(share, directory, file);
  var webResource = WebResource.head(resourceName)
		.withQueryOption(QueryStringConstants.COMP, 'metadata');

  //options.requestLocationMode = Constants.RequestLocationMode.PRIMARY_OR_SECONDARY;

  var self = this;
  var processResponseCallback = function (responseObject, next) {
    responseObject.fileResult = null;
    if (!responseObject.error) {
      responseObject.fileResult = new FileResult(share, directory, file);
      responseObject.fileResult.metadata = self.parseMetadataHeaders(responseObject.response.headers);
      responseObject.fileResult.getPropertiesFromHeaders(responseObject.response.headers);
    }

    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.fileResult, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

/**
* Sets user-defined properties for the specified file.
* It does not modify or return the content of the file.
*
* @this {FileService}
* @param {string}             share                           						The share name.
* @param {string}             directory                                   The directory name. Use '' to refer to the base directory.
* @param {string}             file                                        The file name. File names may not start or end with the delimiter '/'.
* @param {object}             [options]                                   The request options.
* @param {string}             [options.contentType]                       The MIME content type of the file. The default type is application/octet-stream.
* @param {string}             [options.contentEncoding]                   The content encodings that have been applied to the file.
* @param {string}             [options.contentLanguage]                   The natural languages used by this resource.
* @param {string}             [options.contentMD5]                        The MD5 hash of the file content.
* @param {string}             [options.cacheControl]                      The file service stores this value but does not use or modify it.
* @param {string}             [options.contentDisposition]                The file's content disposition.
* @param {string}             [options.contentLength]                			Resizes a file to the specified size. If the specified byte value is less than the current size of the file, 
*                                                                       	then all ranges above the specified byte value are cleared.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to. 
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResult}  callback                                        `error` will contain information
*                                                                         if an error occurs; otherwise `result` will contain
*                                                                         information about the file.
*                                                                         `response` will contain information related to this operation.
*/
FileService.prototype.setFileProperties = function (share, directory, file, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('setFileProperties', function (v) {
  	v.string(share, 'share');
    v.stringAllowEmpty(directory, 'directory');
    v.string(file, 'file');
    v.shareNameIsValid(share);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  var resourceName = createResourceName(share, directory, file);
  var webResource = WebResource.put(resourceName)
    .withQueryOption(QueryStringConstants.COMP, 'properties');

  FileResult.setProperties(webResource, options);

  var processResponseCallback = function(responseObject, next) {
    responseObject.fileResult = null;
    if (!responseObject.error) {
      responseObject.fileResult = new FileResult(share, directory, file);
      responseObject.fileResult.getPropertiesFromHeaders(responseObject.response.headers);
    }
    
    var finalCallback = function(returnObject) {
      callback(returnObject.error, returnObject.fileResult, returnObject.response);
    };

    next(responseObject, finalCallback);
  };
  
  this.performRequest(webResource, null, options, processResponseCallback);
};

/**
* Sets user-defined metadata for the specified file as one or more name-value pairs 
* It does not modify or return the content of the file.
*
* @this {FileService}
* @param {string}             share                           						The share name.
* @param {string}             directory                                   The directory name. Use '' to refer to the base directory.
* @param {string}             file                                        The file name. File names may not start or end with the delimiter '/'.
* @param {object}             metadata                                    The metadata key/value pairs.
* @param {object}             [options]                                   The request options.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to. 
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResult}  callback                                        `error` will contain information
*                                                                         if an error occurs; otherwise `result` will contain
*                                                                         information on the file.
*                                                                         `response` will contain information related to this operation.
*/
FileService.prototype.setFileMetadata = function (share, directory, file, metadata, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('setFileMetadata', function (v) {
  	v.string(share, 'share');
    v.stringAllowEmpty(directory, 'directory');
    v.string(file, 'file');
    v.shareNameIsValid(share);
    v.object(metadata, 'metadata');
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  var resourceName = createResourceName(share, directory, file);
  var webResource = WebResource.put(resourceName)
    .withQueryOption(QueryStringConstants.COMP, 'metadata');

  webResource.addOptionalMetadataHeaders(metadata);

  var processResponseCallback = function (responseObject, next) {
    responseObject.fileResult = null;
    if (!responseObject.error) {
      responseObject.fileResult = new FileResult(share, directory, file);
      responseObject.fileResult.getPropertiesFromHeaders(responseObject.response.headers);
    }

    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.fileResult, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

/**
* Resizes a file.
*
* @this {FileService}
* @param {string}             	share                           						The share name.
* @param {string}             	directory                                   The directory name. Use '' to refer to the base directory.
* @param {string}             	file                                        The file name. File names may not start or end with the delimiter '/'.
* @param {String}               size                                        The size of the file, in bytes.
* @param {object}               [options]                                   The request options.
* @param {int}                  [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                  [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                           The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                           execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResult}  callback                                          `error` will contain information
*                                                                           if an error occurs; otherwise `result` will contain
*                                                                           information about the file.
*                                                                           `response` will contain information related to this operation.
*/
FileService.prototype.resizeFile = function (share, directory, file, size, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('resizeFile', function (v) {
  	v.string(share, 'share');
    v.stringAllowEmpty(directory, 'directory');
    v.string(file, 'file');
    v.shareNameIsValid(share);
    v.value(size);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  var resourceName = createResourceName(share, directory, file);
  var webResource = WebResource.put(resourceName)
    .withQueryOption(QueryStringConstants.COMP, 'properties');

  webResource.withHeader(HeaderConstants.CONTENT_LENGTH_HEADER, size);

  var processResponseCallback = function(responseObject, next) {
    responseObject.fileResult = null;
    if (!responseObject.error) {
      responseObject.fileResult = new FileResult(share, directory, file);
      responseObject.fileResult.getPropertiesFromHeaders(responseObject.response.headers);
    }
    
    var finalCallback = function(returnObject) {
      callback(returnObject.error, returnObject.fileResult, returnObject.response);
    };

    next(responseObject, finalCallback);
  };
  
  this.performRequest(webResource, null, options, processResponseCallback);  
};

/**
* Checks whether or not a file exists on the service.
*
* @this {FileService}
* @param {string}             share                           				The share name.
* @param {string}             directory                               The directory name. Use '' to refer to the base directory.
* @param {string}             file                                    The file name. File names may not start or end with the delimiter '/'.
* @param {object}             [options]                               The request options.
* @param {LocationMode}       [options.locationMode]                  Specifies the location mode used to decide which location the request should be sent to. 
*                                                                     Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]           The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]      The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                     The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                     execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResult}  callback                                    `error` will contain information
*                                                                     if an error occurs; otherwise `errorOrResult` will 
*                                                                     be true if the file exists, or false if the file does not exist. 
*                                                                     `response` will contain information related to this operation.
*/
FileService.prototype.doesFileExist = function (share, directory, file, optionsOrCallback, callback) {
  this._doesFileExist(share, directory, file, false, optionsOrCallback, callback);
};

/**
* Creates a file of the specified length.
*
* @this {FileService}
* @param {string}             share                           						The share name.
* @param {string}             directory                                   The directory name. Use '' to refer to the base directory.
* @param {string}             file                                        The file name. File names may not start or end with the delimiter '/'.
* @param {int}                length                                      The length of the file in bytes.
* @param {object}             [options]                                   The request options.
* @param {object}             [options.metadata]                          The metadata key/value pairs.
* @param {string}             [options.contentType]                       The MIME content type of the file. The default type is application/octet-stream.
* @param {string}             [options.contentEncoding]                   The content encodings that have been applied to the file.
* @param {string}             [options.contentLanguage]                   The natural languages used by this resource.
* @param {string}             [options.contentMD5]                        The MD5 hash of the file content.
* @param {string}             [options.cacheControl]                      The file service stores this value but does not use or modify it.
* @param {string}             [options.contentDisposition]                The file's content disposition. (x-ms-File-content-disposition)
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to. 
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResult}  callback                                				`error` will contain information
*                                                                     		if an error occurs; otherwise `result` will contain
*                                                                       	the directory information.
*                                                                        `response` will contain information related to this operation.
*/
FileService.prototype.createFile = function (share, directory, file, length, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });
  validate.validateArgs('createFile', function (v) {
  	v.string(share, 'share');
    v.stringAllowEmpty(directory, 'directory');
    v.string(file, 'file');
    v.shareNameIsValid(share);
    v.value(length);
    v.callback(callback);
  });

  var resourceName = createResourceName(share, directory, file);
  var options = extend(true, {}, userOptions);
  var webResource = WebResource.put(resourceName)
    .withHeader(HeaderConstants.TYPE_HEADER, 'file')
    .withHeader(HeaderConstants.CONTENT_LENGTH_HEADER, length);

  webResource.addOptionalMetadataHeaders(options.metadata);
  FileResult.setProperties(webResource, options);

  var processResponseCallback = function(responseObject, next) {
    responseObject.fileResult = null;
    if (!responseObject.error) {
      responseObject.fileResult = new FileResult(share, directory, file);
      responseObject.fileResult.getPropertiesFromHeaders(responseObject.response.headers);
    }
    
    var finalCallback = function(returnObject) {
      callback(returnObject.error, returnObject.fileResult, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

/**
* Marks the specified file for deletion. The file is later deleted during garbage collection.
*
* @this {FileService}
* @param {string}             share                           						The share name.
* @param {string}             directory                                   The directory name. Use '' to refer to the base directory.
* @param {string}             file                                        The file name. File names may not start or end with the delimiter '/'.
* @param {object}             [options]                                   The request options.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to. 
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResponse}  callback                                      `error` will contain information
*                                                                         if an error occurs; `response` will contain information related to this operation.
*/
FileService.prototype.deleteFile = function (share, directory, file, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('deleteFile', function (v) {
  	v.string(share, 'share');
    v.stringAllowEmpty(directory, 'directory');
    v.string(file, 'file');
    v.shareNameIsValid(share);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  var resourceName = createResourceName(share, directory, file);
  var webResource = WebResource.del(resourceName);

  var processResponseCallback = function (responseObject, next) {
    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

/**
* Marks the specified file for deletion if it exists. The file is later deleted during garbage collection.
*
* @this {FileService}
* @param {string}             share                           		The share name.
* @param {string}             directory                           The directory name. Use '' to refer to the base directory.
* @param {string}             file                                The file name. File names may not start or end with the delimiter '/'. 
* @param {object}             [options]                           The request options.
* @param {LocationMode}       [options.locationMode]              Specifies the location mode used to decide which location the request should be sent to. 
*                                                                 Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]       The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]  The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                 The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                 execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResult} callback                                 `error` will contain information
*                                                                 if an error occurs; otherwise `result` will
*                                                                 be true if the file was deleted, or false if the file
*                                                                 does not exist.
*                                                                 `response` will contain information related to this operation.
*/
FileService.prototype.deleteFileIfExists = function (share, directory, file, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('deleteFileIfExists', function (v) {
  	v.string(share, 'share');
    v.stringAllowEmpty(directory, 'directory');
    v.string(file, 'file');
    v.shareNameIsValid(share);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  var self = this;
  self._doesFileExist(share, directory, file, true, options, function(error, exists, response) {
    if(error){
      callback(error, exists, response);
    } else if (!exists) {
      response.isSuccessful = true;
      callback(error, false, response);
    } else {
      self.deleteFile(share, directory, file, options, function (deleteError, deleteResponse) {
        var deleted;
        if (!deleteError){
          deleted = true;
        } else if (deleteError && deleteError.statusCode === Constants.HttpConstants.HttpResponseCodes.NotFound && deleteError.code === Constants.FileErrorCodeStrings.File_NOT_FOUND) {
          // If it was deleted already, there was no actual error.
          deleted = false;
          deleteError = null;
          deleteResponse.isSuccessful = true;
        }

        callback(deleteError, deleted, deleteResponse);
      });
    }
  });
};

/**
* Downloads a file into a text string.
*
* @this {FileService}
* @param {string}             share                           						The share name.
* @param {string}             directory                                   The directory name. Use '' to refer to the base directory.
* @param {string}             file                                        The file name. File names may not start or end with the delimiter '/'.
* @param {object}             [options]                                   The request options.
* @param {int}                [options.rangeStart]                        The range start.
* @param {int}                [options.rangeEnd]                          The range end.
* @param {boolean}            [options.disableContentMD5Validation]       When set to true, MD5 validation will be disabled when downloading files.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to. 
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {FileService~FileToText}  callback                               `error` will contain information
*                                                                         if an error occurs; otherwise `text` will contain the file contents,
*                                                                         and `file` will contain the file information.
*                                                                         `response` will contain information related to this operation.
*/
FileService.prototype.getFileToText = function (share, directory, file, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('getFileToText', function (v) {
  	v.string(share, 'share');
    v.stringAllowEmpty(directory, 'directory');
    v.string(file, 'file');
    v.shareNameIsValid(share);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  var resourceName = createResourceName(share, directory, file);
  var webResource = WebResource.get(resourceName)
    .withRawResponse();

  FileResult.setHeaders(webResource, options);
  this._setRangeContentMD5Header(webResource, options);
  //options.requestLocationMode = Constants.RequestLocationMode.PRIMARY_OR_SECONDARY;

  var self = this;
  var processResponseCallback = function (responseObject, next) {
    responseObject.text = null;
    responseObject.fileResult = null;

    if (!responseObject.error) {
      responseObject.fileResult = new FileResult(share, directory, file);
      responseObject.fileResult.getPropertiesFromHeaders(responseObject.response.headers, true);
      responseObject.fileResult.metadata = self.parseMetadataHeaders(responseObject.response.headers);
      responseObject.text = responseObject.response.body;

      self._validateLengthAndMD5(options, responseObject);
    }

    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.text, returnObject.fileResult, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};


/**
* Downloads a file into a file.
*
* @this {FileService}
* @param {string}             share                           						The share name.
* @param {string}             directory                                   The directory name. Use '' to refer to the base directory.
* @param {string}             file                                        The file name. File names may not start or end with the delimiter '/'.
* @param {string}             localFileName                               The local path to the file to be downloaded.
* @param {object}             [options]                                   The request options.
* @param {string}             [options.rangeStart]                        Return only the bytes of the file in the specified range.
* @param {string}             [options.rangeEnd]                          Return only the bytes of the file in the specified range.
* @param {boolean}            [options.useTransactionalMD5]               When set to true, Calculate and send/validate content MD5 for transactions.
* @param {boolean}            [options.disableContentMD5Validation]       When set to true, MD5 validation will be disabled when downloading files.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to. 
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResult}  callback                                        `error` will contain information if an error occurs; 
*                                                                         otherwise `result` will contain the file information.
*                                                                         `response` will contain information related to this operation.
* @example
* var azure = require('azure-storage');
* var FileService = azure.createFileService();
* FileService.getFileToLocalFile('taskshare', taskdirectory', 'task1', 'task1-download.txt', function(error, serverFile) {
*   if(!error) {
*     // file available in serverFile.file variable
*   }
*/
FileService.prototype.getFileToLocalFile = function (share, directory, file, localFileName, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('getFileToLocalFile', function (v) {
  	v.string(share, 'share');
    v.stringAllowEmpty(directory, 'directory');
    v.string(file, 'file');
    v.string(localFileName, 'localFileName');
    v.shareNameIsValid(share);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);

  var writeStream = fs.createWriteStream(localFileName);

  this.getFileToStream(share, directory, file, writeStream, options, function (error, responseFile, response) {
    if (error) {
      // make sure writeStream is closed / destroyed to avoid locking issues
      if (writeStream.close) {
        writeStream.close();
      }

      if (azureutil.pathExistsSync(localFileName)) {
        // If the download failed from the beginning, remove the file.
        fs.unlink(localFileName, function () {
          callback(error, responseFile, response);
          return;
        });
      }
    }
    callback(error, responseFile, response); 
  });
};

/**
* Provides a stream to read from a file.
*
* @this {FileService}
* @param {string}             share                           						The share name.
* @param {string}             directory                                   The directory name. Use '' to refer to the base directory.
* @param {string}             file                                        The file name. File names may not start or end with the delimiter '/'.
* @param {object}             [options]                                   The request options.
* @param {string}             [options.rangeStart]                        Return only the bytes of the file in the specified range.
* @param {string}             [options.rangeEnd]                          Return only the bytes of the file in the specified range.
* @param {boolean}            [options.useTransactionalMD5]               When set to true, Calculate and send/validate content MD5 for transactions.
* @param {boolean}            [options.disableContentMD5Validation]       When set to true, MD5 validation will be disabled when downloading files.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to. 
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResult}  callback                                        `error` will contain information if an error occurs; 
*                                                                         otherwise `result` will contain the file information.
*                                                                         `response` will contain information related to this operation.
* @return {Stream}
* @example
* var azure = require('azure-storage');
* var fileService = azure.createFileService();
* var writable = fs.createWriteStream(destinationFileNameTarget);
* fileService.createReadStream(shareName, directoryName, fileName).pipe(writable);
*/
FileService.prototype.createReadStream = function (share, directory, file, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('createReadStream', function (v) {
  	v.string(share, 'share');
    v.stringAllowEmpty(directory, 'directory');
    v.string(file, 'file');
    v.shareNameIsValid(share);
  });

  var options = extend(true, {}, userOptions);

  var readStream = new ChunkStream(options);
  this.getFileToStream(share, directory, file, readStream, options, function (error, fileResponse, response) {
    if(error) {
      readStream.emit('error', error);
    }

    if(callback) {
      callback(error, fileResponse, response);
    }
  });

  return readStream;
};

/**
* Downloads a file into a stream.
*
* @this {FileService}
* @param {string}             share                           						The share name.
* @param {string}             directory                                   The directory name. Use '' to refer to the base directory.
* @param {string}             file                                        The file name. File names may not start or end with the delimiter '/'.
* @param {Stream}             writeStream                                 The write stream.
* @param {object}             [options]                                   The request options.
* @param {string}             [options.rangeStart]                        Return only the bytes of the file in the specified range.
* @param {string}             [options.rangeEnd]                          Return only the bytes of the file in the specified range. 
* @param {boolean}            [options.useTransactionalMD5]               When set to true, Calculate and send/validate content MD5 for transactions.
* @param {boolean}            [options.disableContentMD5Validation]       When set to true, MD5 validation will be disabled when downloading files.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to. 
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResult}  callback                                        `error` will contain information if an error occurs; 
*                                                                         otherwise `result` will contain the file information.
*                                                                         `response` will contain information related to this operation.
*
* @example
* var azure = require('azure-storage');
* var FileService = azure.createFileService();
* FileService.getFileToStream('taskshare', taskdirectory', 'task1', fs.createWriteStream('task1-download.txt'), function(error, serverFile) {
*   if(!error) {
*     // file available in serverFile.file variable
*   }
* }); 
*/
FileService.prototype.getFileToStream = function (share, directory, file, writeStream, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('getFileToStream', function (v) {
  	v.string(share, 'share');
    v.stringAllowEmpty(directory, 'directory');
    v.string(file, 'file');
    v.object(writeStream, 'writeStream');
    v.shareNameIsValid(share);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);

  var resourceName = createResourceName(share, directory, file);
  var webResource = WebResource.get(resourceName)
    .withRawResponse();

  FileResult.setHeaders(webResource, options);
  this._setRangeContentMD5Header(webResource, options);
  //options.requestLocationMode = Constants.RequestLocationMode.PRIMARY_OR_SECONDARY;

  var self = this;
  var processResponseCallback = function (responseObject, next) {
    responseObject.fileResult = null;

    if (!responseObject.error) {
      responseObject.fileResult = new FileResult(directory, file);
      responseObject.fileResult.metadata = self.parseMetadataHeaders(responseObject.response.headers);
      responseObject.fileResult.getPropertiesFromHeaders(responseObject.response.headers, true);

      self._validateLengthAndMD5(options, responseObject);
    }

    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.fileResult, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequestInputStream(webResource, null, writeStream, options, processResponseCallback);
};

/**
* Lists file ranges. Lists all of the ranges by default, or only the ranges over a specific range of bytes if rangeStart and rangeEnd are specified.
*
* @this {FileService}
* @param {string}             share                           						The share name.
* @param {string}             directory                           				The directory name. Use '' to refer to the base directory.
* @param {string}             file                                				The file name. File names may not start or end with the delimiter '/'.
* @param {object}             [options]                                   The request options.
* @param {int}                [options.rangeStart]                        The range start.
* @param {int}                [options.rangeEnd]                          The range end.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to. 
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResult}  callback                                        `error` will contain information
*                                                                         if an error occurs; otherwise `result` will contain
*                                                                         the range information.
*                                                                         `response` will contain information related to this operation.
*/
FileService.prototype.listRanges = function (share, directory, file, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('listRanges', function (v) {
  	v.string(share, 'share');
    v.stringAllowEmpty(directory, 'directory');
    v.string(file, 'file');
    v.shareNameIsValid(share);
    v.callback(callback);
  });

  var resourceName = createResourceName(share, directory, file);
  var options = extend(true, {}, userOptions);
  var webResource = WebResource.get(resourceName)
    .withQueryOption(QueryStringConstants.COMP, 'rangelist');

  //options.requestLocationMode = RequestLocationMode.PRIMARY_OR_SECONDARY;

  FileResult.setHeaders(webResource, options);

  var processResponseCallback = function (responseObject, next) {
    responseObject.ranges = null;
    if (!responseObject.error) {
      responseObject.ranges = [];

      var ranges = [];
      if (responseObject.response.body.Ranges.Range) {
        ranges = responseObject.response.body.Ranges.Range;

        if (!_.isArray(ranges)) {
          ranges = [ ranges ];
        }
      }

      ranges.forEach(function (fileRange) {
        var range = {
          start: parseInt(fileRange.Start, 10),
          end: parseInt(fileRange.End, 10)
        };

        responseObject.ranges.push(range);
      });
    }

    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.ranges, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

/**
* Clears a range. Clears all of the ranges by default, or only the ranges over a specific range of bytes if rangeStart and rangeEnd are specified.
*
* @this {FileService}
* @param {string}             share                           						The share name.
* @param {string}             directory                                   The directory name. Use '' to refer to the base directory.
* @param {string}             file                                        The file name. File names may not start or end with the delimiter '/'.
* @param {int}                rangeStart                                  The range start.
* @param {int}                rangeEnd                                    The range end.
* @param {object}             [options]                                   The request options.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to. 
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResult}  callback                                				`error` will contain information
*                                                                     		if an error occurs; otherwise `result` will contain
*                                                                       	the directory information.
*                                                                        `response` will contain information related to this operation.
*/
FileService.prototype.clearRange = function (share, directory, file, rangeStart, rangeEnd, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('clearRange', function (v) {
  	v.string(share, 'share');
    v.stringAllowEmpty(directory, 'directory');
    v.string(file, 'file');
    v.shareNameIsValid(share);
    v.value(rangeStart);
    v.value(rangeEnd);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  var request = this._updateFilesImpl(share, directory, file, rangeStart, rangeEnd, FileConstants.RangeWriteOptions.CLEAR, options);

  var processResponseCallback = function(responseObject, next) {
    responseObject.fileResult = null;
    if (!responseObject.error) {
      responseObject.fileResult = new FileResult(share, directory, file);
      responseObject.fileResult.getPropertiesFromHeaders(responseObject.response.headers);
    }
    
    var finalCallback = function(returnObject) {
      callback(returnObject.error, returnObject.fileResult, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(request, null, options, processResponseCallback);
};

/**
* Updates a range from a stream.
*
* @this {FileService}
* @param {string}             share                                       The share name.
* @param {string}             directory                                   The directory name. Use '' to refer to the base directory.
* @param {string}             file                                        The file name. File names may not start or end with the delimiter '/'.
* @param {Stream}             readStream                                  The read stream.
* @param {int}                rangeStart                                  The range start.
* @param {int}                rangeEnd                                    The range end.
* @param {object}             [options]                                   The request options.
* @param {bool}               [options.useTransactionalMD5]               Calculate and send/validate content MD5 for transactions.
* @param {string}             [options.contentMD5]                        An optional hash value used to ensure transactional integrity for the page. 
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to. 
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResult}  callback                                        `error` will contain information
*                                                                         if an error occurs; otherwise `result` will contain
*                                                                         the file information.
*                                                                         `response` will contain information related to this operation.
*/
FileService.prototype.createRangesFromStream = function (share, directory, file, readStream, rangeStart, rangeEnd, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('createRangesFromStream', function (v) {
    v.string(share, 'share');
    v.stringAllowEmpty(directory, 'directory');
    v.string(file, 'file');
    v.object(readStream, 'readStream');
    v.shareNameIsValid(share);
    v.value(rangeStart);
    v.value(rangeEnd);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  var requiresContentMD5 = azureutil.objectIsNull(options.contentMD5) && options.useTransactionalMD5 === true;

  var length = (rangeEnd - rangeStart) + 1
  if(length > FileConstants.MAX_UPDATE_FILE_SIZE) {
    throw new Error(SR.INVALID_FILE_RANGE_FOR_UPDATE);
  }

  var self = this;
  if (requiresContentMD5) {
    azureutil.calculateMD5(readStream, length, options, function(internalBuff) {
      self._createRanges(share, directory, file, internalBuff, null /* stream */, rangeStart, rangeEnd, options, callback);
    });
  } else {
    self._createRanges(share, directory, file, null /* text */, readStream, rangeStart, rangeEnd, options, callback);
  }
};

/**
* Uploads a file from a text string.
*
* @this {FileService}
* @param {string}             share                           						The share name.
* @param {string}             directory                                   The directory name. Use '' to refer to the base directory.
* @param {string}             file                                        The file name. File names may not start or end with the delimiter '/'.
* @param {string|object}      text                                        The file text, as a string or in a Buffer.
* @param {object}             [options]                                   The request options.
* @param {SpeedSummary}       [options.speedSummary]                      The download tracker objects;
* @param {object}             [options.metadata]                          The metadata key/value pairs.
* @param {bool}               [options.storeFileContentMD5]                   Specifies whether the file's ContentMD5 header should be set on uploads. 
*                                                                         The default value is false for files.
* @param {bool}               [options.useTransactionalMD5]               Calculate and send/validate content MD5 for transactions.
* @param {string}             [options.contentType]                       The MIME content type of the file. The default type is application/octet-stream.
* @param {string}             [options.contentEncoding]                   The content encodings that have been applied to the file.
* @param {string}             [options.contentLanguage]                   The natural languages used by this resource.
* @param {string}             [options.contentMD5]                        The MD5 hash of the file content.
* @param {string}             [options.cacheControl]                      The file service stores this value but does not use or modify it.
* @param {string}             [options.contentDisposition]                The file's content disposition. (x-ms-File-content-disposition)
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to. 
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {FileService~FileToText}  callback                               `error` will contain information
*                                                                         if an error occurs; otherwise `text` will contain the file contents,
*                                                                         and `file` will contain the file information.
*                                                                         `response` will contain information related to this operation.
*/
FileService.prototype.createFileFromText = function (share, directory, file, text, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('createFileFromText', function (v) {
  	v.string(share, 'share');
    v.stringAllowEmpty(directory, 'directory');
    v.string(file, 'file');
    v.exists(text, 'text');
    v.shareNameIsValid(share);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);

  var length = Buffer.isBuffer(text) ? text.length : Buffer.byteLength(text);
  if (length > FileConstants.MAX_UPDATE_FILE_SIZE) {
    throw new Error(SR.INVALID_FILE_LENGTH);
  }

  if(options.storeFileContentMD5 && azureutil.objectIsNull(options.contentMD5)) {
     options.contentMD5 = azureutil.getContentMd5(text);
  }

  var self = this;
  this.createFile(share, directory, file, length, options, function(error) {
    if(error) {
      callback(error);
    }
    else {
      self._createRanges(share, directory, file, text, null, 0, length - 1, options, callback);
    }
  });
};

/**
* Uploads a file to storage from a local file.
*
* @this {FileService}
* @param {string}             share                                       The share name.
* @param {string}             directory                                   The directory name. Use '' to refer to the base directory.
* @param {string}             file                                        The file name. File names may not start or end with the delimiter '/'.
* @param (string)             localFileName                               The local path to the file to be uploaded.
* @param {object}             [options]                                   The request options.
* @param {SpeedSummary}       [options.speedSummary]                      The download tracker objects;
* @param {object}             [options.metadata]                          The metadata key/value pairs.
* @param {bool}               [options.storeFileContentMD5]               Specifies whether the file's ContentMD5 header should be set on uploads. 
*                                                                         The default value is false for files.
* @param {bool}               [options.useTransactionalMD5]               Calculate and send/validate content MD5 for transactions.
* @param {string}             [options.contentType]                       The MIME content type of the file. The default type is application/octet-stream.
* @param {string}             [options.contentEncoding]                   The content encodings that have been applied to the file.
* @param {string}             [options.contentLanguage]                   The natural languages used by this resource.
* @param {string}             [options.contentMD5]                        The MD5 hash of the file content.
* @param {string}             [options.cacheControl]                      The file service stores this value but does not use or modify it.
* @param {string}             [options.contentDisposition]                The file's content disposition. (x-ms-File-content-disposition)
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to. 
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResult}  callback                                        The callback function.
* @return {SpeedSummary}
*/
FileService.prototype.createFileFromLocalFile = function (share, directory, file, localFileName, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('createFileFromLocalFile', function (v) {
    v.string(share, 'share');
    v.stringAllowEmpty(directory, 'directory');
    v.string(file, 'file');
    v.string(localFileName, 'localFileName');
    v.shareNameIsValid(share);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  options.speedSummary = options.speedSummary || new SpeedSummary(file);

  var self = this;
  fs.stat(localFileName, function(error, stat) {
    if (error) {
      callback(error);
    } else {
      self.createFile(share, directory, file, stat.size, options, function(error) {
        if(error) {
          callback(error);
        } else {
          var stream = new FileReadStream(localFileName, {calcContentMd5: options.storeFileContentMD5});
          self._createFileFromChunkStream(share, directory, file, stream, stat.size, options, callback);
        }
      });
    }
  });

  return options.speedSummary;
};

/**
* Uploads a file from a stream.
*
* @this {FileService}
* @param {string}             share                           						The share name.
* @param {string}             directory                                   The directory name. Use '' to refer to the base directory.
* @param {string}             file                                        The file name. File names may not start or end with the delimiter '/'. 
* @param (Stream)             stream                                      Stream to the data to store.
* @param {int}                streamLength                                The length of the stream to upload.
* @param {object}             [options]                                   The request options.
* @param {SpeedSummary}       [options.speedSummary]                      The download tracker objects;
* @param {object}             [options.metadata]                          The metadata key/value pairs.
* @param {bool}               [options.storeFileContentMD5]               Specifies whether the file's ContentMD5 header should be set on uploads. 
*                                                                         The default value is false for files.
* @param {bool}               [options.useTransactionalMD5]               Calculate and send/validate content MD5 for transactions.
* @param {string}             [options.contentType]                       The MIME content type of the file. The default type is application/octet-stream.
* @param {string}             [options.contentEncoding]                   The content encodings that have been applied to the file.
* @param {string}             [options.contentLanguage]                   The natural languages used by this resource.
* @param {string}             [options.contentMD5]                        The MD5 hash of the file content.
* @param {string}             [options.cacheControl]                      The file service stores this value but does not use or modify it.
* @param {string}             [options.contentDisposition]                The file's content disposition. (x-ms-File-content-disposition)
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to. 
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResult}  callback                                        The callback function.
* @return {SpeedSummary}
*/
FileService.prototype.createFileFromStream = function(share, directory, file, stream, streamLength, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('createFileFromStream', function (v) {
  	v.string(share, 'share');
    v.stringAllowEmpty(directory, 'directory');
    v.string(file, 'file');
    v.object(stream, 'stream');
    v.value(streamLength, 'streamLength');
    v.shareNameIsValid(share);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  options.speedSummary = options.speedSummary || new SpeedSummary(file);

  stream.pause();	// Immediately pause the stream in order to compatible with Node v0.8

  var self = this;
  this.createFile(share, directory, file, streamLength, options, function(error) {
    if(error) {
      callback(error);
    } else {
      var chunkStream = new ChunkStreamWithStream(stream, {calcContentMd5: options.storeFileContentMD5});
      self._createFileFromChunkStream(share, directory, file, chunkStream, streamLength, options, callback);
    }
  });

  return options.speedSummary;
};

/**
* Provides a stream to write to a file. Assumes that the file exists. 
* If it does not, please create the file using createFile before calling this method or use createWriteStreamNewFile.
*
* @this {FileService}
* @param {string}             share                                       The share name.
* @param {string}             directory                                   The directory name. Use '' to refer to the base directory.
* @param {string}             file                                        The file name. File names may not start or end with the delimiter '/'.
* @param {object}             [options]                                   The request options.
* @param {SpeedSummary}       [options.speedSummary]                      The download tracker objects;
* @param {object}             [options.metadata]                          The metadata key/value pairs.
* @param {bool}               [options.storeFileContentMD5]               Specifies whether the file's ContentMD5 header should be set on uploads. 
*                                                                         The default value is false for files.
* @param {bool}               [options.useTransactionalMD5]               Calculate and send/validate content MD5 for transactions.
* @param {string}             [options.contentType]                       The MIME content type of the file. The default type is application/octet-stream.
* @param {string}             [options.contentEncoding]                   The content encodings that have been applied to the file.
* @param {string}             [options.contentLanguage]                   The natural languages used by this resource.
* @param {string}             [options.contentMD5]                        The MD5 hash of the file content.
* @param {string}             [options.cacheControl]                      The file service stores this value but does not use or modify it.
* @param {string}             [options.contentDisposition]                The file's content disposition. (x-ms-File-content-disposition)
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to. 
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResult}  callback                                        The callback function.
* @return {Stream}
* @example
* var azure = require('azure-storage');
* var FileService = azure.createFileService();
* FileService.createFile(shareName, directoryName, fileName, 1024, function (err) {
*   // Pipe file to a file
*   var stream = fs.createReadStream(fileNameTarget).pipe(FileService.createWriteStreamToExistingFile(shareName, directoryName, fileName));
* });
*/
FileService.prototype.createWriteStreamToExistingFile = function (share, directory, file, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('createWriteStreamToExistingFile', function (v) {
    v.string(share, 'share');
    v.stringAllowEmpty(directory, 'directory');
    v.string(file, 'file');
    v.shareNameIsValid(share);
  });

  var options = extend(true, {}, userOptions);

  var stream = new ChunkStream({calcContentMd5: options.storeFileContentMD5});
  this._createFileFromChunkStream(share, directory, file, stream, null, options, function (error, file, response) {
    if(error) {
      stream.emit('error', error);
    }

    if (callback) {
      callback(error, file, response);
    }
  });

  return stream;
};

/**
* Provides a stream to write to a file. Creates the file before writing data.
*
* @this {FileService}
* @param {string}             share                                       The share name.
* @param {string}             directory                                   The directory name. Use '' to refer to the base directory.
* @param {string}             file                                        The file name. File names may not start or end with the delimiter '/'.
* @param {string}             length                                      The file length.
* @param {object}             [options]                                   The request options.
* @param {SpeedSummary}       [options.speedSummary]                      The download tracker objects;
* @param {object}             [options.metadata]                          The metadata key/value pairs.
* @param {bool}               [options.storeFileContentMD5]               Specifies whether the file's ContentMD5 header should be set on uploads. 
*                                                                         The default value is false for files.
* @param {bool}               [options.useTransactionalMD5]               Calculate and send/validate content MD5 for transactions.
* @param {string}             [options.contentType]                       The MIME content type of the file. The default type is application/octet-stream.
* @param {string}             [options.contentEncoding]                   The content encodings that have been applied to the file.
* @param {string}             [options.contentLanguage]                   The natural languages used by this resource.
* @param {string}             [options.contentMD5]                        The MD5 hash of the file content.
* @param {string}             [options.cacheControl]                      The file service stores this value but does not use or modify it.
* @param {string}             [options.contentDisposition]                The file's content disposition. (x-ms-File-content-disposition)
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to. 
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResult}  callback                                        The callback function.
* @param {errorOrResponse}  callback                                      The callback function.
* @return {Stream}
* @example
* var azure = require('azure-storage');
* var FileService = azure.createFileService();
* var stream = fs.createReadStream(fileNameTarget).pipe(FileService.createWriteStreamToNewFile(shareName, directoryName, fileName));
*/
FileService.prototype.createWriteStreamToNewFile = function (share, directory, file, length, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('createWriteStreamToNewFile', function (v) {
    v.string(share, 'share');
    v.stringAllowEmpty(directory, 'directory');
    v.string(file, 'file');
    v.value(length, 'length');
    v.shareNameIsValid(share);
  });

  var options = extend(true, {}, userOptions);

  var stream = new ChunkStream({calcContentMd5: options.storeFileContentMD5});
  stream.pause();
  
  var self = this;
  this.createFile(share, directory, file, length, options, function(error) {
    if(error) {
      stream.emit('error', error);
      callback(error);
    }
    else {
      stream.resume();
      self._createFileFromChunkStream(share, directory, file, stream, null, options, function (error, file, response) {
        if(error) {
          stream.emit('error', error);
        }

        if (callback) {
          callback(error, file, response);
        }
      });
    }
  });
  
  return stream;
};

// Internal Methods

/**
* Updates a file from text.
* @ignore
*
* @this {FileService}
* @param {string}             share                                       The share name.
* @param {string}             directory                                   The directory name. Use '' to refer to the base directory.
* @param {string}             file                                        The file name. File names may not start or end with the delimiter '/'.
* @param {string}             text                                        The text string.
* @param {Stream}             readStream                                  The read stream.
* @param {int}                rangeStart                                  The range start.
* @param {int}                rangeEnd                                    The range end.
* @param {object}             [options]                                   The request options.
* @param {bool}               [options.useTransactionalMD5]               Calculate and send/validate content MD5 for transactions.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to. 
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {Function(error, file, response)}  callback                      `error` will contain information
*                                                                         if an error occurs; otherwise `file` will contain
*                                                                         the file information.
*                                                                         `response` will contain information related to this operation.
*/
FileService.prototype._createRanges = function (share, directory, file, text, readStream, rangeStart, rangeEnd, options, callback) {
  var request = this._updateFilesImpl(share, directory, file, rangeStart, rangeEnd, FileConstants.RangeWriteOptions.UPDATE, options);

  // At this point, we have already validated that the range is less than 4MB. Therefore, we just need to calculate the contentMD5 if required.
  if(!azureutil.objectIsNull(text) && azureutil.objectIsNull(options.contentMD5) && options.useTransactionalMD5 === true) {
    request.withHeader(HeaderConstants.CONTENT_MD5, azureutil.getContentMd5(text));
  }

  var processResponseCallback = function (responseObject, next) {
    responseObject.fileResult = null;
    if (!responseObject.error) {
      responseObject.fileResult = new FileResult(share, directory, file);
      responseObject.fileResult.getPropertiesFromHeaders(responseObject.response.headers);
    }

    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.fileResult, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  if(!azureutil.objectIsNull(text)) {
    this.performRequest(request, text, options, processResponseCallback);
  } else {
    this.performRequestOutputStream(request, readStream, options, processResponseCallback);
  }
};

/**
* Uploads a file from a stream.
* @ignore
*
* @this {FileService}
* @param {string}             share                                       The share name.
* @param {string}             directory                                   The directory name. Use '' to refer to the base directory.
* @param {string}             file                                        The file name. File names may not start or end with the delimiter '/'.
* @param (Stream)             stream                                      Stream to the data to store.
* @param {int}                streamLength                                The length of the stream to upload.
* @param {object|function}    [options]                                   The request options.
* @param {SpeedSummary}       [options.speedSummary]                      The download tracker objects;
* @param {int}                [options.parallelOperationThreadCount]      Parallel operation thread count
* @param {bool}               [options.useTransactionalMD5]               Calculate and send/validate content MD5 for transactions.
* @param {object}             [options.metadata]                          The metadata key/value pairs.
* @param {bool}               [options.storeFileContentMD5]               Specifies whether the file's ContentMD5 header should be set on uploads.
* @param {string}             [options.contentType]                       The MIME content type of the file. The default type is application/octet-stream.
* @param {string}             [options.contentEncoding]                   The content encodings that have been applied to the file.
* @param {string}             [options.contentLanguage]                   The natural languages used by this resource.
* @param {string}             [options.contentMD5]                        The MD5 hash of the file content.
* @param {string}             [options.cacheControl]                      The file service stores this value but does not use or modify it.
* @param {string}             [options.contentDisposition]                The file's content disposition.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to. 
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {function(error, null)}  callback                                The callback function.
* @return {SpeedSummary}
*/

FileService.prototype._createFileFromChunkStream = function(share, directory, file, chunkStream, streamLength, options, callback) {
  this.logger.debug(util.format('_createFileFromChunkStream for file %s', file));

  var apiName = '_createRanges';
  var sizeLimitation = FileConstants.DEFAULT_WRITE_SIZE_IN_BYTES;
  var originalContentMD5 = options.contentMD5;

  this._setOperationExpiryTime(options);

  // initialize the speed summary
  var speedSummary = options.speedSummary || new SpeedSummary;
  speedSummary.totalSize = streamLength;

  var parallelOperationThreadCount = options.parallelOperationThreadCount || this.parallelOperationThreadCount;

  // initialize chunk allocator
  var allocator = new ChunkAllocator(sizeLimitation, options.parallelOperationThreadCount, { logger: this.logger });

  // if this is a FileReadStream, set the allocator on that stream
  if (chunkStream._stream && chunkStream._stream.setMemoryAllocator) {
    chunkStream._stream.setMemoryAllocator(allocator);
  }

  // initialize batch operations
  var batchOperations = new BatchOperation(apiName, { logger : this.logger });
  batchOperations.setConcurrency(parallelOperationThreadCount);

  // initialize options
  var rangeOptions = {
    timeoutIntervalInMs: options.timeoutIntervalInMs,
    operationExpiryTime: options.operationExpiryTime
  };

  var self = this;
  chunkStream.on('data', function (data, range) {
    var operation = null;
    var full = false;
    var autoIncrement = speedSummary.getAutoIncrementFunction(data.length);

    if(data.length > sizeLimitation) {
      throw new Error(util.format(SR.EXCEEDED_SIZE_LIMITATION, sizeLimitation, data.length));
    }

    if (options.useTransactionalMD5) {
      //calculate content md5 for the current uploading block data
      var contentMD5 = azureutil.getContentMd5(data);
      rangeOptions.contentMD5 = contentMD5;
    }

    if (azureutil.isBufferAllZero(data)) {
      self.logger.debug(util.format('Skip upload data from %s bytes to %s bytes to file %s', range.start, range.end, file));
      speedSummary.increment(data.length);
    } else {
      operation = new BatchOperation.RestOperation(self, apiName, share, directory, file, data, null, range.start, range.end, rangeOptions, function (error) {
        if(!error) {
          autoIncrement();
        }
        allocator.releaseBuffer(data);
        data = null;
      });
    }

    if (operation) {
      full = batchOperations.addOperation(operation);
      operation = null;

      if(full) {
        self.logger.debug('file stream paused');
        chunkStream.pause();
      }
    }
  });

  chunkStream.on('end', function () {
    self.logger.debug(util.format('File read stream ended for file %s', file));
    batchOperations.enableComplete();
  });

  batchOperations.on('drain', function () {
    self.logger.debug('File stream resume');
    chunkStream.resume();
  });

  batchOperations.on('end', function (error) {
    self.logger.debug('batch operations commited');
 
    if (error) {
      callback(error);
      return;
    }

    if (originalContentMD5) {
      options.contentMD5 = originalContentMD5;
    } else if (options.storeFileContentMD5) {
      options.contentMD5 = chunkStream.getContentMd5('base64');
    }

    // upload file completely
    self.setFileProperties(share, directory, file, options, function (error, file, response) {
      chunkStream.finish();
      callback(error, file, response);
    });
  });

  return speedSummary;
};

/**
* @ignore
*/
FileService.prototype._setRangeContentMD5Header = function (webResource, options) {
  if(!azureutil.objectIsNull(options.rangeStart) && options.useTransactionalMD5) {
    if(azureutil.objectIsNull(options.rangeEnd)) {
      throw new Error(util.format(SR.ARGUMENT_NULL_OR_EMPTY, options.rangeEndHeader));
    }

    var size = parseInt(options.rangeEnd, 10) - parseInt(options.rangeStart, 10) + 1;
    if (size > FileConstants.MAX_RANGE_GET_SIZE_WITH_MD5) {
      throw new Error(SR.INVALID_RANGE_FOR_MD5);
    } else {
      webResource.withHeader(HeaderConstants.RANGE_GET_CONTENT_MD5, 'true');
    }
  }
};

/**
* @ignore
*/
FileService.prototype._updateFilesImpl = function (share, directory, file, rangeStart, rangeEnd, writeMethod, options) {
  var resourceName = createResourceName(share, directory, file);
  var webResource = WebResource.put(resourceName)
    .withQueryOption(QueryStringConstants.COMP, 'range')
		.withHeader(HeaderConstants.CONTENT_TYPE, 'application/octet-stream')
  	.withHeader(HeaderConstants.FILE_WRITE, writeMethod);

  options.rangeStart = rangeStart;
  options.rangeEnd = rangeEnd;

  FileResult.setHeaders(webResource, options); 

  if(writeMethod === FileConstants.RangeWriteOptions.UPDATE) {
  	var size = (rangeEnd - rangeStart) + 1;
    webResource.withHeader(HeaderConstants.CONTENT_LENGTH, size);
  } else {
    webResource.withHeader(HeaderConstants.CONTENT_LENGTH, 0);
  }

  return webResource;
};

/**
* @ignore
*/
FileService.prototype._validateLengthAndMD5 = function (options, responseObject) {
  var storedMD5 = responseObject.response.headers[Constants.HeaderConstants.CONTENT_MD5];
  var contentLength;

  if (!azureutil.objectIsNull(responseObject.response.headers[Constants.HeaderConstants.CONTENT_LENGTH])) {
    contentLength = parseInt(responseObject.response.headers[Constants.HeaderConstants.CONTENT_LENGTH], 10);
  }

  // If the user has not specified this option, the default value should be false.
  if(azureutil.objectIsNull(options.disableContentMD5Validation)) {
    options.disableContentMD5Validation = false;
  }

  // None of the below cases should be retried. So set the error in every case so the retry policy filter handle knows that it shouldn't be retried.
  if (options.disableContentMD5Validation === false && options.useTransactionalMD5 === true && azureutil.objectIsNull(storedMD5)) {
    responseObject.error = new Error(SR.MD5_NOT_PRESENT_ERROR);
    responseObject.retryable = false;
  }

  // Validate length and if required, MD5.
  // If getFileToText called this method, then the responseObject.length and responseObject.contentMD5 are not set. Calculate them first using responseObject.response.body and then validate.
  if(azureutil.objectIsNull(responseObject.length)) {
    responseObject.length = Buffer.byteLength(responseObject.response.body);
  }

  if(!azureutil.objectIsNull(contentLength) && responseObject.length !== contentLength) {
    responseObject.error = new Error(SR.CONTENT_LENGTH_MISMATCH);
    responseObject.retryable = false;
  }

  if(options.disableContentMD5Validation === false && azureutil.objectIsNull(responseObject.contentMD5)) {
    responseObject.contentMD5 = azureutil.getContentMd5(responseObject.response.body);
  }

  if (options.disableContentMD5Validation === false && !azureutil.objectIsNull(storedMD5) && storedMD5 !== responseObject.contentMD5) {
    responseObject.error = new Error(util.format(SR.HASH_MISMATCH, storedMD5, responseObject.contentMD5));
    responseObject.retryable = false;
  }
};

/**
* The callback for if exists methods.
* @ignore
*
* @param {string}             responseObject                               The object returned by the service.
* @param {string}             next                                         The next function to call.
*/
function getExistsResponseCallback (callback) {
  var existsResponseCallback = function (responseObject, next) {
    if(!responseObject.error){
      responseObject.exists = true;
    } else if (responseObject.error && responseObject.error.statusCode === Constants.HttpConstants.HttpResponseCodes.NotFound) {
      responseObject.error = null;
      responseObject.exists = false;
      responseObject.response.isSuccessful = true;
    }

    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.exists, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  return existsResponseCallback;
};


/**
* Checks whether or not a file exists on the service.
* @ignore
*
* @this {FileService}
* @param {string}             share                                             The share name.
* @param {string}             directory                                         The directory name. Use '' to refer to the base directory.
* @param {string}             file                                              The file name. File names may not start or end with the delimiter '/'.
* @param {string}             primaryOnly                                       If true, the request will be executed against the primary storage location.
* @param {object}             [options]                                         The request options.
* @param {LocationMode}       [options.locationMode]                            Specifies the location mode used to decide which location the request should be sent to. 
*                                                                               Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]                     The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]                The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                               The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                               execution time is checked intermittently while performing requests, and before executing retries.
* @param {Function(error, fileExists, response)}  callback                      `error` will contain information
*                                                                               if an error occurs; otherwise `FileExists` will 
*                                                                               be true if the file exists, or false if the file does not exist. 
*                                                                               `response` will contain information related to this operation.
*/
FileService.prototype._doesFileExist = function (share, directory, file, primaryOnly, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('FileExists', function (v) {
    v.string(share, 'share');
    v.stringAllowEmpty(directory, 'directory');
    v.string(file, 'file');
    v.shareNameIsValid(share);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);

  var resourceName = createResourceName(share, directory, file);
  var webResource = WebResource.head(resourceName);

  /*if(primaryOnly === false) {
    options.requestLocationMode = RequestLocationMode.PRIMARY_OR_SECONDARY;
  }*/

  this.performRequest(webResource, null, options, getExistsResponseCallback(callback));
};

/**
* Checks whether or not a directory exists on the service.
* @ignore
*
* @this {FileService}
* @param {string}             share                                             The share name.
* @param {string}             directory                                         The directory name. Use '' to refer to the base directory.
* @param {string}             primaryOnly                                       If true, the request will be executed against the primary storage location.
* @param {object}             [options]                                         The request options.
* @param {LocationMode}       [options.locationMode]                            Specifies the location mode used to decide which location the request should be sent to. 
*                                                                               Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]                     The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]                The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                               The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                               execution time is checked intermittently while performing requests, and before executing retries.
* @param {Function(error, directoryExists, response)}  callback                 `error` will contain information
*                                                                               if an error occurs; otherwise `directoryExists` will contain
*                                                                               be true if the directory exists, or false if the directory does not exist. 
*                                                                               `response` will contain information related to this operation.
*/
FileService.prototype._doesDirectoryExist = function (share, directory, primaryOnly, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('directoryExists', function (v) {
    v.string(share, 'share');
    v.stringAllowEmpty(directory, 'directory');
    v.shareNameIsValid(share);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  var webResource = WebResource.head(createResourceName(share, directory))
    .withQueryOption(QueryStringConstants.RESTYPE, 'directory');

  /*if(primaryOnly === false) {
    options.requestLocationMode = RequestLocationMode.PRIMARY_OR_SECONDARY;
  }*/

  this.performRequest(webResource, null, options, getExistsResponseCallback(callback));
};

/**
* Checks whether or not a share exists on the service.
* @ignore
*
* @this {FileService}
* @param {string}             share                                   The share name.
* @param {string}             primaryOnly                             If true, the request will be executed against the primary storage location.
* @param {object}             [options]                               The request options.
* @param {LocationMode}       [options.locationMode]                  Specifies the location mode used to decide which location the request should be sent to. 
*                                                                     Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]           The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]      The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                     The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                     execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResult} callback                                     `error` will contain information
*                                                                     if an error occurs; otherwise `result` will 
*                                                                     be true if the share exists and was deleted, or false if the share
*                                                                     did not exist.
*                                                                     `response` will contain information related to this operation.
*/
FileService.prototype._doesShareExist = function (share, primaryOnly, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('shareExists', function (v) {
    v.string(share, 'share');
    v.shareNameIsValid(share);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  var webResource = WebResource.head(share)
    .withQueryOption(QueryStringConstants.RESTYPE, 'share')

  /*if(primaryOnly === false) {
    options.requestLocationMode = RequestLocationMode.PRIMARY_OR_SECONDARY;
  }*/

  this.performRequest(webResource, null, options, getExistsResponseCallback(callback));
};

/**
* The callback for {FileService~getFileToText}.
* @typedef {function} FileService~FileToText
* @param {object} error      If an error occurs, the error information.
* @param {string} text       The text returned from the file.
* @param {object} file  		 Information about the file.
* @param {object} response   Information related to this operation.
*/

FileService.SpeedSummary = SpeedSummary;

module.exports = FileService;
