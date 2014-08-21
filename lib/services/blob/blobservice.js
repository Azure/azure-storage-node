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
var StorageServiceClient = azureCommon.StorageServiceClient;
var WebResource = azureCommon.WebResource;

// Constants
var Constants = azureCommon.Constants;
var BlobConstants = Constants.BlobConstants;
var HeaderConstants = Constants.HeaderConstants;
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
var ServicePropertiesResult = azureCommon.ServicePropertiesResult;
var AclResult = azureCommon.AclResult;
var ServiceStatsParser = azureCommon.ServiceStatsParser;
var BlockListResult = require('./models/blocklistresult');
var BlobResult = require('./models/blobresult');
var ContainerResult = require('./models/containerresult');
var LeaseResult = require('./models/leaseresult');

var BlobUtilities = require('./blobutilities');

/**
* Creates a new BlobService object.
* If no connection string or storageaccount and storageaccesskey are provided,
* the AZURE_STORAGE_CONNECTION_STRING or AZURE_STORAGE_ACCOUNT and AZURE_STORAGE_ACCESS_KEY environment variables will be used.
* @class
* The BlobService class is used to perform operations on the Microsoft Azure Blob Service.
* The Blob Service provides storage for binary large objects, and provides
* functions for working with data stored in blobs as either streams or pages of data.
* 
* For more information on the Blob Service, as well as task focused information on using it in a Node.js application, see
* [How to Use the Blob Service from Node.js](http://azure.microsoft.com/en-us/documentation/articles/storage-nodejs-how-to-use-blob-storage/).
* The following defaults can be set on the blob service.
* singleBlobPutThresholdInBytes                       The default maximum size, in bytes, of a blob before it must be separated into blocks.
* defaultTimeoutIntervalInMs                          The default timeout interval, in milliseconds, to use for request made via the Blob service.
* defaultMaximumExecutionTimeInMs                     The default maximum execution time across all potential retries, for requests made via the Blob service.
* defaultLocationMode                                 The default location mode for requests made via the Blob service.
* parallelOperationThreadCount                        The number of parallel operations that may be performed when uploading a blob that is greater than 
*                                                     the value specified by the singleBlobPutThresholdInBytes property in size.
* @constructor
* @extends {StorageServiceClient}
*
* @param {string} [storageAccountOrConnectionString]  The storage account or the connection string.
* @param {string} [storageAccessKey]                  The storage access key.
* @param {string|object} [host]                       The host address. To define primary only, pass a string. 
*                                                     Otherwise 'host.primaryHost' defines the primary host and 'host.secondaryHost' defines the secondary host.
* @param {string} [sasToken]                          The Shared Access Signature token.
*/
function BlobService(storageAccountOrConnectionString, storageAccessKey, host, sasToken) {
  var storageServiceSettings = StorageServiceClient.getStorageSettings(storageAccountOrConnectionString, storageAccessKey, host, sasToken);

  BlobService['super_'].call(this,
    storageServiceSettings._name,
    storageServiceSettings._key,
    storageServiceSettings._blobEndpoint,
    storageServiceSettings._usePathStyleUri,
    storageServiceSettings._sasToken);

  this.singleBlobPutThresholdInBytes = BlobConstants.DEFAULT_SINGLE_BLOB_PUT_THRESHOLD_IN_BYTES;
  this.parallelOperationThreadCount = Constants.DEFAULT_PARALLEL_OPERATION_THREAD_COUNT;
}

util.inherits(BlobService, StorageServiceClient);

// Non-class methods

/**
* Create resource name
* @ignore
*
* @param {string} containerName Container name
* @param {string} blobName      Blob name
* @return {string} The encoded resource name.
*/
function createResourceName(containerName, blobName, forSAS) {
  // Resource name
  if (blobName && !forSAS) {
    blobName = encodeURIComponent(blobName);
    blobName = blobName.replace(/%2F/g, '/');
    blobName = blobName.replace(/%5C/g, '/');
    blobName = blobName.replace(/\+/g, '%20');
  }

  // return URI encoded resource name
  if (blobName) {
    return containerName + '/' + blobName;
  }
  else {
    return containerName;
  }
}

// Blob service methods

/**
* Gets the service stats for a storage account’s Blob service.
*
* @this {BlobService}
* @param {object}       [options]                               The request options.
* @param {LocationMode} [options.locationMode]                  Specifies the location mode used to decide which location the request should be sent to. 
*                                                               Please see StorageUtilities.LocationMode for the possible values.
* @param {int}          [options.timeoutIntervalInMs]           The timeout interval, in milliseconds, to use for the request.
* @param {int}          [options.maximumExecutionTimeInMs]      The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                               The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                               execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResult}  callback                              `error` will contain information if an error occurs; otherwise, `result` will contain the stats and 
*                                                               `response` will contain information related to this operation.
*/
BlobService.prototype.getServiceStats = function (optionsOrCallback, callback) {
  var options;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { options = o; callback = c; });

  validate.validateArgs('getServiceStats', function (v) {
    v.callback(callback);
  });

  var webResource = WebResource.get()
    .withQueryOption(QueryStringConstants.COMP, 'stats')
    .withQueryOption(QueryStringConstants.RESTYPE, 'service');

  options.requestLocationMode = RequestLocationMode.PRIMARY_OR_SECONDARY;

  var processResponseCallback = function (responseObject, next) {
    responseObject.serviceStatsResult = null;
    if (!responseObject.error) {
      responseObject.serviceStatsResult = ServiceStatsParser.parse(responseObject.response.body.StorageServiceStats);
    }

    // function to be called after all filters
    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.serviceStatsResult, returnObject.response);
    };

    // call the first filter
    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

/**
* Gets the properties of a storage account’s Blob service, including Azure Storage Analytics.
*
* @this {BlobService}
* @param {object}       [options]                               The request options.
* @param {LocationMode} [options.locationMode]                  Specifies the location mode used to decide which location the request should be sent to. 
*                                                               Please see StorageUtilities.LocationMode for the possible values.
* @param {int}          [options.timeoutIntervalInMs]           The server timeout interval, in milliseconds, to use for the request.
* @param {int}          [options.maximumExecutionTimeInMs]      The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                               The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                               execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResult}  callback                              `error` will contain information if an error occurs; otherwise, `result` will contain the properties 
*                                                               and `response` will contain information related to this operation.
*/
BlobService.prototype.getServiceProperties = function (optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('getServiceProperties', function (v) {
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);

  var webResource = WebResource.get()
    .withQueryOption(QueryStringConstants.COMP, 'properties')
    .withQueryOption(QueryStringConstants.RESTYPE, 'service');

  options.requestLocationMode = RequestLocationMode.PRIMARY_OR_SECONDARY;

  var processResponseCallback = function (responseObject, next) {
    responseObject.servicePropertiesResult = null;
    if (!responseObject.error) {
      responseObject.servicePropertiesResult = ServicePropertiesResult.parse(responseObject.response.body.StorageServiceProperties);
    }

    // function to be called after all filters
    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.servicePropertiesResult, returnObject.response);
    };

    // call the first filter
    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

/**
* Sets the properties of a storage account’s Blob service, including Azure Storage Analytics.
* You can also use this operation to set the default request version for all incoming requests that do not have a version specified.
*
* @this {BlobService}
* @param {object}             serviceProperties                        The service properties.
* @param {object}             [options]                                The request options.
* @param {LocationMode}       [options.locationMode]                   Specifies the location mode used to decide which location the request should be sent to. 
*                                                                      Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]            The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]       The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                      The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                      execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResponse}  callback                                   `error` will contain information
*                                                                      if an error occurs; otherwise, `response`
*                                                                      will contain information related to this operation.
*/
BlobService.prototype.setServiceProperties = function (serviceProperties, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('setServiceProperties', function (v) {
    v.object(serviceProperties, 'serviceProperties');
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  var servicePropertiesXml = ServicePropertiesResult.serialize(serviceProperties);

  var webResource = WebResource.put()
    .withQueryOption(QueryStringConstants.COMP, 'properties')
    .withQueryOption(QueryStringConstants.RESTYPE, 'service')
    .withHeader(HeaderConstants.CONTENT_TYPE, 'application/xml;charset="utf-8"')
    .withHeader(HeaderConstants.CONTENT_LENGTH, Buffer.byteLength(servicePropertiesXml))
    .withBody(servicePropertiesXml);

  var processResponseCallback = function (responseObject, next) {
    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, webResource.body, options, processResponseCallback);
};

/**
* Lists a segment containing a collection of container items under the specified account.
*
* @this {BlobService}
* @param {object}             currentToken                                A continuation token returned by a previous listing operation. Please use 'null' or 'undefined' if this is the first operation.
* @param {object}             [options]                                   The request options.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to. 
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.maxResults]                        Specifies the maximum number of containers to return per call to Azure storage.
* @param {string}             [options.include]                           Include this parameter to specify that the container's metadata be returned as part of the response body. (allowed values: '', 'metadata')
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResult}  callback                                        `error` will contain information
*                                                                         if an error occurs; otherwise `result` will contain `entries` and `continuationToken`. 
*                                                                         `entries`  gives a list of containers and the `continuationToken` is used for the next listing operation.
*                                                                         `response` will contain information related to this operation.
*/
BlobService.prototype.listContainersSegmented = function (currentToken, optionsOrCallback, callback) {
  this.listContainersSegmentedWithPrefix(null /* prefix */, currentToken, optionsOrCallback, callback);
};

/**
* Lists a segment containing a collection of container items whose names begin with the specified prefix under the specified account.
*
* @this {BlobService}
* @param {string}             prefix                                      The prefix of the container name.
* @param {object}             currentToken                                A continuation token returned by a previous listing operation. Please use 'null' or 'undefined' if this is the first operation.
* @param {object}             [options]                                   The request options.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to. 
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {string}             [options.prefix]                            Filters the results to return only containers whose name begins with the specified prefix.
* @param {int}                [options.maxResults]                        Specifies the maximum number of containers to return per call to Azure storage.
* @param {string}             [options.include]                           Include this parameter to specify that the container's metadata be returned as part of the response body. (allowed values: '', 'metadata')
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResult}  callback                                        `error` will contain information
*                                                                         if an error occurs; otherwise `result` will contain `entries` and `continuationToken`. 
*                                                                         `entries`  gives a list of containers and the `continuationToken` is used for the next listing operation.
*                                                                         `response` will contain information related to this operation.
*/
BlobService.prototype.listContainersSegmentedWithPrefix = function (prefix, currentToken, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('listContainers', function (v) {
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

  options.requestLocationMode = azureutil.getNextListingLocationMode(currentToken);

  var processResponseCallback = function (responseObject, next) {
    responseObject.listContainersResult = null;

    if (!responseObject.error) {
      responseObject.listContainersResult = {
        entries: null,
        continuationToken: null
      };
      responseObject.listContainersResult.entries = [];

      var containers = [];

      if (responseObject.response.body.EnumerationResults.Containers && responseObject.response.body.EnumerationResults.Containers.Container) {
        containers = responseObject.response.body.EnumerationResults.Containers.Container;
        if (!_.isArray(containers)) {
          containers = [ containers ];
        }
      }

      containers.forEach(function (currentContainer) {
        var containerResult = ContainerResult.parse(currentContainer);
        responseObject.listContainersResult.entries.push(containerResult);
      });

      if(responseObject.response.body.EnumerationResults.NextMarker) {
        responseObject.listContainersResult.continuationToken = {
          nextMarker: null,
          targetLocation: null
        };

        responseObject.listContainersResult.continuationToken.nextMarker = responseObject.response.body.EnumerationResults.NextMarker;
        responseObject.listContainersResult.continuationToken.targetLocation = responseObject.targetLocation;
      }
    }

    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.listContainersResult, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

// Container methods

/**
* Checks whether or not a container exists on the service.
*
* @this {BlobService}
* @param {string}             container                               The container name.
* @param {object}             [options]                               The request options.
* @param {LocationMode}       [options.locationMode]                  Specifies the location mode used to decide which location the request should be sent to. 
*                                                                     Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]           The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]      The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                     The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                     execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResult}  callback                                    `error` will contain information
*                                                                     if an error occurs; otherwise `result` will
*                                                                     be true if the container exists, or false if the container does not exist. 
*                                                                     `response` will contain information related to this operation.
*/
BlobService.prototype.doesContainerExist = function (container, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('doesContainerExist', function (v) {
    v.string(container, 'container');
    v.containerNameIsValid(container);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);

  this._doesContainerExist(container, false, options, callback);
};

/**
* Creates a new container under the specified account.
* If a container with the same name already exists, the operation fails.
*
* @this {BlobService}
* @param {string}             container                           The container name.
* @param {object}             [options]                           The request options.
* @param {LocationMode}       [options.locationMode]              Specifies the location mode used to decide which location the request should be sent to. 
*                                                                 Please see StorageUtilities.LocationMode for the possible values.
* @param {object}             [options.metadata]                  The metadata key/value pairs.
* @param {string}             [options.publicAccessLevel]         Specifies whether data in the container may be accessed publicly and the level of access.
* @param {int}                [options.timeoutIntervalInMs]       The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]  The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                 The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                 execution time is checked intermittently while performing requests, and before executing retries.                                  
* @param {errorOrResult}  callback                                `error` will contain information
*                                                                 if an error occurs; otherwise `result` will contain
*                                                                 the container information.
*                                                                 `response` will contain information related to this operation.
*/
BlobService.prototype.createContainer = function (container, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('createContainer', function (v) {
    v.string(container, 'container');
    v.test(function () { return container !== '$logs'; },
      'Container name format is incorrect');
    v.containerNameIsValid(container);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  var webResource = WebResource.put(container)
    .withQueryOption(QueryStringConstants.RESTYPE, 'container');

  webResource.addOptionalMetadataHeaders(options.metadata);
  webResource.withHeader(HeaderConstants.BLOB_PUBLIC_ACCESS_HEADER, options.publicAccessLevel);

  var processResponseCallback = function (responseObject, next) {
    responseObject.containerResult = null;
    if (!responseObject.error) {
      responseObject.containerResult = new ContainerResult(container);
      responseObject.containerResult.getPropertiesFromHeaders(responseObject.response.headers);

      if (options.metadata) {
        responseObject.containerResult.metadata = options.metadata;
      }
    }

    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.containerResult, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

/**
* Creates a new container under the specified account if the container does not exists.
*
* @this {BlobService}
* @param {string}             container                                 The container name.
* @param {object}             [options]                                 The request options.
* @param {LocationMode}       [options.locationMode]                    Specifies the location mode used to decide which location the request should be sent to. 
*                                                                       Please see StorageUtilities.LocationMode for the possible values.
* @param {object}             [options.metadata]                        The metadata key/value pairs.
* @param {string}             [options.publicAccessLevel]               Specifies whether data in the container may be accessed publicly and the level of access.
* @param {int}                [options.timeoutIntervalInMs]             The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]        The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                       The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                       execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResult}  callback                                      `error` will contain information
*                                                                       if an error occurs; otherwise `result` will
*                                                                       be true if the container was created, or false if the container
*                                                                       already exists.
*                                                                       `response` will contain information related to this operation.
*
* @example
* var azure = require('azure-storage');
* var blobService = azure.createBlobService();
* blobService.createContainerIfNotExists('taskcontainer', {publicAccessLevel : 'blob'}, function(error) {
*   if(!error) {
*     // Container created or exists, and is public
*   }
* }); 
*/
BlobService.prototype.createContainerIfNotExists = function (container, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('createContainerIfNotExists', function (v) {
    v.string(container, 'container');
    v.containerNameIsValid(container);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  var self = this;
  self._doesContainerExist(container, true, options, function(error, exists, response) {
    if(error){
      callback(error, exists, response);
    } else if (exists) {
      response.isSuccessful = true;
      callback(error, false, response);
    } else {
      self.createContainer(container, options, function (createError, responseContainer, createResponse) {
        var created;
        if(!createError){
          created = true;
        }
        else if (createError && createError.statusCode === Constants.HttpConstants.HttpResponseCodes.Conflict && createError.code === Constants.BlobErrorCodeStrings.CONTAINER_ALREADY_EXISTS) {
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
* Retrieves a container and its properties from a specified account.
*
* @this {BlobService}
* @param {string}             container                           The container name.
* @param {object}             [options]                           The request options.
* @param {LocationMode}       [options.locationMode]              Specifies the location mode used to decide which location the request should be sent to. 
*                                                                 Please see StorageUtilities.LocationMode for the possible values.
* @param {string}             [options.leaseId]                   The container lease identifier.
* @param {int}                [options.timeoutIntervalInMs]       The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]  The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                 The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                 execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResult}  callback                                `error` will contain information
*                                                                 if an error occurs; otherwise `result` will contain
*                                                                 information for the container.
*                                                                 `response` will contain information related to this operation.
*/
BlobService.prototype.getContainerProperties = function (container, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('getContainerProperties', function (v) {
    v.string(container, 'container');
    v.containerNameIsValid(container);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  var webResource = WebResource.head(container)
    .withQueryOption(QueryStringConstants.RESTYPE, 'container')
    .withHeader(HeaderConstants.LEASE_ID_HEADER, options.leaseId);

  options.requestLocationMode = Constants.RequestLocationMode.PRIMARY_OR_SECONDARY;

  var self = this;
  var processResponseCallback = function (responseObject, next) {
    responseObject.containerResult = null;
    if (!responseObject.error) {
      responseObject.containerResult = new ContainerResult(container);
      responseObject.containerResult.metadata = self.parseMetadataHeaders(responseObject.response.headers);
      responseObject.containerResult.getPropertiesFromHeaders(responseObject.response.headers);
    }

    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.containerResult, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

/**
* Returns all user-defined metadata for the container.
*
* @this {BlobService}
* @param {string}             container                                 The container name.
* @param {object}             [options]                                 The request options.
* @param {string}             [options.leaseId]                         The container lease identifier.
* @param {LocationMode}       [options.locationMode]                    Specifies the location mode used to decide which location the request should be sent to. 
*                                                                       Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]             The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]        The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                       The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                       execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResult}  callback                                      `error` will contain information
*                                                                       if an error occurs; otherwise `result` will contain
*                                                                       information for the container.
*                                                                       `response` will contain information related to this operation.
*/
BlobService.prototype.getContainerMetadata = function (container, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('getContainerMetadata', function (v) {
    v.string(container, 'container');
    v.containerNameIsValid(container);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  var webResource = WebResource.head(container)
    .withQueryOption(QueryStringConstants.RESTYPE, 'container')
    .withQueryOption(QueryStringConstants.COMP, 'metadata')
    .withHeader(HeaderConstants.LEASE_ID_HEADER, options.leaseId);

  options.requestLocationMode = Constants.RequestLocationMode.PRIMARY_OR_SECONDARY;

  var self = this;
  var processResponseCallback = function (responseObject, next) {
    responseObject.containerResult = null;
    if (!responseObject.error) {
      responseObject.containerResult = new ContainerResult(container);
      responseObject.containerResult.metadata = self.parseMetadataHeaders(responseObject.response.headers);
      responseObject.containerResult.getPropertiesFromHeaders(responseObject.response.headers);
    }

    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.containerResult, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

/**
* Sets the container's metadata.
*
* Calling the Set Container Metadata operation overwrites all existing metadata that is associated with the container.
* It's not possible to modify an individual name/value pair.
*
* @this {BlobService}
* @param {string}             container                           The container name.
* @param {object}             metadata                            The metadata key/value pairs.
* @param {object}             [options]                           The request options.
* @param {string}             [options.leaseId]                   The container lease identifier.
* @param {LocationMode}       [options.locationMode]              Specifies the location mode used to decide which location the request should be sent to. 
*                                                                 Please see StorageUtilities.LocationMode for the possible values.
* @param {object}             [options.accessConditions]          See http://msdn.microsoft.com/en-us/library/dd179371.aspx for more information.
* @param {int}                [options.timeoutIntervalInMs]       The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]  The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                 The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                 execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResponse}  callback                              `error` will contain information
*                                                                 if an error occurs; otherwise 
*                                                                 `response` will contain information related to this operation.
*/
BlobService.prototype.setContainerMetadata = function (container, metadata, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('setContainerMetadata', function (v) {
    v.string(container, 'container');
    v.object(metadata, 'metadata');
    v.containerNameIsValid(container);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  var webResource = WebResource.put(container)
    .withQueryOption(QueryStringConstants.RESTYPE, 'container')
    .withQueryOption(QueryStringConstants.COMP, 'metadata')
    .withHeader(HeaderConstants.LEASE_ID_HEADER, options.leaseId);

  webResource.addOptionalMetadataHeaders(metadata);

  var processResponseCallback = function (responseObject, next) {
    responseObject.containerResult = null;
    if (!responseObject.error) {
      responseObject.containerResult = new ContainerResult(container);
      responseObject.containerResult.getPropertiesFromHeaders(responseObject.response.headers);
    }

    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.containerResult, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

/**
* Gets the container's ACL.
*
* @this {BlobService}
* @param {string}             container                           The container name.
* @param {object}             [options]                           The request options.
* @param {string}             [options.leaseId]                   The container lease identifier.
* @param {LocationMode}       [options.locationMode]              Specifies the location mode used to decide which location the request should be sent to. 
*                                                                 Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]       The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]  The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                 The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                 execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResult}  callback                                `error` will contain information
*                                                                 if an error occurs; otherwise `result` will contain
*                                                                 information for the container.
*                                                                 `response` will contain information related to this operation.
*/
BlobService.prototype.getContainerAcl = function (container, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('getContainerAcl', function (v) {
    v.string(container, 'container');
    v.containerNameIsValid(container);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  var webResource = WebResource.get(container)
    .withQueryOption(QueryStringConstants.RESTYPE, 'container')
    .withQueryOption(QueryStringConstants.COMP, 'acl')
    .withHeader(HeaderConstants.LEASE_ID_HEADER, options.leaseId);

  options.requestLocationMode = Constants.RequestLocationMode.PRIMARY_OR_SECONDARY;

  var processResponseCallback = function (responseObject, next) {
    responseObject.containerResult = null;
    if (!responseObject.error) {
      responseObject.containerResult = new ContainerResult(container);
      responseObject.containerResult.getPropertiesFromHeaders(responseObject.response.headers);
      responseObject.containerResult.signedIdentifiers = AclResult.parse(responseObject.response.body);
    }

    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.containerResult, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

/**
* Updates the container's ACL.
*
* @this {BlobService}
* @param {string}             container                           The container name.
* @param {object}             signedIdentifiers                   The signed identifiers. Signed identifiers must be in an array. 
*                                                                 To only set publicAccessLevel, specify null.
* @param {string}             publicAccessLevel                   Specifies whether data in the container may be accessed publicly and the level of access.
*                                                                 To only set signedIdentifiers, specify null.
* @param {object}             [options]                           The request options.
* @param {string}             [options.leaseId]                   The container lease identifier.
* @param {int}                [options.timeoutIntervalInMs]       The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]  The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                 The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                 execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResult}  callback                                `error` will contain information
*                                                                 if an error occurs; otherwise `result` will contain
*                                                                 information for the container.
*                                                                 `response` will contain information related to this operation.
*/
BlobService.prototype.setContainerAcl = function (container, signedIdentifiers, publicAccessLevel, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('setContainerAcl', function (v) {
    v.string(container, 'container');
    v.containerNameIsValid(container);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);

  var policies = null;
  if (signedIdentifiers) {
    if (!_.isArray(signedIdentifiers)) {
      throw new Error(SR.INVALID_SIGNED_IDENTIFIERS);
    }

    policies = AclResult.serialize(signedIdentifiers);
  }

  var webResource = WebResource.put(container)
    .withQueryOption(QueryStringConstants.RESTYPE, 'container')
    .withQueryOption(QueryStringConstants.COMP, 'acl')
    .withHeader(HeaderConstants.CONTENT_LENGTH, !azureutil.objectIsNull(policies) ? Buffer.byteLength(policies) : 0)
    .withHeader(HeaderConstants.BLOB_PUBLIC_ACCESS_HEADER, publicAccessLevel)
    .withHeader(HeaderConstants.LEASE_ID_HEADER, options.leaseId)
    .withBody(policies);

  var processResponseCallback = function (responseObject, next) {
    responseObject.containerResult = null;
    if (!responseObject.error) {
      responseObject.containerResult = new ContainerResult(container, publicAccessLevel);
      responseObject.containerResult.getPropertiesFromHeaders(responseObject.response.headers);
      if (options.signedIdentifiers) {
        responseObject.containerResult.signedIdentifiers = options.signedIdentifiers;
      }
    }

    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.containerResult, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, webResource.body, options, processResponseCallback);
};

/**
* Marks the specified container for deletion.
* The container and any blobs contained within it are later deleted during garbage collection.
*
* @this {BlobService}
* @param {string}             container                           The container name.
* @param {object}             [options]                           The request options.
* @param {string}             [options.leaseId]                   The container lease identifier.
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
BlobService.prototype.deleteContainer = function (container, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('deleteContainer', function (v) {
    v.string(container, 'container');
    v.containerNameIsValid(container);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  var webResource = WebResource.del(container)
    .withQueryOption(QueryStringConstants.RESTYPE, 'container')
    .withHeader(HeaderConstants.LEASE_ID_HEADER, options.leaseId);
  
  var processResponseCallback = function (responseObject, next) {
    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

/**
* Marks the specified container for deletion if it exists.
* The container and any blobs contained within it are later deleted during garbage collection.
*
* @this {BlobService}
* @param {string}             container                           The container name.
* @param {object}             [options]                           The request options.
* @param {string}             [options.leaseId]                   The container lease identifier.
* @param {LocationMode}       [options.locationMode]              Specifies the location mode used to decide which location the request should be sent to. 
*                                                                 Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]       The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]  The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                 The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                 execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResult} callback                                 `error` will contain information
*                                                                 if an error occurs; otherwise `result` will 
*                                                                 be true if the container exists and was deleted, or false if the container
*                                                                 did not exist.
*                                                                 `response` will contain information related to this operation.
*/
BlobService.prototype.deleteContainerIfExists = function (container, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('deleteContainerIfExists', function (v) {
    v.string(container, 'container');
    v.containerNameIsValid(container);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  var self = this;
  self._doesContainerExist(container, true, options, function(error, exists, response) {
    if(error){
      callback(error, exists, response);
    } else if (!exists) {
      response.isSuccessful = true;
      callback(error, false, response);
    } else {
      self.deleteContainer(container, options, function (deleteError, deleteResponse) {
        var deleted;
        if (!deleteError){
          deleted = true;
        } else if (deleteError && deleteError.statuscode === Constants.HttpConstants.HttpResponseCodes.NotFound && deleteError.code === Constants.BlobErrorCodeStrings.CONTAINER_NOT_FOUND) {
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
* Lists a segment containing a collection of blob items in the container.
*
* @this {BlobService}
* @param {string}             container                         The container name.
* @param {object}             currentToken                      A continuation token returned by a previous listing operation. Please use 'null' or 'undefined' if this is the first operation.
* @param {object}             [options]                         The request options.
* @param {string}             [options.delimiter]               Delimiter, i.e. '/', for specifying folder hierarchy.
* @param {int}                [options.maxResults]              Specifies the maximum number of blobs to return per call to Azure ServiceClient. This does NOT affect list size returned by this function. (maximum: 5000)
* @param {string}             [options.include]                 Specifies that the response should include one or more of the following subsets: '', 'metadata', 'snapshots', 'uncommittedblobs'). Multiple values can be added separated with a comma (,)
* @param {LocationMode}       [options.locationMode]            Specifies the location mode used to decide which location the request should be sent to. 
*                                                               Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]     The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]  The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                               The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                               execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResult}  callback                              `error` will contain information
*                                                               if an error occurs; otherwise `result` will contain `entries` and `continuationToken`. 
*                                                               `entries`  gives a list of blobs and the `continuationToken` is used for the next listing operation.
*                                                               `response` will contain information related to this operation.
*/
BlobService.prototype.listBlobsSegmented = function (container, currentToken, optionsOrCallback, callback) {
  this.listBlobsSegmentedWithPrefix(container, null /* prefix */, currentToken, optionsOrCallback, callback);
};

/**
* Lists a segment containing a collection of blob items whose names begin with the specified prefix in the container.
*
* @this {BlobService}
* @param {string}             container                         The container name.
* @param {string}             prefix                            The prefix of the blob name.
* @param {object}             currentToken                      A continuation token returned by a previous listing operation. Please use 'null' or 'undefined' if this is the first operation.
* @param {object}             [options]                         The request options.
* @param {string}             [options.delimiter]               Delimiter, i.e. '/', for specifying folder hierarchy.
* @param {int}                [options.maxResults]              Specifies the maximum number of blobs to return per call to Azure ServiceClient. This does NOT affect list size returned by this function. (maximum: 5000)
* @param {string}             [options.include]                 Specifies that the response should include one or more of the following subsets: '', 'metadata', 'snapshots', 'uncommittedblobs'). Multiple values can be added separated with a comma (,)
* @param {LocationMode}       [options.locationMode]            Specifies the location mode used to decide which location the request should be sent to. 
*                                                               Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]     The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                               The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                               execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResult}  callback                              `error` will contain information
*                                                               if an error occurs; otherwise `result` will contain
*                                                               the entries of blobs and the continuation token for the next listing operation.
*                                                               `response` will contain information related to this operation.
*/
BlobService.prototype.listBlobsSegmentedWithPrefix = function (container, prefix, currentToken, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('listBlobsSegmented', function (v) {
    v.string(container, 'container');
    v.containerNameIsValid(container);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  var webResource = WebResource.get(container)
    .withQueryOption(QueryStringConstants.RESTYPE, 'container')
    .withQueryOption(QueryStringConstants.COMP, 'list')
    .withQueryOption(QueryStringConstants.MAX_RESULTS, options.maxResults)
    .withQueryOptions(options,
      QueryStringConstants.DELIMITER,
      QueryStringConstants.INCLUDE);

  if (!azureutil.objectIsNull(currentToken)) {
    webResource.withQueryOption(QueryStringConstants.MARKER, currentToken.nextMarker);
  }

  webResource.withQueryOption(QueryStringConstants.PREFIX, prefix);
  
  options.requestLocationMode = azureutil.getNextListingLocationMode(currentToken);

  var processResponseCallback = function (responseObject, next) {
    responseObject.listBlobsResult = null;
    if (!responseObject.error) {
      responseObject.listBlobsResult = {
        entries: null,
        continuationToken: null
      };

      responseObject.listBlobsResult.entries = [];
      var blobs = [];

      if (responseObject.response.body.EnumerationResults.Blobs.Blob) {
        blobs = responseObject.response.body.EnumerationResults.Blobs.Blob;
        if (!_.isArray(blobs)) {
          blobs = [ blobs ];
        }
      }

      blobs.forEach(function (currentBlob) {
        var blobResult = BlobResult.parse(currentBlob);
        responseObject.listBlobsResult.entries.push(blobResult);
      });

      if(responseObject.response.body.EnumerationResults.NextMarker) {
        responseObject.listBlobsResult.continuationToken = {
          nextMarker: null,
          targetLocation: null
        };

        responseObject.listBlobsResult.continuationToken.nextMarker = responseObject.response.body.EnumerationResults.NextMarker;
        responseObject.listBlobsResult.continuationToken.targetLocation = responseObject.targetLocation;
      }
    }

    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.listBlobsResult, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

// Lease methods

/**
* Acquires a new lease. If container and blob are specified, acquires a blob lease. Otherwise, if only container is specified and blob is null, acquires a container lease.
*
* @this {BlobService}
* @param {string}             container                                   The container name.
* @param {string}             blob                                        The blob name.
* @param {object}             [options]                                   The request options.
* @param {string}             [options.leaseDuration]                     The lease duration in seconds. A non-infinite lease can be between 15 and 60 seconds. Default is never to expire. 
* @param {string}             [options.proposedLeaseId]                   The proposed lease identifier. Must be a GUID.
* @param {object}             [options.accessConditions]                  The access conditions. See http://msdn.microsoft.com/en-us/library/dd179371.aspx for more information.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to. 
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResult}  callback                                        `error` will contain information
*                                                                         if an error occurs; otherwise `result` will contain
*                                                                         the lease information.
*                                                                         `response` will contain information related to this operation.
*/
BlobService.prototype.acquireLease = function (container, blob, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('acquireLease', function (v) {
    v.string(container, 'container');
    v.containerNameIsValid(container);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);

  if (!options.leaseDuration) {
    options.leaseDuration = -1;
  }

  this._leaseImpl(container, blob, null /* leaseId */, BlobConstants.LeaseOperation.ACQUIRE, options, callback);
};

/**
* Renews an existing lease. If container and blob are specified, renews the blob lease. Otherwise, if only container is specified and blob is null, renews the container lease.
*
* @this {BlobService}
* @param {string}             container                                   The container name.
* @param {string}             blob                                        The blob name.
* @param {string}             leaseId                                     The lease identifier. Must be a GUID.
* @param {object}             [options]                                   The request options.
* @param {object}             [options.accessConditions]                  The access conditions. See http://msdn.microsoft.com/en-us/library/dd179371.aspx for more information.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to. 
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResult}  callback                                        `error` will contain information
*                                                                         if an error occurs; otherwise `result` will contain
*                                                                         the lease information.
*                                                                         `response` will contain information related to this operation.
*/
BlobService.prototype.renewLease = function (container, blob, leaseId, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('renewLease', function (v) {
    v.string(container, 'container');
    v.containerNameIsValid(container);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);

  this._leaseImpl(container, blob, leaseId, BlobConstants.LeaseOperation.RENEW, options, callback);
};

/**
* Changes the lease ID of an active lease. If container and blob are specified, changes the blob lease. Otherwise, if only container is specified and blob is null, changes the 
* container lease.
*
* @this {BlobService}
* @param {string}             container                                   The container name.
* @param {string}             blob                                        The blob name.
* @param {string}             leaseId                                     The current lease identifier.
* @param {string}             proposedLeaseId                             The proposed lease identifier. Must be a GUID. 
* @param {object}             [options]                                   The request options.
* @param {object}             [options.accessConditions]                  The access conditions. See http://msdn.microsoft.com/en-us/library/dd179371.aspx for more information.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to. 
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResult}  callback                                        `error` will contain information if an error occurs; 
*                                                                         otherwise `result` will contain  the lease information.
*                                                                         `response` will contain information related to this operation.
*/
BlobService.prototype.changeLease = function (container, blob, leaseId, proposedLeaseId, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('changeLease', function (v) {
    v.string(container, 'container');
    v.containerNameIsValid(container);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);

  options.proposedLeaseId = proposedLeaseId;
  this._leaseImpl(container, blob, leaseId, BlobConstants.LeaseOperation.CHANGE, options, callback);
};

/**
* Releases the lease. If container and blob are specified, releases the blob lease. Otherwise, if only container is specified and blob is null, releases the container lease.
*
* @this {BlobService}
* @param {string}             container                                   The container name.
* @param {string}             blob                                        The blob name.
* @param {string}             leaseId                                     The lease identifier.
* @param {object}             [options]                                   The request options.
* @param {object}             [options.accessConditions]                  The access conditions. See http://msdn.microsoft.com/en-us/library/dd179371.aspx for more information.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to. 
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResult}  callback                                        `error` will contain information
*                                                                         if an error occurs; otherwise `result` will contain
*                                                                         the lease information.
*                                                                         `response` will contain information related to this operation.
*/
BlobService.prototype.releaseLease = function (container, blob, leaseId, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('releaseLease', function (v) {
    v.string(container, 'container');
    v.containerNameIsValid(container);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);

  this._leaseImpl(container, blob, leaseId, BlobConstants.LeaseOperation.RELEASE, options, callback);
};

/**
* Breaks the lease but ensures that another client cannot acquire a new lease until the current lease period has expired. If container and blob are specified, breaks the blob lease. 
* Otherwise, if only container is specified and blob is null, breaks the container lease.
*
* @this {BlobService}
* @param {string}             container                                   The container name.
* @param {string}             blob                                        The blob name.
* @param {object}             [options]                                   The request options.
* @param {int}                [options.leaseBreakPeriod]                  The lease break period, between 0 and 60 seconds. If unspecified, a fixed-duration lease breaks after 
*                                                                         the remaining lease period elapses, and an infinite lease breaks immediately.
* @param {object}             [options.accessConditions]                  The access conditions. See http://msdn.microsoft.com/en-us/library/dd179371.aspx for more information.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to. 
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResult}  callback                                        `error` will contain information
*                                                                         if an error occurs; otherwise `result` will contain
*                                                                         the lease information.
*                                                                         `response` will contain information related to this operation.
*/
BlobService.prototype.breakLease = function (container, blob, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('breakLease', function (v) {
    v.string(container, 'container');
    v.containerNameIsValid(container);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);

  this._leaseImpl(container, blob, null /*leaseId*/, BlobConstants.LeaseOperation.BREAK, options, callback);
};

// Blob methods

/**
* Returns all user-defined metadata, standard HTTP properties, and system properties for the blob.
* It does not return or modify the content of the blob.
*
* @this {BlobService}
* @param {string}             container                                   The container name.
* @param {string}             blob                                        The blob name.
* @param {object}             [options]                                   The request options.
* @param {string}             [options.snapshotId]                        The snapshot identifier.
* @param {string}             [options.leaseId]                           The lease identifier.
* @param {object}             [options.accessConditions]                  The access conditions. See http://msdn.microsoft.com/en-us/library/dd179371.aspx for more information.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to. 
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResult}  callback                                        `error` will contain information
*                                                                         if an error occurs; otherwise `result` will contain
*                                                                         information about the blob.
*                                                                         `response` will contain information related to this operation.
*/
BlobService.prototype.getBlobProperties = function (container, blob, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('getBlobProperties', function (v) {
    v.string(container, 'container');
    v.string(blob, 'blob');
    v.containerNameIsValid(container);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  var resourceName = createResourceName(container, blob);
  var webResource = WebResource.head(resourceName);

  if (options.snapshotId) {
    webResource.withQueryOption(QueryStringConstants.SNAPSHOT, options.snapshotId);
  }

  BlobResult.setHeadersFromBlob(webResource, options);

  options.requestLocationMode = Constants.RequestLocationMode.PRIMARY_OR_SECONDARY;

  var self = this;
  var processResponseCallback = function (responseObject, next) {
    responseObject.blobResult = null;
    if (!responseObject.error) {
      responseObject.blobResult = new BlobResult(container, blob);
      responseObject.blobResult.metadata = self.parseMetadataHeaders(responseObject.response.headers);
      responseObject.blobResult.getPropertiesFromHeaders(responseObject.response.headers);
    }

    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.blobResult, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

/**
* Returns all user-defined metadata for the specified blob or snapshot.
* It does not modify or return the content of the blob.
*
* @this {BlobService}
* @param {string}             container                                   The container name.
* @param {string}             blob                                        The blob name.
* @param {object}             [options]                                   The request options.
* @param {string}             [options.snapshotId]                        The snapshot identifier.
* @param {string}             [options.leaseId]                           The lease identifier.
* @param {object}             [options.accessConditions]                  The access conditions. See http://msdn.microsoft.com/en-us/library/dd179371.aspx for more information.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to. 
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResult}  callback                                        `error` will contain information
*                                                                         if an error occurs; otherwise `result` will contain
*                                                                         information about the blob.
*                                                                         `response` will contain information related to this operation.
*/
BlobService.prototype.getBlobMetadata = function (container, blob, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('getBlobMetadata', function (v) {
    v.string(container, 'container');
    v.string(blob, 'blob');
    v.containerNameIsValid(container);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  var resourceName = createResourceName(container, blob);
  var webResource = WebResource.head(resourceName);

  webResource.withQueryOption(QueryStringConstants.COMP, 'metadata');
  webResource.withQueryOption(QueryStringConstants.SNAPSHOT, options.snapshotId);

  BlobResult.setHeadersFromBlob(webResource, options);

  options.requestLocationMode = Constants.RequestLocationMode.PRIMARY_OR_SECONDARY;

  var self = this;
  var processResponseCallback = function (responseObject, next) {
    responseObject.blobResult = null;
    if (!responseObject.error) {
      responseObject.blobResult = new BlobResult(container, blob);
      responseObject.blobResult.metadata = self.parseMetadataHeaders(responseObject.response.headers);
      responseObject.blobResult.getPropertiesFromHeaders(responseObject.response.headers);
    }

    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.blobResult, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

/**
* Sets user-defined properties for the specified blob or snapshot.
* It does not modify or return the content of the blob.
*
* @this {BlobService}
* @param {string}             container                                   The container name.
* @param {string}             blob                                        The blob name.
* @param {object}             [options]                                   The request options.
* @param {string}             [options.leaseId]                           The lease identifier.
* @param {string}             [options.contentType]                       The MIME content type of the blob. The default type is application/octet-stream.
* @param {string}             [options.contentEncoding]                   The content encodings that have been applied to the blob.
* @param {string}             [options.contentLanguage]                   The natural languages used by this resource.
* @param {string}             [options.contentMD5]                        The MD5 hash of the blob content.
* @param {string}             [options.cacheControl]                      The Blob service stores this value but does not use or modify it.
* @param {string}             [options.contentDisposition]                The blob's content disposition. (x-ms-blob-content-disposition)
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to. 
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {object}             [options.accessConditions]                  The access conditions. See http://msdn.microsoft.com/en-us/library/dd179371.aspx for more information.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResult}  callback                                        `error` will contain information
*                                                                         if an error occurs; otherwise `result` will contain
*                                                                         information about the blob.
*                                                                         `response` will contain information related to this operation.
*/
BlobService.prototype.setBlobProperties = function (container, blob, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('setBlobProperties', function (v) {
    v.string(container, 'container');
    v.string(blob, 'blob');
    v.containerNameIsValid(container);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  var resourceName = createResourceName(container, blob);
  var webResource = WebResource.put(resourceName)
    .withQueryOption(QueryStringConstants.COMP, 'properties');

  BlobResult.setPropertiesFromBlob(webResource, options);

  this._setBlobPropertiesHelper({
    webResource: webResource,
    options: options,
    container: container,
    blob: blob,
    callback: callback
  });
};

/**
* Sets user-defined metadata for the specified blob or snapshot as one or more name-value pairs 
* It does not modify or return the content of the blob.
*
* @this {BlobService}
* @param {string}             container                                   The container name.
* @param {string}             blob                                        The blob name.
* @param {object}             metadata                                    The metadata key/value pairs.
* @param {object}             [options]                                   The request options.
* @param {string}             [options.snapshotId]                        The snapshot identifier.
* @param {string}             [options.leaseId]                           The lease identifier.
* @param {object}             [options.accessConditions]                  The access conditions. See http://msdn.microsoft.com/en-us/library/dd179371.aspx for more information.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to. 
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResult}  callback                                        `error` will contain information
*                                                                         if an error occurs; otherwise `result` will contain
*                                                                         information on the blob.
*                                                                         `response` will contain information related to this operation.
*/
BlobService.prototype.setBlobMetadata = function (container, blob, metadata, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('setBlobMetadata', function (v) {
    v.string(container, 'container');
    v.string(blob, 'blob');
    v.object(metadata, 'metadata');
    v.containerNameIsValid(container);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  var resourceName = createResourceName(container, blob);
  var webResource = WebResource.put(resourceName)
    .withQueryOption(QueryStringConstants.COMP, 'metadata');

  webResource.withQueryOption(QueryStringConstants.SNAPSHOT, options.snapshotId);


  webResource.addOptionalMetadataHeaders(metadata);
  BlobResult.setHeadersFromBlob(webResource, options);

  var processResponseCallback = function (responseObject, next) {
    responseObject.blobResult = null;
    if (!responseObject.error) {
      responseObject.blobResult = new BlobResult(container, blob);
      responseObject.blobResult.getPropertiesFromHeaders(responseObject.response.headers);
    }

    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.blobResult, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

/**
* Downloads a blob into a file.
*
* @this {BlobService}
* @param {string}             container                                   The container name.
* @param {string}             blob                                        The blob name.
* @param {string}             localFileName                               The local path to the file to be downloaded.
* @param {object}             [options]                                   The request options.
* @param {string}             [options.snapshotId]                        The snapshot identifier.
* @param {string}             [options.leaseId]                           The lease identifier.
* @param {string}             [options.rangeStart]                        Return only the bytes of the blob in the specified range.
* @param {string}             [options.rangeEnd]                          Return only the bytes of the blob in the specified range.
* @param {object}             [options.accessConditions]                  The access conditions. See http://msdn.microsoft.com/en-us/library/dd179371.aspx for more information.
* @param {boolean}            [options.useTransactionalMD5]               When set to true, Calculate and send/validate content MD5 for transactions.
* @param {boolean}            [options.disableContentMD5Validation]       When set to true, MD5 validation will be disabled when downloading blobs.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to. 
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResult}  callback                                        `error` will contain information if an error occurs; 
*                                                                         otherwise `result` will contain the blob information.
*                                                                         `response` will contain information related to this operation.
* @example
* var azure = require('azure-storage');
* var blobService = azure.createBlobService();
* blobService.getBlobToLocalFile('taskcontainer', 'task1', 'task1-download.txt', function(error, serverBlob) {
*   if(!error) {
*     // Blob available in serverBlob.blob variable
*   }
*/
BlobService.prototype.getBlobToLocalFile = function (container, blob, localFileName, optionsOrCallback, callback) {
  var options;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { options = o; callback = c; });

  validate.validateArgs('getBlobToLocalFile', function (v) {
    v.string(container, 'container');
    v.string(blob, 'blob');
    v.string(localFileName, 'localFileName');
    v.containerNameIsValid(container);
    v.callback(callback);
  });

  var writeStream = fs.createWriteStream(localFileName);

  this.getBlobToStream(container, blob, writeStream, options, function (error, responseBlob, response) {
    if (error) {
      if (azureutil.pathExistsSync(localFileName)) {
        // make sure writeStream is closed / destroyed to avoid locking issues
        if (writeStream.close) {
          writeStream.close();
        }

        // If the download failed from the beginning, remove the file.
        fs.unlink(localFileName, function () {
          callback(error, responseBlob, response);
        });

        return;
      }
    }

    callback(error, responseBlob, response);
  });
};

/**
* Provides a stream to read from a blob.
*
* @this {BlobService}
* @param {string}             container                                   The container name.
* @param {string}             blob                                        The blob name.
* @param {object}             [options]                                   The request options.
* @param {string}             [options.snapshotId]                        The snapshot identifier.
* @param {string}             [options.leaseId]                           The lease identifier.
* @param {string}             [options.rangeStart]                        Return only the bytes of the blob in the specified range.
* @param {string}             [options.rangeEnd]                          Return only the bytes of the blob in the specified range.
* @param {object}             [options.accessConditions]                  The access conditions. See http://msdn.microsoft.com/en-us/library/dd179371.aspx for more information.
* @param {boolean}            [options.useTransactionalMD5]               When set to true, Calculate and send/validate content MD5 for transactions.
* @param {boolean}            [options.disableContentMD5Validation]       When set to true, MD5 validation will be disabled when downloading blobs.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to. 
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResult}  callback                                        `error` will contain information if an error occurs; 
*                                                                         otherwise `result` will contain the blob information.
*                                                                         `response` will contain information related to this operation.
* @return {Stream}
* @example
* var azure = require('azure-storage');
* var blobService = azure.createBlobService();
* var writable = fs.createWriteStream(destinationFileNameTarget);
*  blobService.createReadStream(containerName, blobName).pipe(writable);
*/
BlobService.prototype.createReadStream = function (container, blob, optionsOrCallback, callback) {
  var options;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { options = o; callback = c; });

  validate.validateArgs('createReadStream', function (v) {
    v.string(container, 'container');
    v.string(blob, 'blob');
    v.containerNameIsValid(container);
  });

  var readStream = new ChunkStream();
  this.getBlobToStream(container, blob, readStream, options, function (error, responseBlob, response) {
    if(error) {
      readStream.emit('error', error);
    }

    if(callback) {
      callback(error, responseBlob, response);
    }
  });

  return readStream;
};

/**
* Downloads a blob into a stream.
*
* @this {BlobService}
* @param {string}             container                                   The container name.
* @param {string}             blob                                        The blob name.
* @param {Stream}             writeStream                                 The write stream.
* @param {object}             [options]                                   The request options.
* @param {string}             [options.snapshotId]                        The snapshot identifier.
* @param {string}             [options.leaseId]                           The lease identifier.
* @param {string}             [options.rangeStart]                        Return only the bytes of the blob in the specified range.
* @param {string}             [options.rangeEnd]                          Return only the bytes of the blob in the specified range. 
* @param {boolean}            [options.useTransactionalMD5]               When set to true, Calculate and send/validate content MD5 for transactions.
* @param {boolean}            [options.disableContentMD5Validation]       When set to true, MD5 validation will be disabled when downloading blobs.
* @param {object}             [options.accessConditions]                  The access conditions. See http://msdn.microsoft.com/en-us/library/dd179371.aspx for more information.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to. 
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResult}  callback                                        `error` will contain information if an error occurs; 
*                                                                         otherwise `result` will contain the blob information.
*                                                                         `response` will contain information related to this operation.
*
* @example
* var azure = require('azure-storage');
* var blobService = azure.createBlobService();
* blobService.getBlobToStream('taskcontainer', 'task1', fs.createWriteStream('task1-download.txt'), function(error, serverBlob) {
*   if(!error) {
*     // Blob available in serverBlob.blob variable
*   }
* }); 
*/
BlobService.prototype.getBlobToStream = function (container, blob, writeStream, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('getBlobToStream', function (v) {
    v.string(container, 'container');
    v.string(blob, 'blob');
    v.object(writeStream, 'writeStream');
    v.containerNameIsValid(container);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);

  var resourceName = createResourceName(container, blob);
  var webResource = WebResource.get(resourceName)
    .withRawResponse();

  webResource.withQueryOption(QueryStringConstants.SNAPSHOT, options.snapshotId);

  BlobResult.setHeadersFromBlob(webResource, options);

  this._setRangeContentMD5Header(webResource, options);

  var self = this;
  var processResponseCallback = function (responseObject, next) {
    responseObject.blobResult = null;

    if (!responseObject.error) {
      responseObject.blobResult = new BlobResult(container, blob);
      responseObject.blobResult.metadata = self.parseMetadataHeaders(responseObject.response.headers);
      responseObject.blobResult.getPropertiesFromHeaders(responseObject.response.headers);

      self._validateLengthAndMD5(options, responseObject);
    }

    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.blobResult, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequestInputStream(webResource, null, writeStream, options, processResponseCallback);
};

/**
* Downloads a blob into a text string.
*
* @this {BlobService}
* @param {string}             container                                   The container name.
* @param {string}             blob                                        The blob name.
* @param {object}             [options]                                   The request options.
* @param {string}             [options.snapshotId]                        The snapshot identifier.
* @param {string}             [options.leaseId]                           The lease identifier. 
* @param {boolean}            [options.disableContentMD5Validation]       When set to true, MD5 validation will be disabled when downloading blobs.
* @param {object}             [options.accessConditions]                  The access conditions. See http://msdn.microsoft.com/en-us/library/dd179371.aspx for more information.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to. 
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {BlobService~blobToText}  callback                               `error` will contain information
*                                                                         if an error occurs; otherwise `text` will contain the blob contents,
*                                                                         and `blockBlob` will contain
*                                                                         the blob information.
*                                                                         `response` will contain information related to this operation.
*/
BlobService.prototype.getBlobToText = function (container, blob, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('getBlobToText', function (v) {
    v.string(container, 'container');
    v.string(blob, 'blob');
    v.containerNameIsValid(container);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  var resourceName = createResourceName(container, blob);
  var webResource = WebResource.get(resourceName)
    .withRawResponse();

  webResource.withQueryOption(QueryStringConstants.SNAPSHOT, options.snapshotId);

  BlobResult.setHeadersFromBlob(webResource, options);

  options.requestLocationMode = Constants.RequestLocationMode.PRIMARY_OR_SECONDARY;

  var self = this;
  var processResponseCallback = function (responseObject, next) {
    responseObject.text = null;
    responseObject.blobResult = null;

    if (!responseObject.error) {
      responseObject.blobResult = new BlobResult(container, blob);
      responseObject.blobResult.getPropertiesFromHeaders(responseObject.response.headers);
      responseObject.text = responseObject.response.body;

      self._validateLengthAndMD5(options, responseObject);
    }

    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.text, returnObject.blobResult, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

/**
* Marks the specified blob or snapshot for deletion. The blob is later deleted during garbage collection.
* If a blob has snapshots, you must delete them when deleting the blob. Using the deleteSnapshots option, you can choose either to delete both the blob and its snapshots, 
* or to delete only the snapshots but not the blob itself. If the blob has snapshots, you must include the deleteSnapshots option or the blob service will return an error
* and nothing will be deleted. 
* If you are deleting a specific snapshot using the snapshotId option, the deleteSnapshots option must NOT be included.
*
* @this {BlobService}
* @param {string}             container                                   The container name.
* @param {string}             blob                                        The blob name.
* @param {object}             [options]                                   The request options.
* @param {string}             [options.deleteSnapshots]                   The snapshot delete option. See azure.BlobUtilities.SnapshotDeleteOptions.*. 
* @param {string}             [options.snapshotId]                        The snapshot identifier.
* @param {string}             [options.leaseId]                           The lease identifier.
* @param {object}             [options.accessConditions]                  The access conditions. See http://msdn.microsoft.com/en-us/library/dd179371.aspx for more information.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to. 
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResponse}  callback                                      `error` will contain information
*                                                                         if an error occurs; `response` will contain information related to this operation.
*/
BlobService.prototype.deleteBlob = function (container, blob, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('deleteBlob', function (v) {
    v.string(container, 'container');
    v.string(blob, 'blob');
    v.containerNameIsValid(container);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  var resourceName = createResourceName(container, blob);
  var webResource = WebResource.del(resourceName)
    .withHeader(HeaderConstants.LEASE_ID_HEADER, options.leaseId);

  if(!azureutil.objectIsNull(options.snapshotId) && !azureutil.objectIsNull(options.deleteSnapshots)) {
    throw new Error(SR.INVALID_DELETE_SNAPSHOT_OPTION);
  }
    
  webResource.withQueryOption(QueryStringConstants.SNAPSHOT, options.snapshotId);
  webResource.withHeader(HeaderConstants.DELETE_SNAPSHOT_HEADER, options.deleteSnapshots);

  BlobResult.setHeadersFromBlob(webResource, options);

  var processResponseCallback = function (responseObject, next) {
    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

/**
* Checks whether or not a blob exists on the service.
*
* @this {BlobService}
* @param {string}             container                               The container name.
* @param {string}             blob                                    The blob name.
* @param {object}             [options]                               The request options.
* @param {LocationMode}       [options.locationMode]                  Specifies the location mode used to decide which location the request should be sent to. 
*                                                                     Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]           The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]      The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                     The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                     execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResult}  callback                                    `error` will contain information
*                                                                     if an error occurs; otherwise `errorOrResult` will 
*                                                                     be true if the blob exists, or false if the blob does not exist. 
*                                                                     `response` will contain information related to this operation.
*/
BlobService.prototype.doesBlobExist = function (container, blob, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('doesBlobExist', function (v) {
    v.string(container, 'container');
    v.string(blob, 'blob');
    v.containerNameIsValid(container);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);

  this._doesBlobExist(container, blob, false, options, callback);
};

/**
* Marks the specified blob or snapshot for deletion if it exists. The blob is later deleted during garbage collection.
* If a blob has snapshots, you must delete them when deleting the blob. Using the deleteSnapshots option, you can choose either to delete both the blob and its snapshots, 
* or to delete only the snapshots but not the blob itself. If the blob has snapshots, you must include the deleteSnapshots option or the blob service will return an error
* and nothing will be deleted. 
* If you are deleting a specific snapshot using the snapshotId option, the deleteSnapshots option must NOT be included.
*
* @this {BlobService}
* @param {string}             container                           The container name.
* @param {string}             blob                                The blob name.
* @param {object}             [options]                           The request options.
* @param {string}             [options.deleteSnapshots]           The snapshot delete option. See azure.BlobUtilities.SnapshotDeleteOptions.*. 
* @param {string}             [options.snapshotId]                The snapshot identifier.
* @param {string}             [options.leaseId]                   The lease identifier.
* @param {object}             [options.accessConditions]          The access conditions. See http://msdn.microsoft.com/en-us/library/dd179371.aspx for more information.
* @param {LocationMode}       [options.locationMode]              Specifies the location mode used to decide which location the request should be sent to. 
*                                                                 Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]       The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]  The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                 The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                 execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResult} callback                                 `error` will contain information
*                                                                 if an error occurs; otherwise `result` will
*                                                                 be true if the blob was deleted, or false if the blob
*                                                                 does not exist.
*                                                                 `response` will contain information related to this operation.
*/
BlobService.prototype.deleteBlobIfExists = function (container, blob, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('deleteBlobIfExists', function (v) {
    v.string(container, 'container');
    v.string(blob, 'blob');
    v.containerNameIsValid(container);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  var self = this;
  self._doesBlobExist(container, blob, true, options, function(error, exists, response) {
    if(error){
      callback(error, exists, response);
    } else if (!exists) {
      response.isSuccessful = true;
      callback(error, false, response);
    } else {
      self.deleteBlob(container, blob, options, function (deleteError, deleteResponse) {
        var deleted;
        if (!deleteError){
          deleted = true;
        } else if (deleteError && deleteError.statusCode === Constants.HttpConstants.HttpResponseCodes.NotFound && deleteError.code === Constants.BlobErrorCodeStrings.BLOB_NOT_FOUND) {
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
* Creates a read-only snapshot of a blob.
*
* @this {BlobService}
* @param {string}             container                             The container name.
* @param {string}             blob                                  The blob name.
* @param {object}             [options]                             The request options.
* @param {string}             [options.snapshotId]                  The snapshot identifier.
* @param {object}             [options.metadata]                    The metadata key/value pairs.
* @param {string}             [options.leaseId]                     The lease identifier.
* @param {object}             [options.accessConditions]            The access conditions. See http://msdn.microsoft.com/en-us/library/dd179371.aspx for more information.
* @param {LocationMode}       [options.locationMode]                Specifies the location mode used to decide which location the request should be sent to. 
*                                                                   Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]         The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]    The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                   The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                   execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResult}  callback                                  `error` will contain information
*                                                                   if an error occurs; otherwise `result` will contain
*                                                                   the ID of the snapshot.
*                                                                   `response` will contain information related to this operation.
*/
BlobService.prototype.createBlobSnapshot = function (container, blob, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('createBlobSnapshot', function (v) {
    v.string(container, 'container');
    v.string(blob, 'blob');
    v.containerNameIsValid(container);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  var resourceName = createResourceName(container, blob);
  var webResource = WebResource.put(resourceName)
    .withQueryOption(QueryStringConstants.COMP, 'snapshot');

  BlobResult.setHeadersFromBlob(webResource, options);

  var processResponseCallback = function (responseObject, next) {
    responseObject.snapshotId = null;
    if (!responseObject.error) {
      responseObject.snapshotId = responseObject.response.headers[HeaderConstants.SNAPSHOT_HEADER];
    }

    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.snapshotId, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

/**
* Starts to copy a blob to a destination within the storage account. The Copy Blob operation copies the entire committed blob.
*
* @this {BlobService}
* @param {string}             sourceUri                                 The source blob URI.
* @param {string}             targetContainer                           The target container name.
* @param {string}             targetBlob                                The target blob name.
* @param {object}             [options]                                 The request options.
* @param {string}             [options.snapshotId]                      The source blob snapshot identifier.
* @param {object}             [options.metadata]                        The target blob metadata key/value pairs.
* @param {string}             [options.leaseId]                         The target blob lease identifier.
* @param {string}             [options.sourceLeaseId]                   The source blob lease identifier.
* @param {object}             [options.accessConditions]                The access conditions. See http://msdn.microsoft.com/en-us/library/dd179371.aspx for more information.
* @param {object}             [options.sourceAccessConditions]          The access conditions. See http://msdn.microsoft.com/en-us/library/dd179371.aspx for more information.
* @param {LocationMode}       [options.locationMode]                    Specifies the location mode used to decide which location the request should be sent to. 
*                                                                       Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]             The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]        The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                       The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                       execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResult}  callback                                      `error` will contain information
*                                                                       if an error occurs; otherwise `result` will contain
*                                                                       the blob information.
*                                                                       `response` will contain information related to this operation.
*/
BlobService.prototype.startCopyBlob = function (sourceUri, targetContainer, targetBlob, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('startCopyBlob', function (v) {
    v.string(targetContainer, 'targetContainer');
    v.string(targetBlob, 'targetBlob');
    v.containerNameIsValid(targetContainer);
    v.callback(callback);
  });

  var targetResourceName = createResourceName(targetContainer, targetBlob);

  var options = extend(true, {}, userOptions);

  if (options.snapshotId) {
    sourceUri += '?snapshot=' + options.snapshotId;
  }

  var webResource = WebResource.put(targetResourceName)
    .withHeader(HeaderConstants.COPY_SOURCE_HEADER, sourceUri);

  webResource.withHeader(HeaderConstants.LEASE_ID_HEADER, options.leaseId);
  webResource.withHeader(HeaderConstants.SOURCE_LEASE_ID_HEADER, options.sourceLeaseId);
  webResource.addOptionalMetadataHeaders(options.metadata);

  var processResponseCallback = function (responseObject, next) {
    responseObject.blobResult = null;
    if (!responseObject.error) {
      responseObject.blobResult = new BlobResult(targetContainer, targetBlob);
      responseObject.blobResult.getPropertiesFromHeaders(responseObject.response.headers);

      if (options.metadata) {
        responseObject.blobResult.metadata = options.metadata;
      }
    }

    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.blobResult, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

/**
* Abort a blob copy operation.
*
* @this {BlobService}
* @param {string}             container                                 The destination container name.
* @param {string}             blob                                      The destination blob name.
* @param {string}             copyId                                    The copy operation identifier.
* @param {object}             [options]                                 The request options.
* @param {string}             [options.leaseId]                         The target blob lease identifier.
* @param {LocationMode}       [options.locationMode]                    Specifies the location mode used to decide which location the request should be sent to. 
*                                                                       Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]             The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]        The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                       The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                       execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResult}  callback                                      `error` will contain information
*                                                                       if an error occurs; otherwise `result` will contain
*                                                                       the blob information.
*                                                                       `response` will contain information related to this operation.
*/
BlobService.prototype.abortCopyBlob = function (container, blob, copyId, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('abortCopyBlob', function (v) {
    v.string(container, 'container');
    v.string(blob, 'blob');
    v.containerNameIsValid(container);
    v.callback(callback);
  });

  var resourceName = createResourceName(container, blob);

  var options = extend(true, {}, userOptions);
  var webResource = WebResource.put(resourceName)
    .withQueryOption(QueryStringConstants.COPY_ID, copyId)
    .withQueryOption(QueryStringConstants.COMP, 'copy')
    .withHeader(HeaderConstants.COPY_ACTION, 'abort');

  webResource.withHeader(HeaderConstants.LEASE_ID_HEADER, options.leaseId);

  var processResponseCallback = function (responseObject, next) {
    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

/**
* Retrieves a shared access signature token.
*
* @this {BlobService}
* @param {string}                   container                                     The container name.
* @param {string}                   [blob]                                        The blob name.
* @param {object}                   sharedAccessPolicy                            The shared access policy.
* @param {string}                   [sharedAccessPolicy.Id]                       The signed identifier.
* @param {object}                   [sharedAccessPolicy.AccessPolicy.Permissions] The permission type.
* @param {date|string}              [sharedAccessPolicy.AccessPolicy.Start]       The time at which the Shared Access Signature becomes valid (The UTC value will be used).
* @param {date|string}              sharedAccessPolicy.AccessPolicy.Expiry        The time at which the Shared Access Signature becomes expired (The UTC value will be used).
* @param {object}                   [headers]                                     The optional header values to set for a blob returned wth this SAS.
* @param {string}                   [headers.cacheControl]                        The optional value of the Cache-Control response header to be returned when this SAS is used.
* @param {string}                   [headers.contentType]                         The optional value of the Content-Type response header to be returned when this SAS is used.
* @param {string}                   [headers.contentEncoding]                     The optional value of the Content-Encoding response header to be returned when this SAS is used.
* @param {string}                   [headers.contentLanguage]                     The optional value of the Content-Language response header to be returned when this SAS is used.
* @param {string}                   [headers.contentDisposition]                  The optional value of the Content-Disposition response header to be returned when this SAS is used.
* @return {string}                                                                The shared access signature. Note this does not contain the leading "?".
*/
BlobService.prototype.generateSharedAccessSignature = function (container, blob, sharedAccessPolicy, headers) {
  return this.generateSharedAccessSignatureWithVersion(container, blob, sharedAccessPolicy, null, headers);
};

/**
* Retrieves a shared access signature token.
*
* @this {BlobService}
* @param {string}                   container                                     The container name.
* @param {string}                   [blob]                                        The blob name.
* @param {object}                   sharedAccessPolicy                            The shared access policy.
* @param {string}                   [sharedAccessPolicy.Id]                       The signed identifier.
* @param {object}                   [sharedAccessPolicy.AccessPolicy.Permissions] The permission type.
* @param {date|string}              [sharedAccessPolicy.AccessPolicy.Start]       The time at which the Shared Access Signature becomes valid (The UTC value will be used).
* @param {date|string}              sharedAccessPolicy.AccessPolicy.Expiry        The time at which the Shared Access Signature becomes expired (The UTC value will be used).
* @param {string}                   [sasVersion]                                  An optional string indicating the desired SAS version to use. Value must be 2012-02-12 or later.
* @param {object}                   [headers]                                     The optional header values to set for a blob returned wth this SAS.
* @param {string}                   [headers.cacheControl]                        The optional value of the Cache-Control response header to be returned when this SAS is used.
* @param {string}                   [headers.contentType]                         The optional value of the Content-Type response header to be returned when this SAS is used.
* @param {string}                   [headers.contentEncoding]                     The optional value of the Content-Encoding response header to be returned when this SAS is used.
* @param {string}                   [headers.contentLanguage]                     The optional value of the Content-Language response header to be returned when this SAS is used.
* @param {string}                   [headers.contentDisposition]                  The optional value of the Content-Disposition response header to be returned when this SAS is used.
* @return {string}                                                                The shared access signature query string. Note this string does not contain the leading "?".
*/
BlobService.prototype.generateSharedAccessSignatureWithVersion = function (container, blob, sharedAccessPolicy, sasVersion, headers) {
  // check if the BlobService is able to generate a shared access signature
  if (!this.storageCredentials || !this.storageCredentials.generateSignedQueryString) {
    throw new Error(SR.CANNOT_CREATE_SAS_WITHOUT_ACCOUNT_KEY);
  }

  // Validate container name. Blob name is optional.
  validate.validateArgs('generateSharedAccessSignature', function (v) {
    v.string(container, 'container');
    v.containerNameIsValid(container);
    v.object(sharedAccessPolicy, 'sharedAccessPolicy');
  });

  var resourceType = BlobConstants.ResourceTypes.CONTAINER;
  if (blob) {
    validate.validateArgs('generateSharedAccessSignature', function (v) {
      v.string(blob, 'blob');
    });
    resourceType = BlobConstants.ResourceTypes.BLOB;
  }

  if (sharedAccessPolicy.AccessPolicy) {
    if (!azureutil.objectIsNull(sharedAccessPolicy.AccessPolicy.Start)) {
      if (!_.isDate(sharedAccessPolicy.AccessPolicy.Start)) {
        sharedAccessPolicy.AccessPolicy.Start = new Date(sharedAccessPolicy.AccessPolicy.Start);
      }
 
      sharedAccessPolicy.AccessPolicy.Start = azureutil.truncatedISO8061Date(sharedAccessPolicy.AccessPolicy.Start);
    }

    if (!azureutil.objectIsNull(sharedAccessPolicy.AccessPolicy.Expiry)) {
      if (!_.isDate(sharedAccessPolicy.AccessPolicy.Expiry)) {
        sharedAccessPolicy.AccessPolicy.Expiry = new Date(sharedAccessPolicy.AccessPolicy.Expiry);
      }

      sharedAccessPolicy.AccessPolicy.Expiry = azureutil.truncatedISO8061Date(sharedAccessPolicy.AccessPolicy.Expiry);
    }
  }

  var resourceName = createResourceName(container, blob, true);
  return this.storageCredentials.generateSignedQueryString(resourceName, sharedAccessPolicy, sasVersion, {headers: headers, resourceType: resourceType});
};

/**
* Retrieves a blob or container URL.
*
* @param {string}                   container                The container name.
* @param {string}                   [blob]                   The blob name.
* @param {string}                   [sasToken]               The Shared Access Signature token.
* @param {boolean}                  [primary]                A boolean representing whether to use the primary or the secondary endpoint.
* @return {string}                                           The formatted URL string.
* @example
* var azure = require('azure-storage');
* var blobService = azure.createBlobService();
* //create a SAS that expires in an hour
* var sasToken = blobService.generateSharedAccessSignature(containerName, blobName, { AccessPolicy: { Expiry: azure.date.minutesFromNow(60); } });
* var sasUrl = blobService.getUrl(containerName, blobName, sasToken, true);
*/
BlobService.prototype.getUrl = function (container, blob, sasToken, primary) {
  validate.validateArgs('getUrl', function (v) {
    v.string(container, 'container');
    v.containerNameIsValid(container);
  });

  var host;
  if(!azureutil.objectIsNull(primary) && primary === false) {
    host = this.host.secondaryHost;
  }
  else {
    host = this.host.primaryHost;
  }

  return url.resolve(host, url.format({pathname: this._getPath('/' + createResourceName(container, blob)), query: qs.parse(sasToken)}));
};

// Page blob methods

/**
* Creates a page blob of the specified length.
*
* @this {BlobService}
* @param {string}             container                                   The container name.
* @param {string}             blob                                        The blob name.
* @param {int}                length                                      The length of the page blob in bytes.
* @param {object}             [options]                                   The request options.
* @param {object}             [options.metadata]                          The metadata key/value pairs.
* @param {string}             [options.leaseId]                           The target blob lease identifier.
* @param {string}             [options.contentType]                       The MIME content type of the blob. The default type is application/octet-stream.
* @param {string}             [options.contentEncoding]                   The content encodings that have been applied to the blob.
* @param {string}             [options.contentLanguage]                   The natural languages used by this resource.
* @param {string}             [options.contentMD5]                        The MD5 hash of the blob content.
* @param {string}             [options.cacheControl]                      The Blob service stores this value but does not use or modify it.
* @param {string}             [options.contentDisposition]                The blob's content disposition. (x-ms-blob-content-disposition)
* @param {string}             [options.sequenceNumber]                    The blob's sequence number. (x-ms-blob-sequence-number)
* @param {object}             [options.accessConditions]                  The access conditions. See http://msdn.microsoft.com/en-us/library/dd179371.aspx for more information.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to. 
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResponse}  callback                                      `error` will contain information
*                                                                         if an error occurs; otherwise 
*                                                                         `response` will contain information related to this operation.
*/
BlobService.prototype.createPageBlob = function (container, blob, length, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('createPageBlob', function (v) {
    v.string(container, 'container');
    v.string(blob, 'blob');
    v.containerNameIsValid(container);
    v.value(length);
    v.callback(callback);
  });

  if (length && length % BlobConstants.PAGE_SIZE !== 0) {
    throw new Error(SR.INVALID_PAGE_BLOB_LENGTH);
  }

  var options = extend(true, {}, userOptions);

  var resourceName = createResourceName(container, blob);
  
  var webResource = WebResource.put(resourceName)
    .withHeader(HeaderConstants.BLOB_TYPE_HEADER, BlobConstants.BlobTypes.PAGE)
    .withHeader(HeaderConstants.BLOB_CONTENT_LENGTH_HEADER, length)
    .withHeader(HeaderConstants.CONTENT_LENGTH, 0);

  webResource.withHeader(HeaderConstants.LEASE_ID_HEADER, options.leaseId);
  webResource.addOptionalMetadataHeaders(options.metadata);
  BlobResult.setHeadersFromBlob(webResource, options);

  var processResponseCallback = function (responseObject, next) {
    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

/**
* Uploads a page blob from file.
*
* @this {BlobService}
* @param {string}             container                                   The container name.
* @param {string}             blob                                        The blob name.
* @param (string)             localFileName                               The local path to the file to be uploaded.
* @param {object}             [options]                                   The request options.
* @param {SpeedSummary}       [options.speedSummary]                      The upload tracker objects.
* @param {int}                [options.parallelOperationThreadCount]      Parallel operation thread count
* @param {string}             [options.leaseId]                           The lease identifier.
* @param {object}             [options.metadata]                          The metadata key/value pairs.
* @param {bool}               [options.storeBlobContentMD5]               Specifies whether the blob's ContentMD5 header should be set on uploads. 
*                                                                         The default value is false for page blobs.
* @param {bool}               [options.useTransactionalMD5]               Calculate and send/validate content MD5 for transactions.
* @param {string}             [options.contentType]                       The MIME content type of the blob. The default type is application/octet-stream.
* @param {string}             [options.contentEncoding]                   The content encodings that have been applied to the blob.
* @param {string}             [options.contentLanguage]                   The natural languages used by this resource.
* @param {string}             [options.contentMD5]                        The MD5 hash of the blob content.
* @param {string}             [options.cacheControl]                      The Blob service stores this value but does not use or modify it.
* @param {string}             [options.contentDisposition]                The blob's content disposition. (x-ms-blob-content-disposition)
* @param {object}             [options.accessConditions]                  The access conditions. See http://msdn.microsoft.com/en-us/library/dd179371.aspx for more information.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to. 
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResult}  callback                                        The callback function.
* @return {SpeedSummary}
*/
BlobService.prototype.createPageBlobFromLocalFile = function (container, blob, localFileName, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  // other validation will be done in createPageBlob
  validate.validateArgs('createPageBlobFromFile', function (v) {
    v.string(localFileName, 'localFileName');
  });

  var options = extend(true, {}, userOptions);
  options.speedSummary = options.speedSummary || new SpeedSummary(blob);

  var self = this;
  fs.stat(localFileName, function(error, stat) {
    if (error) {
      callback(error);
    } else {
      self.createPageBlob(container, blob, stat.size, options, function(error) {
        if(error) {
          callback(error);
        } else {
          //Automatically detect the mime type
          if (options.contentType === undefined) {
            options.contentType = mime.lookup(localFileName);
          }

          var stream = new FileReadStream(localFileName, {calcContentMd5: options.storeBlobContentMD5});
          self._createBlobFromChunkStream(container, blob, BlobConstants.BlobTypes.PAGE, stream, stat.size, options, callback);
        }
      });
    }
  });
  return options.speedSummary;
};

/**
* Uploads a page blob from a stream.
*
* @this {BlobService}
* @param {string}             container                                   The container name.
* @param {string}             blob                                        The blob name.
* @param (Stream)             stream                                      Stream to the data to store.
* @param {int}                streamLength                                The length of the stream to upload.
* @param {object}             [options]                                   The request options.
* @param {SpeedSummary}       [options.speedSummary]                      The download tracker objects;
* @param {int}                [options.parallelOperationThreadCount]      Parallel operation thread count
* @param {string}             [options.leaseId]                           The lease identifier.
* @param {object}             [options.metadata]                          The metadata key/value pairs.
* @param {bool}               [options.storeBlobContentMD5]               Specifies whether the blob's ContentMD5 header should be set on uploads. 
*                                                                         The default value is false for page blobs.
* @param {bool}               [options.useTransactionalMD5]               Calculate and send/validate content MD5 for transactions.
* @param {string}             [options.contentType]                       The MIME content type of the blob. The default type is application/octet-stream.
* @param {string}             [options.contentEncoding]                   The content encodings that have been applied to the blob.
* @param {string}             [options.contentLanguage]                   The natural languages used by this resource.
* @param {string}             [options.contentMD5]                        The MD5 hash of the blob content.
* @param {string}             [options.cacheControl]                      The Blob service stores this value but does not use or modify it.
* @param {string}             [options.contentDisposition]                The blob's content disposition. (x-ms-blob-content-disposition)
* @param {object}             [options.accessConditions]                  The access conditions. See http://msdn.microsoft.com/en-us/library/dd179371.aspx for more information.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to. 
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResult}  callback                                        The callback function.
* @return {SpeedSummary}
*/
BlobService.prototype.createPageBlobFromStream = function(container, blob, stream, streamLength, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  // other validation will be done in createPageBlob
  validate.validateArgs('createPageBlobFromStream', function (v) {
    v.exists(stream, 'stream');
    v.value(streamLength, 'streamLength');
  });

  var options = extend(true, {}, userOptions);

  stream.pause();//Immediately pause the stream in order to compatible with Node v0.6 and v0.8

  options.speedSummary = options.speedSummary || new SpeedSummary(blob);

  var self = this;
  this.createPageBlob(container, blob, streamLength, options, function(error) {
    if(error) {
      callback(error);
    } else {
      var chunkStream = new ChunkStreamWithStream(stream, {calcContentMd5: options.storeBlobContentMD5});
      self._createBlobFromChunkStream(container, blob, BlobConstants.BlobTypes.PAGE, chunkStream, streamLength, options, callback);
    }
  });
  return options.speedSummary;
};

/**
* Provides a stream to write to a page blob. Assumes that the blob exists. 
* If it does not, please create the blob using createPageBlob before calling this method or use createWriteStreamNewPageBlob.
*
* @this {BlobService}
* @param {string}             container                                   The container name.
* @param {string}             blob                                        The blob name.
* @param {object}             [options]                                   The request options.
* @param {string}             [options.leaseId]                           The lease identifier.
* @param {object}             [options.metadata]                          The metadata key/value pairs.
* @param {int}                [options.parallelOperationThreadCount]      Parallel operation thread count
* @param {bool}               [options.storeBlobContentMD5]               Specifies whether the blob's ContentMD5 header should be set on uploads. 
*                                                                         The default value is false for page blobs and true for block blobs.
* @param {bool}               [options.useTransactionalMD5]               Calculate and send/validate content MD5 for transactions.
* @param {string}             [options.contentType]                       The MIME content type of the blob. The default type is application/octet-stream.
* @param {string}             [options.contentEncoding]                   The content encodings that have been applied to the blob.
* @param {string}             [options.contentLanguage]                   The natural languages used by this resource.
* @param {string}             [options.contentMD5]                        The MD5 hash of the blob content.
* @param {string}             [options.cacheControl]                      The Blob service stores this value but does not use or modify it.
* @param {string}             [options.contentDisposition]                The blob's content disposition. (x-ms-blob-content-disposition)
* @param {object}             [options.accessConditions]                  The access conditions. See http://msdn.microsoft.com/en-us/library/dd179371.aspx for more information.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to. 
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResponse}  callback                                      The callback function.
* @return {Stream}
* @example
* var azure = require('azure-storage');
* var blobService = azure.createBlobService();
* blobService.createPageBlob(containerName, blobName, 1024, function (err) {
*   // Pipe file to a blob
*   var stream = fs.createReadStream(fileNameTarget).pipe(blobService.createWriteStreamToExistingPageBlob(containerName, blobName));
* });
*/
BlobService.prototype.createWriteStreamToExistingPageBlob = function (container, blob, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('createWriteStreamToExistingPageBlob', function (v) {
    v.string(container, 'container');
    v.string(blob, 'blob');
    v.containerNameIsValid(container);
  });

  var options = extend(true, {}, userOptions);

  var stream = new ChunkStream({calcContentMd5: options.storeBlobContentMD5});
  this._createBlobFromChunkStream(container, blob, BlobConstants.BlobTypes.PAGE, stream, null, options, function (error, blob, response) {
    if(error) {
      stream.emit('error', error);
    }

    if (callback) {
      callback(error, blob, response);
    }
  });

  return stream;
};

/**
* Provides a stream to write to a page blob. Creates the blob before writing data.
*
* @this {BlobService}
* @param {string}             container                                   The container name.
* @param {string}             blob                                        The blob name.
* @param {string}             length                                      The blob length.
* @param {object}             [options]                                   The request options.
* @param {string}             [options.leaseId]                           The lease identifier.
* @param {object}             [options.metadata]                          The metadata key/value pairs.
* @param {int}                [options.parallelOperationThreadCount]      Parallel operation thread count
* @param {bool}               [options.storeBlobContentMD5]               Specifies whether the blob's ContentMD5 header should be set on uploads. 
*                                                                         The default value is false for page blobs and true for block blobs.
* @param {bool}               [options.useTransactionalMD5]               Calculate and send/validate content MD5 for transactions.
* @param {string}             [options.contentType]                       The MIME content type of the blob. The default type is application/octet-stream.
* @param {string}             [options.contentEncoding]                   The content encodings that have been applied to the blob.
* @param {string}             [options.contentLanguage]                   The natural languages used by this resource.
* @param {string}             [options.contentMD5]                        The MD5 hash of the blob content.
* @param {string}             [options.cacheControl]                      The Blob service stores this value but does not use or modify it.
* @param {string}             [options.contentDisposition]                The blob's content disposition. (x-ms-blob-content-disposition)
* @param {object}             [options.accessConditions]                  The access conditions. See http://msdn.microsoft.com/en-us/library/dd179371.aspx for more information.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to. 
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResponse}  callback                                      The callback function.
* @return {Stream}
* @example
* var azure = require('azure-storage');
* var blobService = azure.createBlobService();
* blobService.createPageBlob(containerName, blobName, 1024, function (err) {
*   // Pipe file to a blob
*   var stream = fs.createReadStream(fileNameTarget).pipe(blobService.createWriteStreamToNewPageBlob(containerName, blobName));
* });
*/
BlobService.prototype.createWriteStreamToNewPageBlob = function (container, blob, length, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  var options = extend(true, {}, userOptions);

  // validation will be done in createPageBlob

  var stream = new ChunkStream({calcContentMd5: options.storeBlobContentMD5});
  stream.pause();

  var self = this;
  this.createPageBlob(container, blob, length, function (createError, createBlob, createResponse) {
    if(createError) {
      stream.emit('error', createError);
      callback(createError, createBlob, createResponse);
    }
    else {
      stream.resume();
      self._createBlobFromChunkStream(container, blob, BlobConstants.BlobTypes.PAGE, stream, null, options, function (error, blob, response) {
        if(error) {
          stream.emit('error', error);
        }

        if (callback) {
          callback(error, blob, response);
        }
      });
    }
  });
  
  return stream;
};

/**
* Updates a page blob from a stream.
*
* @this {BlobService}
* @param {string}             container                                   The container name.
* @param {string}             blob                                        The blob name.
* @param {Stream}             readStream                                  The read stream.
* @param {int}                rangeStart                                  The range start.
* @param {int}                rangeEnd                                    The range end.
* @param {object}             [options]                                   The request options.
* @param {string}             [options.leaseId]                           The target blob lease identifier.
* @param {bool}               [options.useTransactionalMD5]               Calculate and send/validate content MD5 for transactions.
* @param {string}             [options.contentMD5]                        An optional hash value used to ensure transactional integrity for the page. 
* @param {object}             [options.accessConditions]                  The access conditions. See http://msdn.microsoft.com/en-us/library/dd179371.aspx for more information.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to. 
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResult}  callback                                        `error` will contain information
*                                                                         if an error occurs; otherwise `result` will contain
*                                                                         the blob information.
*                                                                         `response` will contain information related to this operation.
*/
BlobService.prototype.createPagesFromStream = function (container, blob, readStream, rangeStart, rangeEnd, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('createPagesFromStream', function (v) {
    v.string(container, 'container');
    v.string(blob, 'blob');
    v.containerNameIsValid(container);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions); 

  if((rangeEnd - rangeStart) + 1 > BlobConstants.MAX_UPDATE_PAGE_SIZE) {
    throw new Error(SR.INVALID_PAGE_RANGE_FOR_UPDATE);
  }

  var self = this;
  if (azureutil.objectIsNull(options.contentMD5) && options.useTransactionalMD5) {
    azureutil.calculateMD5(readStream, BlobConstants.MAX_UPDATE_PAGE_SIZE, options, function(internalBuff) {
      self._createPages(container, blob, internalBuff, null /* stream */, rangeStart, rangeEnd, options, callback);
    });
  } else {
    self._createPages(container, blob, null /* text */, readStream, rangeStart, rangeEnd, options, callback);
  }
};

/**
* Lists page ranges. Lists all of the page ranges by default, or only the page ranges over a specific range of bytes if rangeStart and rangeEnd are specified.
*
* @this {BlobService}
* @param {string}             container                                   The container name.
* @param {string}             blob                                        The blob name.
* @param {object}             [options]                                   The request options.
* @param {int}                [options.rangeStart]                        The range start.
* @param {int}                [options.rangeEnd]                          The range end.
* @param {string}             [options.snapshotId]                        The snapshot identifier.
* @param {string}             [options.leaseId]                           The target blob lease identifier.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to. 
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResult}  callback                                        `error` will contain information
*                                                                         if an error occurs; otherwise `result` will contain
*                                                                         the page range information.
*                                                                         `response` will contain information related to this operation.
*/
BlobService.prototype.listPageRanges = function (container, blob, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('listPageRanges', function (v) {
    v.string(container, 'container');
    v.string(blob, 'blob');
    v.containerNameIsValid(container);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);

  var resourceName = createResourceName(container, blob);  
  var webResource = WebResource.get(resourceName)
    .withQueryOption(QueryStringConstants.COMP, 'pagelist')
    .withQueryOption(QueryStringConstants.SNAPSHOT, options.snapshotId);

  if (options.rangeStart && options.rangeStart % BlobConstants.PAGE_SIZE !== 0) {
    throw new Error(SR.INVALID_PAGE_START_OFFSET);
  }

  if (options.rangeEnd && (options.rangeEnd + 1) % BlobConstants.PAGE_SIZE !== 0) {
    throw new Error(SR.INVALID_PAGE_END_OFFSET);
  }

  BlobResult.setHeadersFromBlob(webResource, options);

  options.requestLocationMode = RequestLocationMode.PRIMARY_OR_SECONDARY;

  var processResponseCallback = function (responseObject, next) {
    responseObject.pageRanges = null;
    if (!responseObject.error) {
      responseObject.pageRanges = [];

      var pageRanges = [];
      if (responseObject.response.body.PageList.PageRange) {
        pageRanges = responseObject.response.body.PageList.PageRange;

        if (!_.isArray(pageRanges)) {
          pageRanges = [ pageRanges ];
        }
      }

      pageRanges.forEach(function (pageRange) {
        var range = {
          start: parseInt(pageRange.Start, 10),
          end: parseInt(pageRange.End, 10)
        };

        responseObject.pageRanges.push(range);
      });
    }

    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.pageRanges, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

/**
* Clears a range of pages.
*
* @this {BlobService}
* @param {string}             container                                   The container name.
* @param {string}             blob                                        The blob name.
* @param {int}                rangeStart                                  The range start.
* @param {int}                rangeEnd                                    The range end.
* @param {object}             [options]                                   The request options.
* @param {string}             [options.leaseId]                           The target blob lease identifier.
* @param {object}             [options.accessConditions]                  The access conditions. See http://msdn.microsoft.com/en-us/library/dd179371.aspx for more information.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to. 
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResponse}  callback                                      `error` will contain information
*                                                                         if an error occurs; otherwise 
*                                                                         `response` will contain information related to this operation.
*/
BlobService.prototype.clearPageRange = function (container, blob, rangeStart, rangeEnd, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('clearPageRange', function (v) {
    v.string(container, 'container');
    v.string(blob, 'blob');
    v.containerNameIsValid(container);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  var request = this._updatePageBlobPagesImpl(container, blob, rangeStart, rangeEnd, BlobConstants.PageWriteOptions.CLEAR, options);

  var self = this;
  var processResponseCallback = function (responseObject, next) {
    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  self.performRequest(request, null, options, processResponseCallback);
};

/**
* Resizes a page blob.
*
* @this {BlobService}
* @param {string}               container                                   The container name.
* @param {string}               blob                                        The blob name.
* @param {String}               size                                        The size of the page blob, in bytes.
* @param {object}               [options]                                   The request options.
* @param {string}               [options.leaseId]                           The blob lease identifier.
* @param {object}               [options.accessConditions]                  The access conditions. See http://msdn.microsoft.com/en-us/library/dd179371.aspx for more information.
* @param {LocationMode}         [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to. 
*                                                                           Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                  [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                  [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                           The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                           execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResult}  callback                                          `error` will contain information
*                                                                           if an error occurs; otherwise `result` will contain
*                                                                           information about the blob.
*                                                                           `response` will contain information related to this operation.
*/
BlobService.prototype.resizePageBlob = function (container, blob, size, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('resizePageBlob', function (v) {
    v.string(container, 'container');
    v.string(blob, 'blob');
    v.containerNameIsValid(container);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  var resourceName = createResourceName(container, blob);
  var webResource = WebResource.put(resourceName)
    .withQueryOption(QueryStringConstants.COMP, 'properties');

  if (size && size % BlobConstants.PAGE_SIZE !== 0) {
    throw new Error(SR.INVALID_PAGE_BLOB_LENGTH);
  }

  webResource.withHeader(HeaderConstants.BLOB_CONTENT_LENGTH_HEADER, size);

  this._setBlobPropertiesHelper({
      webResource: webResource,
      options: options,
      container: container,
      blob: blob,
      callback: callback
  });
  
};

/**
* Sets the page blob's sequence number.
*
* @this {BlobService}
* @param {string}               container                                   The container name.
* @param {string}               blob                                        The blob name.
* @param {SequenceNumberAction} sequenceNumberAction                        A value indicating the operation to perform on the sequence number. 
*                                                                           The allowed values are defined in azure.BlobUtilities.SequenceNumberAction.
* @param {string}               sequenceNumber                              The sequence number.  The value of the sequence number must be between 0 and 2^63 - 1.
*                                                                           Set this parameter to null if this operation is an increment action.
* @param {object}               [options]                                   The request options.
* @param {object}               [options.accessConditions]                  The access conditions. See http://msdn.microsoft.com/en-us/library/dd179371.aspx for more information.
* @param {LocationMode}         [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to. 
*                                                                           Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                  [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                  [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                           The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                           execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResult}  callback                                          `error` will contain information
*                                                                           if an error occurs; otherwise `result` will contain
*                                                                           information about the blob.
*                                                                           `response` will contain information related to this operation.
*/
BlobService.prototype.setPageBlobSequenceNumber = function (container, blob, sequenceNumberAction, sequenceNumber, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('setPageBlobSequenceNumber', function (v) {
    v.string(container, 'container');
    v.string(blob, 'blob');
    v.containerNameIsValid(container);
    v.callback(callback);
  });

  if (sequenceNumberAction === BlobUtilities.SequenceNumberAction.INCREMENT) {
    if(!azureutil.objectIsNull(sequenceNumber)) {
      throw new Error(SR.BLOB_INVALID_SEQUENCE_NUMBER);
    }
  } else {
    if (azureutil.objectIsNull(sequenceNumber)) {
      throw new Error(util.format(SR.ARGUMENT_NULL_OR_EMPTY, 'sequenceNumber'));
    }
  }

  var options = extend(true, {}, userOptions);
  var resourceName = createResourceName(container, blob);
  var webResource = WebResource.put(resourceName)
    .withQueryOption(QueryStringConstants.COMP, 'properties')
    .withHeader(HeaderConstants.SEQUENCE_NUMBER_ACTION, sequenceNumberAction);

  if (sequenceNumberAction !== BlobUtilities.SequenceNumberAction.INCREMENT) {
    webResource.withHeader(HeaderConstants.SEQUENCE_NUMBER, sequenceNumber);
  }

  var processResponseCallback = function (responseObject, next) {
    responseObject.blobResult = null;
    if (!responseObject.error) {
      responseObject.blobResult = new BlobResult(container, blob);
      responseObject.blobResult.getPropertiesFromHeaders(responseObject.response.headers);
    }

    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.blobResult, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

// Block blob methods

/**
* Creates a new block blob or updates the content of an existing block blob.
* Updating an existing block blob overwrites any existing metadata on the blob. 
* Partial updates are not supported with Put Blob; The content of the existing blob is overwritten with the content of the new blob. 
* To perform a partial update of the content of a block blob, use the Put Block List operation.
* Calling Put Blob to create a page blob only initializes the blob. To add content to a page blob, call the Put Page operation.
*
* @this {BlobService}
* @param {string}             container                                   The container name.
* @param {string}             blob                                        The blob name.
* @param {string}             localFileName                               The local path to the file to be uploaded.
* @param {object}             [options]                                   The request options.
* @param {string}             [options.blockIdPrefix]                     The prefix to be used to generate the block id.
* @param {string}             [options.leaseId]                           The lease identifier.
* @param {object}             [options.metadata]                          The metadata key/value pairs.
* @param {int}                [options.parallelOperationThreadCount]      Parallel operation thread count
* @param {bool}               [options.storeBlobContentMD5]               Specifies whether the blob's ContentMD5 header should be set on uploads. The default value is true for block blobs.
* @param {string}             [options.contentType]                       The MIME content type of the blob. The default type is application/octet-stream.
* @param {string}             [options.contentEncoding]                   The content encodings that have been applied to the blob.
* @param {string}             [options.contentLanguage]                   The natural languages used by this resource.
* @param {string}             [options.contentMD5]                        The MD5 hash of the blob content.
* @param {string}             [options.cacheControl]                      The Blob service stores this value but does not use or modify it.
* @param {string}             [options.contentDisposition]                The blob's content disposition.
* @param {object}             [options.accessConditions]                  The access conditions. See http://msdn.microsoft.com/en-us/library/dd179371.aspx for more information.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to. 
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResult}  callback                                        The callback function.
* @return {SpeedSummary}
*/
BlobService.prototype.createBlockBlobFromLocalFile = function (container, blob, localFileName, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('createBlockBlobFromFile', function (v) {
    v.string(container, 'container');
    v.string(blob, 'blob');
    v.containerNameIsValid(container);
    v.string(localFileName, 'localFileName');
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);

  // set up default speed summary
  options.speedSummary = options.speedSummary || new SpeedSummary(blob);

  // default to trueunless explicitly set to false
  options.storeBlobContentMD5 = options.storeBlobContentMD5 === false ? false : true;

  var self = this;
  fs.stat(localFileName, function(error, stat) {
    if (error) {
      callback(error);
    } else {
      //Automatically detect the mime type
      if (options.contentType === undefined) {
        options.contentType = mime.lookup(localFileName);
      }

      if (stat.size >= self.singleBlobPutThresholdInBytes) {
        var stream = new FileReadStream(localFileName, {calcContentMd5: options.storeBlobContentMD5});
        self._createBlobFromChunkStream(container, blob, BlobConstants.BlobTypes.BLOCK, stream, stat.size, options, callback);
      } else {
        //Use putBlob to upload file
        var stream = new fs.createReadStream(localFileName);
        if (azureutil.objectIsNull(options.contentMD5) && options.useTransactionalMD5) {
          azureutil.calculateMD5(stream, self.singleBlobPutThresholdInBytes, options, function(internalBuff) {
            self._putBlockBlob(container, blob, internalBuff, null /* stream */, internalBuff.length, options, callback);
          });
        } else {
          self._putBlockBlob(container, blob, null /* text */, stream, stat.size, options, callback);
        }
      }
    }
  });

  return options.speedSummary;
};

/**
* Uploads a block blob from a stream.
*
* @this {BlobService}
* @param {string}             container                                   The container name.
* @param {string}             blob                                        The blob name.
* @param (Stream)             stream                                      Stream to the data to store.
* @param {int}                streamLength                                The length of the stream to upload.
* @param {object}             [options]                                   The request options.
* @param {SpeedSummary}       [options.speedSummary]                      The download tracker objects.
* @param {string}             [options.blockIdPrefix]                     The prefix to be used to generate the block id.
* @param {string}             [options.leaseId]                           The lease identifier.
* @param {object}             [options.metadata]                          The metadata key/value pairs.
* @param {int}                [options.parallelOperationThreadCount]      Parallel operation thread count
* @param {bool}               [options.storeBlobContentMD5]               Specifies whether the blob's ContentMD5 header should be set on uploads. The default value is true for block blobs.
* @param {bool}               [options.useTransactionalMD5]               Calculate and send/validate content MD5 for transactions.
* @param {string}             [options.contentType]                       The MIME content type of the blob. The default type is application/octet-stream.
* @param {string}             [options.contentEncoding]                   The content encodings that have been applied to the blob.
* @param {string}             [options.contentLanguage]                   The natural languages used by this resource.
* @param {string}             [options.contentMD5]                        The MD5 hash of the blob content.
* @param {string}             [options.cacheControl]                      The Blob service stores this value but does not use or modify it.
* @param {string}             [options.contentDisposition]                The blob's content disposition.
* @param {object}             [options.accessConditions]                  The access conditions. See http://msdn.microsoft.com/en-us/library/dd179371.aspx for more information.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to. 
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResult}  callback                                        The callback function.
* @return {SpeedSummary}
*/
BlobService.prototype.createBlockBlobFromStream = function (container, blob, stream, streamLength, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('createBlockBlobFromStream', function (v) {
    v.string(container, 'container');
    v.string(blob, 'blob');
    v.containerNameIsValid(container);
    v.exists(stream);
    v.value(streamLength);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);

  // set up default speed summary
  options.speedSummary = options.speedSummary || new SpeedSummary(blob);

  // default to trueunless explicitly set to false
  options.storeBlobContentMD5 = options.storeBlobContentMD5 === false ? false : true;

  if (streamLength >= this.singleBlobPutThresholdInBytes) {
    var chunkStream = new ChunkStreamWithStream(stream, {calcContentMd5: options.storeBlobContentMD5});
    return this._createBlobFromChunkStream(container, blob, BlobConstants.BlobTypes.BLOCK, chunkStream, streamLength, options, callback);
  } else {
    var self = this;
    if (azureutil.objectIsNull(options.contentMD5) && options.useTransactionalMD5) {
      azureutil.calculateMD5(stream, this.singleBlobPutThresholdInBytes, options, function(internalBuff) {
        self._putBlockBlob(container, blob, internalBuff, null /* stream */, internalBuff.length, options, callback);
      });
    } else {
      self._putBlockBlob(container, blob, null /* text */, stream, streamLength, options, callback);
    }
  }
};

/**
* Uploads a block blob from a text string.
*
* @this {BlobService}
* @param {string}             container                                   The container name.
* @param {string}             blob                                        The blob name.
* @param {string|object}      text                                        The blob text, as a string or in a Buffer.
* @param {object}             [options]                                   The request options.
* @param {string}             [options.leaseId]                           The lease identifier.
* @param {object}             [options.metadata]                          The metadata key/value pairs.
* @param {bool}               [options.storeBlobContentMD5]               Specifies whether the blob's ContentMD5 header should be set on uploads. The default value is true for block blobs.
* @param {bool}               [options.useTransactionalMD5]               Calculate and send/validate content MD5 for transactions.
* @param {string}             [options.contentType]                       The MIME content type of the blob. The default type is application/octet-stream.
* @param {string}             [options.contentEncoding]                   The content encodings that have been applied to the blob.
* @param {string}             [options.contentLanguage]                   The natural languages used by this resource.
* @param {string}             [options.contentMD5]                        The MD5 hash of the blob content.
* @param {string}             [options.cacheControl]                      The Blob service stores this value but does not use or modify it.
* @param {string}             [options.contentDisposition]                The blob's content disposition.
* @param {object}             [options.accessConditions]                  The access conditions. See http://msdn.microsoft.com/en-us/library/dd179371.aspx for more information.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to. 
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResult}  callback                                        `error` will contain information
*                                                                         if an error occurs; otherwise `result` will contain
*                                                                         information about the blob.
*                                                                         `response` will contain information related to this operation.
* @return {undefined}
*/
BlobService.prototype.createBlockBlobFromText = function (container, blob, text, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('createBlockBlobFromText', function (v) {
    v.string(container, 'container');
    v.string(blob, 'blob');
    v.containerNameIsValid(container);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);

  var length = Buffer.isBuffer(text) ? text.length : Buffer.byteLength(text);
  if (length > BlobConstants.MAX_SINGLE_UPLOAD_BLOB_SIZE_IN_BYTES) {
    throw new Error(SR.INVALID_BLOB_LENGTH);
  }

  options[HeaderConstants.CONTENT_TYPE] = 'text/plain;charset="utf-8"';

  this._putBlockBlob(container, blob, text, null /* stream */, length, options, callback);
};

/**
* Provides a stream to write to a block blob.
*
* @this {BlobService}
* @param {string}             container                                   The container name.
* @param {string}             blob                                        The blob name.
* @param {object}             [options]                                   The request options.
* @param {string}             [options.blockIdPrefix]                     The prefix to be used to generate the block id.
* @param {string}             [options.leaseId]                           The lease identifier.
* @param {object}             [options.metadata]                          The metadata key/value pairs.
* @param {int}                [options.parallelOperationThreadCount]      Parallel operation thread count
* @param {bool}               [options.storeBlobContentMD5]               Specifies whether the blob's ContentMD5 header should be set on uploads. 
*                                                                         The default value is false for page blobs and true for block blobs.
* @param {bool}               [options.useTransactionalMD5]               Calculate and send/validate content MD5 for transactions.
* @param {string}             [options.contentType]                       The MIME content type of the blob. The default type is application/octet-stream.
* @param {string}             [options.contentEncoding]                   The content encodings that have been applied to the blob.
* @param {string}             [options.contentLanguage]                   The natural languages used by this resource.
* @param {string}             [options.contentMD5]                        The MD5 hash of the blob content.
* @param {string}             [options.cacheControl]                      The Blob service stores this value but does not use or modify it.
* @param {string}             [options.position]                          The blob's content disposition. (x-ms-blob-content-disposition)
* @param {object}             [options.accessConditions]                  The access conditions. See http://msdn.microsoft.com/en-us/library/dd179371.aspx for more information.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to. 
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResponse}  callback                                      The callback function.
* @return {Stream}
* @example
* var azure = require('azure-storage');
* var blobService = azure.createBlobService();
* var stream = fs.createReadStream(fileNameTarget).pipe(blobService.createWriteStreamToBlockBlob(containerName, blobName, { blockIdPrefix: 'block' }));
*/
BlobService.prototype.createWriteStreamToBlockBlob = function (container, blob, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('createWriteStreamToBlockBlob', function (v) {
    v.string(container, 'container');
    v.string(blob, 'blob');
    v.containerNameIsValid(container);
  });

  var options = extend(true, {}, userOptions);

  // default to trueunless explicitly set to false
  options.storeBlobContentMD5 = options.storeBlobContentMD5 === false ? false : true;

  var stream = new ChunkStream({calcContentMd5: options.storeBlobContentMD5});
  this._createBlobFromChunkStream(container, blob, BlobConstants.BlobTypes.BLOCK, stream, null, options, function (error, blob, response) {
    if(error) {
      stream.emit('error', error);
    }

    if (callback) {
      callback(error, blob, response);
    }
  });

  return stream;
};

/**
* Creates a new block to be committed as part of a blob.
*
* @this {BlobService}
* @param {string}             blockId                                   The block identifier.
* @param {string}             container                                 The container name.
* @param {string}             blob                                      The blob name.
* @param {Stream}             readStream                                The read stream.
* @param {int}                streamLength                              The stream length.
* @param {object}             [options]                                 The request options.
* @param {bool}               [options.useTransactionalMD5]             Calculate and send/validate content MD5 for transactions.
* @param {string}             [options.leaseId]                         The target blob lease identifier.
* @param {string}             [options.contentMD5]                      The blob’s MD5 hash.
* @param {object}             [options.accessConditions]                The access conditions. See http://msdn.microsoft.com/en-us/library/dd179371.aspx for more information.
* @param {LocationMode}       [options.locationMode]                    Specifies the location mode used to decide which location the request should be sent to. 
*                                                                       Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]             The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]        The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                       The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                       execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResponse}  callback                                    `error` will contain information
*                                                                       if an error occurs; otherwise 
*                                                                       `response` will contain information related to this operation.
*/
BlobService.prototype.createBlockFromStream = function (blockId, container, blob, readStream, streamLength, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('createBlockFromStream', function (v) {
    v.string(container, 'container');
    v.string(blob, 'blob');
    v.containerNameIsValid(container);
    v.exists(readStream);
    v.value(streamLength);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);

  var self = this;
  if(streamLength > BlobConstants.MAX_BLOCK_SIZE) {
    throw new Error(SR.INVALID_STREAM_LENGTH);
  } else {
    if (azureutil.objectIsNull(options.contentMD5) && options.useTransactionalMD5) {
      azureutil.calculateMD5(readStream, streamLength, options, function(internalBuff) {
        self.createBlockFromText(blockId, container, blob, internalBuff, options, callback);
      });
    } else {
      self._createBlockFromStream(blockId, container, blob, readStream, streamLength, options, callback);
    }
  }
};

/**
* Creates a new block to be committed as part of a blob.
*
* @this {BlobService}
* @param {string}             blockId                                   The block identifier.
* @param {string}             container                                 The container name.
* @param {string}             blob                                      The blob name.
* @param {string|buffer}      content                                   The block content.
* @param {object}             [options]                                 The request options.
* @param {bool}               [options.useTransactionalMD5]             Calculate and send/validate content MD5 for transactions.
* @param {string}             [options.leaseId]                         The target blob lease identifier.
* @param {string}             [options.contentMD5]                      The blob’s MD5 hash.
* @param {object}             [options.accessConditions]                The access conditions. See http://msdn.microsoft.com/en-us/library/dd179371.aspx for more information.
* @param {LocationMode}       [options.locationMode]                    Specifies the location mode used to decide which location the request should be sent to. 
*                                                                       Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]             The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]        The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                       The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                       execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResponse}  callback                                    `error` will contain information
*                                                                       if an error occurs; otherwise 
*                                                                       `response` will contain information related to this operation.
* @return {undefined}
*/
BlobService.prototype.createBlockFromText = function (blockId, container, blob, content, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('createBlockFromText', function (v) {
    v.string(container, 'container');
    v.string(blob, 'blob');
    v.containerNameIsValid(container);
    v.callback(callback);
  });

  var resourceName = createResourceName(container, blob);
  var options = extend(true, {}, userOptions);

  var contentLength = (Buffer.isBuffer(content) ? content.length : Buffer.byteLength(content));
 
  if(contentLength > BlobConstants.MAX_BLOCK_SIZE) {
    throw new Error(SR.INVALID_TEXT_LENGTH);
  }

  var webResource = WebResource.put(resourceName)
    .withQueryOption(QueryStringConstants.COMP, 'block')
    .withQueryOption(QueryStringConstants.BLOCK_ID, new Buffer(blockId).toString('base64'));

  webResource.withHeader(HeaderConstants.CONTENT_LENGTH, contentLength);

  BlobResult.setHeadersFromBlob(webResource, options);
  if(azureutil.objectIsNull(options.contentMD5) && options.useTransactionalMD5) {
    webResource.withHeader(HeaderConstants.CONTENT_MD5, azureutil.getContentMd5(content));
  }

  var processResponseCallback = function (responseObject, next) {
    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, content, options, processResponseCallback);
};

/**
* Writes a blob by specifying the list of block IDs that make up the blob.
* In order to be written as part of a blob, a block must have been successfully written to the server in a prior
* createBlock operation.
*
* @this {BlobService}
* @param {string}             container                                   The container name.
* @param {string}             blob                                        The blob name.
* @param {object}             blockList                                   The block identifiers.
* @param {object}             [options]                                   The request options.
* @param {object}             [options.metadata]                          The metadata key/value pairs.
* @param {string}             [options.leaseId]                           The target blob lease identifier.
* @param {string}             [options.contentType]                       The MIME content type of the blob. The default type is application/octet-stream.
* @param {string}             [options.contentEncoding]                   The content encodings that have been applied to the blob.
* @param {string}             [options.contentLanguage]                   The natural languages used by this resource.
* @param {string}             [options.contentMD5]                        The MD5 hash of the blob content.
* @param {string}             [options.cacheControl]                      The Blob service stores this value but does not use or modify it.
* @param {string}             [options.contentDisposition]                The blob's content disposition. (x-ms-blob-content-disposition)
* @param {object}             [options.accessConditions]                  The access conditions. See http://msdn.microsoft.com/en-us/library/dd179371.aspx for more information.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to. 
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResult}  callback                                        `error` will contain information
*                                                                         if an error occurs; otherwise `result` will contain
*                                                                         the blocklist information.
*                                                                         `response` will contain information related to this operation.
*/
BlobService.prototype.commitBlocks = function (container, blob, blockList, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('commitBlocks', function (v) {
    v.string(container, 'container');
    v.string(blob, 'blob');
    v.containerNameIsValid(container);
    v.callback(callback);
  });

  var blockListXml = BlockListResult.serialize(blockList);

  var resourceName = createResourceName(container, blob);
  var options = extend(true, {}, userOptions);
  var webResource = WebResource.put(resourceName)
    .withQueryOption(QueryStringConstants.COMP, 'blocklist')
    .withHeader(HeaderConstants.CONTENT_LENGTH, Buffer.byteLength(blockListXml))
    .withBody(blockListXml);

  BlobResult.setPropertiesFromBlob(webResource, options);

  var processResponseCallback = function (responseObject, next) {
    responseObject.list = null;
    if (!responseObject.error) {
      responseObject.list = blockList;
    }

    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.list, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, webResource.body, options, processResponseCallback);
};

/**
* Retrieves the list of blocks that have been uploaded as part of a block blob.
*
* @this {BlobService}
* @param {string}             container                                   The container name.
* @param {string}             blob                                        The blob name.
* @param {BlockListFilter}    blocklisttype                               The type of block list to retrieve.
* @param {object}             [options]                                   The request options.
* @param {string}             [options.snapshotId]                        The source blob snapshot identifier.
* @param {string}             [options.leaseId]                           The target blob lease identifier.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to. 
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResult}  callback                                        `error` will contain information
*                                                                         if an error occurs; otherwise `result` will contain
*                                                                         the blocklist information.
*                                                                         `response` will contain information related to this operation.
*/
BlobService.prototype.listBlocks = function (container, blob, blocklisttype, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('listBlocks', function (v) {
    v.string(container, 'container');
    v.string(blob, 'blob');
    v.containerNameIsValid(container);
    v.callback(callback);
  });

  var resourceName = createResourceName(container, blob);
  var options = extend(true, {}, userOptions);
  var webResource = WebResource.get(resourceName)
    .withQueryOption(QueryStringConstants.COMP, 'blocklist')
    .withQueryOption(QueryStringConstants.BLOCK_LIST_TYPE, blocklisttype)
    .withQueryOption(QueryStringConstants.SNAPSHOT, options.snapshotId);

  BlobResult.setHeadersFromBlob(webResource, blob);

  options.requestLocationMode = RequestLocationMode.PRIMARY_OR_SECONDARY;

  var processResponseCallback = function (responseObject, next) {
    responseObject.blockListResult = null;
    if (!responseObject.error) {
      responseObject.blockListResult = BlockListResult.parse(responseObject.response.body.BlockList);
    }

    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.blockListResult, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

/**
* Generate a random block id prefix
*/
BlobService.prototype.generateBlockIdPrefix = function() {
  var prefix = Math.random().toString(16);
  return azureutil.zeroPaddingString(prefix, 8);
};

/**
* Get a block id according to prefix and block number
*/
BlobService.prototype.getBlockId = function(prefix, number) {
  return  prefix + '-' + azureutil.zeroPaddingString(number, 6);
};

// Private methods

/**
* Creates a new block to be committed as part of a blob.
* @ignore
*
* @this {BlobService}
* @param {string}             blockId                                   The block identifier.
* @param {string}             container                                 The container name.
* @param {string}             blob                                      The blob name.
* @param {Stream}             readStream                                The read stream.
* @param {int}                streamLength                              The stream length.
* @param {object}             [options]                                 The request options.
* @param {string}             [options.leaseId]                         The target blob lease identifier.
* @param {string}             [options.contentMD5]                      The blob’s MD5 hash.
* @param {object}             [options.accessConditions]                The access conditions. See http://msdn.microsoft.com/en-us/library/dd179371.aspx for more information.
* @param {LocationMode}       [options.locationMode]                    Specifies the location mode used to decide which location the request should be sent to. 
*                                                                       Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]             The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]        The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                       The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                       execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResponse}  callback                                    `error` will contain information
*                                                                       if an error occurs; otherwise 
*                                                                       `response` will contain information related to this operation.
*/
BlobService.prototype._createBlockFromStream = function (blockId, container, blob, readStream, streamLength, options, callback) {
  var resourceName = createResourceName(container, blob);

  var webResource = WebResource.put(resourceName)
    .withQueryOption(QueryStringConstants.COMP, 'block')
    .withQueryOption(QueryStringConstants.BLOCK_ID, new Buffer(blockId).toString('base64'))
    .withHeader(HeaderConstants.CONTENT_LENGTH, streamLength);

  BlobResult.setHeadersFromBlob(webResource, options);

  var processResponseCallback = function (responseObject, next) {
    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequestOutputStream(webResource, readStream, options, processResponseCallback);
};

/**
* Uploads a block blob from a stream.
* @ignore
*
* @this {BlobService}
* @param {string}             container                                   The container name.
* @param {string}             blob                                        The blob name.
* @param {string}             text                                        The blob text.
* @param (Stream)             stream                                      Stream to the data to store.
* @param {int}                length                                      The length of the stream or text to upload.
* @param {object}             [options]                                   The request options.
* @param {string}             [options.leaseId]                           The lease identifier.
* @param {object}             [options.metadata]                          The metadata key/value pairs.
* @param {bool}               [options.storeBlobContentMD5]               Specifies whether the blob's ContentMD5 header should be set on uploads. The default value is true for block blobs.
* @param {string}             [options.contentType]                       The MIME content type of the blob. The default type is application/octet-stream.
* @param {string}             [options.contentEncoding]                   The content encodings that have been applied to the blob.
* @param {string}             [options.contentLanguage]                   The natural languages used by this resource.
* @param {string}             [options.contentMD5]                        The MD5 hash of the blob content.
* @param {string}             [options.cacheControl]                      The Blob service stores this value but does not use or modify it.
* @param {string}             [options.contentDisposition]                The blob's content disposition.
* @param {object}             [options.accessConditions]                  The access conditions. See http://msdn.microsoft.com/en-us/library/dd179371.aspx for more information.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to. 
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {errorOrResult}  callback                                        `error` will contain information
*                                                                         if an error occurs; otherwise `result` will contain
*                                                                         information about the blob.
*                                                                         `response` will contain information related to this operation.
* @return {undefined}
*
*/
BlobService.prototype._putBlockBlob = function (container, blob, text, readStream, length, options, callback) {
  if (!options.speedSummary) {
    options.speedSummary = new SpeedSummary(blob);
  }

  var speedSummary = options.speedSummary;
  speedSummary.totalSize = length;

  var resourceName = createResourceName(container, blob);
  var webResource = WebResource.put(resourceName)
    .withHeader(HeaderConstants.CONTENT_TYPE, 'application/octet-stream')
    .withHeader(HeaderConstants.BLOB_TYPE_HEADER, BlobConstants.BlobTypes.BLOCK)
    .withHeader(HeaderConstants.CONTENT_LENGTH, length);

  if(!azureutil.objectIsNull(text) && azureutil.objectIsNull(options.contentMD5) && options.useTransactionalMD5) {
    options.contentMD5 = azureutil.getContentMd5(text);
  }

  BlobResult.setHeadersFromBlob(webResource, options);

  var processResponseCallback = function (responseObject, next) {
    responseObject.blobResult = null;
    if (!responseObject.error) {
      responseObject.blobResult = new BlobResult(container, blob);
      responseObject.blobResult.getPropertiesFromHeaders(responseObject.response.headers);
      if (options.metadata) {
        responseObject.blobResult.metadata = options.metadata;
      }
    }

    var finalCallback = function (returnObject) {
      if(!returnObject || !returnObject.error) {
        speedSummary.increment(length);
      }
      callback(returnObject.error, returnObject.blobResult, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  if (!azureutil.objectIsNull(text)) {
    this.performRequest(webResource, text, options, processResponseCallback);
  } else {
    this.performRequestOutputStream(webResource, readStream, options, processResponseCallback);
  }

  return options.speedSummary;
};

/**
* Creates and dispatches lease requests.
* @ignore
* 
* @this {BlobService}
* @param {object}             webResource                           The web resource.
* @param {string}             container                             The container name.
* @param {string}             blob                                  The blob name.
* @param {string}             leaseId                               The lease identifier. Required to renew, change or release the lease.
* @param {string}             leaseAction                           The lease action (BlobConstants.LeaseOperation.*). Required.
* @param {object}             userOptions                           The request options.
* @param {int}                [userOptions.leaseBreakPeriod]        The lease break period.
* @param {string}             [userOptions.leaseDuration]           The lease duration. Default is never to expire.
* @param {string}             [userOptions.proposedLeaseId]         The proposed lease identifier. This is required for the CHANGE lease action.
* @param {LocationMode}       [userOptions.locationMode]            Specifies the location mode used to decide which location the request should be sent to. 
*                                                                   Please see StorageUtilities.LocationMode for the possible values.
* @param {object}             [userOptions.accessConditions]        The access conditions. See http://msdn.microsoft.com/en-us/library/dd179371.aspx for more information.
* @param {int}                [userOptions.timeoutIntervalInMs]     The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [userOptions.maximumExecutionTimeInMs]The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                   The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                   execution time is checked intermittently while performing requests, and before executing retries.
* @param {Function(error, lease, response)}  callback               `error` will contain information
*                                                                   if an error occurs; otherwise `lease` will contain
*                                                                   the lease information.
*                                                                   `response` will contain information related to this operation.
*/
BlobService.prototype._leaseImpl = function (container, blob, leaseId, leaseAction, options, callback) {
  var webResource;
  if(!azureutil.objectIsNull(blob)) {
    validate.validateArgs('_leaseImpl', function (v) {
      v.string(blob, 'blob');
    });
    var resourceName = createResourceName(container, blob);
    webResource = WebResource.put(resourceName);
  } else {
    webResource = WebResource.put(container)
      .withQueryOption(QueryStringConstants.RESTYPE, 'container');
  }

  webResource.withQueryOption(QueryStringConstants.COMP, 'lease')
    .withHeader(HeaderConstants.LEASE_ID_HEADER, leaseId)
    .withHeader(HeaderConstants.LEASE_ACTION_HEADER, leaseAction.toLowerCase())
    .withHeader(HeaderConstants.LEASE_BREAK_PERIOD, options.leaseBreakPeriod)
    .withHeader(HeaderConstants.PROPOSED_LEASE_ID, options.proposedLeaseId)
    .withHeader(HeaderConstants.LEASE_DURATION, options.leaseDuration);

  var processResponseCallback = function (responseObject, next) {
    responseObject.leaseResult = null;
    if (!responseObject.error) {
      responseObject.leaseResult = new LeaseResult(container, blob);
      responseObject.leaseResult.getPropertiesFromHeaders(responseObject.response.headers);
    }

    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.leaseResult, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

/**
* Updates a page blob from text.
* @ignore
*
* @this {BlobService}
* @param {string}             container                                   The container name.
* @param {string}             blob                                        The blob name.
* @param {string}             text                                        The text string.
* @param {Stream}             readStream                                  The read stream.
* @param {int}                rangeStart                                  The range start.
* @param {int}                rangeEnd                                    The range end.
* @param {object}             [options]                                   The request options.
* @param {string}             [options.leaseId]                           The target blob lease identifier.
* @param {object}             [options.accessConditions]                  The access conditions. See http://msdn.microsoft.com/en-us/library/dd179371.aspx for more information.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to. 
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {Function(error, pageBlob, response)}  callback                  `error` will contain information
*                                                                         if an error occurs; otherwise `pageBlob` will contain
*                                                                         the blob information.
*                                                                         `response` will contain information related to this operation.
*/
BlobService.prototype._createPages = function (container, blob, text, readStream, rangeStart, rangeEnd, options, callback) {
  var request = this._updatePageBlobPagesImpl(container, blob, rangeStart, rangeEnd, BlobConstants.PageWriteOptions.UPDATE, options);

  // At this point, we have already validated that the range is less than 4MB. Therefore, we just need to calculate the contentMD5 if required.
  // Even when this is called from the createPagesFromStream method, it is pre-buffered and called with text.
  if(!azureutil.objectIsNull(text) && azureutil.objectIsNull(options.contentMD5) && options.useTransactionalMD5) {
    request.withHeader(HeaderConstants.CONTENT_MD5, azureutil.getContentMd5(text));
  }

  var processResponseCallback = function (responseObject, next) {
    responseObject.blobResult = null;
    if (!responseObject.error) {
      responseObject.blobResult = new BlobResult(container, blob);
      responseObject.blobResult.getPropertiesFromHeaders(responseObject.response.headers);
    }

    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.blobResult, returnObject.response);
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
* @ignore
*/
BlobService.prototype._updatePageBlobPagesImpl = function (container, blob, rangeStart, rangeEnd, writeMethod, options) {
  if (rangeStart && rangeStart % BlobConstants.PAGE_SIZE !== 0) {
    throw new Error(SR.INVALID_PAGE_START_OFFSET);
  }

  if (rangeEnd && (rangeEnd + 1) % BlobConstants.PAGE_SIZE !== 0) {
    throw new Error(SR.INVALID_PAGE_END_OFFSET);
  }

  // this is necessary if this is called from _createBlobFromChunkStream->_createPages
  if (!options) {
    options = {};
  }

  options.rangeStart = rangeStart;
  options.rangeEnd = rangeEnd;

  options.contentLength = writeMethod === BlobConstants.PageWriteOptions.UPDATE ? (rangeEnd - rangeStart) + 1 : 0;

  var resourceName = createResourceName(container, blob);
  var webResource = WebResource.put(resourceName)
      .withQueryOption(QueryStringConstants.COMP, 'page')
      .withHeader(HeaderConstants.CONTENT_TYPE, 'application/octet-stream')
      .withHeader(HeaderConstants.PAGE_WRITE, writeMethod)
  
  BlobResult.setHeadersFromBlob(webResource, options);

  return webResource;
};

/**
* Uploads a block blob or page blob from a stream.
* @ignore
*
* @this {BlobService}
* @param {string}             container                                   The container name.
* @param {string}             blob                                        The blob name.
* @param {string}             blobType                                    The blob type.
* @param (Stream)             stream                                      Stream to the data to store.
* @param {int}                streamLength                                The length of the stream to upload.
* @param {object|function}    [options]                                   The request options.
* @param {SpeedSummary}       [options.speedSummary]                      The download tracker objects;
* @param {int}                [options.parallelOperationThreadCount]      Parallel operation thread count
* @param {bool}               [options.useTransactionalMD5]               Calculate and send/validate content MD5 for transactions.
* @param {string}             [options.blockIdPrefix]                     The prefix to be used to generate the block id.
* @param {string}             [options.leaseId]                           The lease identifier.
* @param {object}             [options.metadata]                          The metadata key/value pairs.
* @param {bool}               [options.storeBlobContentMD5]               Specifies whether the blob's ContentMD5 header should be set on uploads.
* @param {string}             [options.contentType]                       The MIME content type of the blob. The default type is application/octet-stream.
* @param {string}             [options.contentEncoding]                   The content encodings that have been applied to the blob.
* @param {string}             [options.contentLanguage]                   The natural languages used by this resource.
* @param {string}             [options.contentMD5]                        The MD5 hash of the blob content.
* @param {string}             [options.cacheControl]                      The Blob service stores this value but does not use or modify it.
* @param {string}             [options.contentDisposition]                The blob's content disposition.
* @param {object}             [options.accessConditions]                  The access conditions. See http://msdn.microsoft.com/en-us/library/dd179371.aspx for more information.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to. 
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {function(error, null)}  callback                                The callback function.
* @return {SpeedSummary}
*/

BlobService.prototype._createBlobFromChunkStream = function(container, blob, blobType, chunkStream, streamLength, options, callback) {
  this.logger.debug(util.format('_createBlobFromChunkStream for blob %s', blob));

  var apiName;
  var isBlockBlobUpload;
  var sizeLimitation;
  var originalContentMD5 = options.contentMD5;
  if (blobType == BlobConstants.BlobTypes.BLOCK) {
    apiName = 'createBlockFromText';
    isBlockBlobUpload = true;
    sizeLimitation = BlobConstants.DEFAULT_WRITE_BLOCK_SIZE_IN_BYTES;
  } else if (blobType == BlobConstants.BlobTypes.PAGE) {
    apiName = '_createPages';
    isBlockBlobUpload = false;
    sizeLimitation = BlobConstants.DEFAULT_WRITE_PAGE_SIZE_IN_BYTES;
  } else {
    var error = new Error(util.format('Unknown blob type %s', blobType));
    callback(error);
    return;
  }

  this._setOperationExpiryTime(options);

  // initialize the speed summary
  var speedSummary = options.speedSummary || new SpeedSummary(blob);
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
    leaseId: options.leaseId,
    timeoutIntervalInMs: options.timeoutIntervalInMs,
    operationExpiryTime: options.operationExpiryTime
  };

  // initialize block blob vars
  var blockIdPrefix = options.blockIdPrefix || this.generateBlockIdPrefix();
  var blockCount = 0;
  var blockIds = [];

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

    if (isBlockBlobUpload) {
      var blockId = self.getBlockId(blockIdPrefix, blockCount);
      blockIds.push(blockId);

      operation = new BatchOperation.RestOperation(self, apiName, blockId, container, blob, data, rangeOptions, function(error) {
        if(!error) {
          autoIncrement();
        }
        allocator.releaseBuffer(data);
        data = null;
      });

      blockCount++;
    } else {
      if (azureutil.isBufferAllZero(data)) {
        self.logger.debug(util.format('Skip upload data from %s bytes to %s bytes to blob %s', range.start, range.end, blob));
        speedSummary.increment(data.length);
      } else {
        operation = new BatchOperation.RestOperation(self, apiName, container, blob, data, null, range.start, range.end, rangeOptions, function(error) {
          if(!error) {
            autoIncrement();
          }
          allocator.releaseBuffer(data);
          data = null;
        });
      }
    }

    if (operation) {
      full = batchOperations.addOperation(operation);
      operation = null;

      if(full) {
        self.logger.debug('File stream paused');
        chunkStream.pause();
      }
    }
  });

  chunkStream.on('end', function () {
    self.logger.debug(util.format('File read stream ended for blob %s', blob));
    batchOperations.enableComplete();
  });

  batchOperations.on('drain', function () {
    self.logger.debug('file stream resume');
    chunkStream.resume();
  });

  batchOperations.on('end', function (error) {
    self.logger.debug('batch operations commited');
 
    speedSummary = null;
    if (error) {
      callback(error);
      return;
    }

    if (originalContentMD5) {
      options.contentMD5 = originalContentMD5;
    } else if (options.storeBlobContentMD5) {
      options.contentMD5 =  chunkStream.getContentMd5('base64');
    }

    if (isBlockBlobUpload) {
      //commit block list
      var blockList = {'UncommittedBlocks': blockIds};

      self.commitBlocks(container, blob, blockList, options, function (error, blockList, response) {
        self.logger.debug(util.format('Blob %s committed', blob));

        if(error) {
          chunkStream.finish();

          callback(error);
        } else {
          var blob = {};
          blob['commmittedBlocks'] = blockIds;

          chunkStream.finish();
          callback(error, blob, response);
        }
      });
    } else {
      // upload page blob completely
      self.setBlobProperties(container, blob, options, function (error, blob, response) {
        chunkStream.finish();
        callback(error, blob, response);
      });
    }
  });

  return speedSummary;
};

/**
* Checks whether or not a container exists on the service.
* @ignore
*
* @this {BlobService}
* @param {string}             container                                         The container name.
* @param {string}             primaryOnly                                       If true, the request will be executed against the primary storage location.
* @param {object}             [options]                                         The request options.
* @param {string}             [options.leaseId]                                 The lease identifier.
* @param {LocationMode}       [options.locationMode]                            Specifies the location mode used to decide which location the request should be sent to. 
*                                                                               Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]                     The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]                The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                               The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                               execution time is checked intermittently while performing requests, and before executing retries.
* @param {Function(error, containerExists, response)}  callback                 `error` will contain information
*                                                                               if an error occurs; otherwise `containerExists` will contain
*                                                                               be true if the container exists, or false if the container does not exist. 
*                                                                               `response` will contain information related to this operation.
*/
BlobService.prototype._doesContainerExist = function (container, primaryOnly, options, callback) {
  var webResource = WebResource.head(container)
    .withQueryOption(QueryStringConstants.RESTYPE, 'container')
    .withHeader(HeaderConstants.LEASE_ID_HEADER, options.leaseId);

  if(primaryOnly === false) {
    options.requestLocationMode = RequestLocationMode.PRIMARY_OR_SECONDARY;
  }

  var processResponseCallback = function (responseObject, next) {
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

  this.performRequest(webResource, null, options, processResponseCallback);
};

/**
* Checks whether or not a blob exists on the service.
* @ignore
*
* @this {BlobService}
* @param {string}             container                                         The container name.
* @param {string}             blob                                              The blob name.
* @param {string}             primaryOnly                                       If true, the request will be executed against the primary storage location.
* @param {object}             [options]                                         The request options.
* @param {string}             [options.leaseId]                                 The lease identifier.
* @param {LocationMode}       [options.locationMode]                            Specifies the location mode used to decide which location the request should be sent to. 
*                                                                               Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]                     The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]                The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                               The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                               execution time is checked intermittently while performing requests, and before executing retries.
* @param {Function(error, blobExists, response)}  callback                      `error` will contain information
*                                                                               if an error occurs; otherwise `blobExists` will 
*                                                                               be true if the blob exists, or false if the blob does not exist. 
*                                                                               `response` will contain information related to this operation.
*/
BlobService.prototype._doesBlobExist = function (container, blob, primaryOnly, options, callback) {
  var resourceName = createResourceName(container, blob);
  var webResource = WebResource.head(resourceName)
    .withHeader(HeaderConstants.LEASE_ID_HEADER, options.leaseId);

  if(primaryOnly === false) {
    options.requestLocationMode = RequestLocationMode.PRIMARY_OR_SECONDARY;
  }

  var processResponseCallback = function (responseObject, next) {
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

  this.performRequest(webResource, null, options, processResponseCallback);
};

/**
* @ignore
*/
BlobService.prototype._setBlobPropertiesHelper = function (settings) {
  var processResponseCallback = function(responseObject, next) {
    responseObject.blobResult = null;
    if (!responseObject.error) {
      responseObject.blobResult = new BlobResult(settings.container, settings.blob);
      responseObject.blobResult.getPropertiesFromHeaders(responseObject.response.headers);
    }
    
    var finalCallback = function(returnObject) {
      settings.callback(returnObject.error, returnObject.blobResult, returnObject.response);
    };

    next(responseObject, finalCallback);
  };
  
  this.performRequest(settings.webResource, null, settings.options, processResponseCallback);
};

/**
* @ignore
*/
BlobService.prototype._validateLengthAndMD5 = function (options, responseObject) {
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
  // If getBlobToText called this method, then the responseObject.length and responseObject.contentMD5 are not set. Calculate them first using responseObject.response.body and then validate.
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
* @ignore
*/
BlobService.prototype._setRangeContentMD5Header = function (webResource, options) {
  if(!azureutil.objectIsNull(options.rangeStart) && options.useTransactionalMD5) {
    if(azureutil.objectIsNull(options.rangeEnd)) {
      throw new Error(util.format(SR.ARGUMENT_NULL_OR_EMPTY, options.rangeEndHeader));
    }

    var size = parseInt(options.rangeEnd, 10) - parseInt(options.rangeStart, 10) + 1;
    if (size > BlobConstants.MAX_RANGE_GET_SIZE_WITH_MD5) {
      throw new Error(SR.INVALID_RANGE_FOR_MD5);
    } else {
      webResource.withHeader(HeaderConstants.RANGE_GET_CONTENT_MD5, 'true');
    }
  }
};

/**
* The callback for {BlobService~getBlobToText}.
* @typedef {function} BlobService~blobToText
* @param {object} error      If an error occurs, the error information.
* @param {string} text       The text returned from the blob.
* @param {object} blockBlob  Information about the blob.
* @param {object} response   Information related to this operation.
*/

BlobService.SpeedSummary = SpeedSummary;

module.exports = BlobService;
