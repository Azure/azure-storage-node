﻿// 
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
var util = require('util');
var _ = require('underscore');
var extend = require('extend');

var azureCommon = require('./../../common/common');
var azureutil = azureCommon.util;
var SR = azureCommon.SR;
var validate = azureCommon.validate;

var StorageServiceClient = azureCommon.StorageServiceClient;
var WebResource = azureCommon.WebResource;
var Constants = azureCommon.Constants;
var QueryStringConstants = Constants.QueryStringConstants;
var HeaderConstants = Constants.HeaderConstants;
var RequestLocationMode = Constants.RequestLocationMode;

// Models requires
var QueueResult = require('./models/queueresult');
var AclResult = azureCommon.AclResult;
var QueueMessageResult = require('./models/queuemessageresult');
var ServicePropertiesResult = azureCommon.ServicePropertiesResult;
var ServiceStatsParser = azureCommon.ServiceStatsParser;

/**
* Creates a new QueueService object.
* If no connection string or storageaccount and storageaccesskey are provided,
* the AZURE_STORAGE_CONNECTION_STRING or AZURE_STORAGE_ACCOUNT and AZURE_STORAGE_ACCESS_KEY environment variables will be used.
* @class
* The QueueService class is used to perform operations on the Microsoft Azure Queue Service.
* 
* For more information on using the Queue Service, as well as task focused information on using it from a Node.js application, see
* [How to Use the Queue Service from Node.js](http://azure.microsoft.com/en-us/documentation/articles/storage-nodejs-how-to-use-queues/).
* The following defaults can be set on the Queue service.
* encodeMessage                                       A flag indicating whether the message should be base-64 encoded. Default is true.
* defaultTimeoutIntervalInMs                          The default timeout interval, in milliseconds, to use for request made via the Queue service.
* defaultMaximumExecutionTimeInMs                     The default maximum execution time across all potential retries, for requests made via the Queue service.
* defaultLocationMode                                 The default location mode for requests made via the Queue service.
* useNagleAlgorithm                                   Determines whether the Nagle algorithm is used for requests made via the Queue service; true to use the  
*                                                     Nagle algorithm; otherwise, false. The default value is false.
* @constructor
* @augments {StorageServiceClient}
*
* @param {string} [storageAccountOrConnectionString]  The storage account or the connection string.
* @param {string} [storageAccessKey]                  The storage access key.
* @param {string|object} [host]                       The host address. To define primary only, pass a string. 
*                                                     Otherwise 'host.primaryHost' defines the primary host and 'host.secondaryHost' defines the secondary host.
* @param {string} [sasToken]                          The Shared Access Signature token.
*/
function QueueService(storageAccountOrConnectionString, storageAccessKey, host, sasToken) {
  var storageServiceSettings = StorageServiceClient.getStorageSettings(storageAccountOrConnectionString, storageAccessKey, host, sasToken);

  QueueService['super_'].call(this,
    storageServiceSettings._name,
    storageServiceSettings._key,
    storageServiceSettings._queueEndpoint,
    storageServiceSettings._usePathStyleUri,
    storageServiceSettings._sasToken);

  if (this.anonymous) {
    throw new Error(SR.ANONYMOUS_ACCESS_BLOBSERVICE_ONLY);
  }

  this.encodeMessage = true;
}

util.inherits(QueueService, StorageServiceClient);

/**
* Gets the service stats for a storage account’s Queue service.
*
* @this {QueueService}
* @param {object}       [options]                                         The request options.
* @param {LocationMode} [options.locationMode]                            Specifies the location mode used to decide which location the request should be sent to. 
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}          [options.timeoutIntervalInMs]                     The server timeout interval, in milliseconds, to use for the request.
* @param {int}          [options.maximumExecutionTimeInMs]                The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {bool}         [options.useNagleAlgorithm]                       Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                         The default value is false.
* @param {errorOrResult}  callback                                        `error` will contain information
*                                                                         if an error occurs; otherwise, `result`
*                                                                         will contain the stats and `response`
*                                                                         will contain information related to this operation.
*/
QueueService.prototype.getServiceStats = function (optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('getServiceStats', function (v) {
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
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
* Gets the properties of a storage account’s Queue service, including Microsoft Azure Storage Analytics.
*
* @this {QueueService}
* @param {object}             [options]                                 The request options.
* @param {LocationMode}       [options.locationMode]                    Specifies the location mode used to decide which location the request should be sent to. 
*                                                                       Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]             The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]        The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                       The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                       execution time is checked intermittently while performing requests, and before executing retries.
* @param {bool}               [options.useNagleAlgorithm]               Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                       The default value is false.
* @param {errorOrResult}  callback                                      `error` will contain information
*                                                                       if an error occurs; otherwise, `errorOrResult`
*                                                                       will contain the properties and `response`
*                                                                       will contain information related to this operation.
*/
QueueService.prototype.getServiceProperties = function (optionsOrCallback, callback) {
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
    responseObject.ServicePropertiesResult = null;
    if (!responseObject.error) {
      responseObject.ServicePropertiesResult = ServicePropertiesResult.parse(responseObject.response.body.StorageServiceProperties);
    }

    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.ServicePropertiesResult, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

/**
* Sets the properties of a storage account’s Queue service, including Microsoft Azure Storage Analytics.
* You can also use this operation to set the default request version for all incoming requests that do not have a version specified.
*
* @this {QueueService}
* @param {object}             serviceProperties                        The service properties.
* @param {object}             [options]                                The request options.
* @param {LocationMode}       [options.locationMode]                   Specifies the location mode used to decide which location the request should be sent to. 
*                                                                      Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]            The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]       The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                      The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                      execution time is checked intermittently while performing requests, and before executing retries.
* @param {bool}               [options.useNagleAlgorithm]              Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                      The default value is false.
* @param {errorOrResponse}  callback                                   `error` will contain information
*                                                                      if an error occurs; otherwise, `response`
*                                                                      will contain information related to this operation.
*/
QueueService.prototype.setServiceProperties = function (serviceProperties, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('setServiceProperties', function (v) {
    v.callback(callback);
  });

  var servicePropertiesXml = ServicePropertiesResult.serialize(serviceProperties);

  var options = extend(true, {}, userOptions);
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
* Lists a segment containing a collection of queue items whose names begin with the specified prefix under the given account.
*
* @this {QueueService}
* @param {object}             currentToken                                A continuation token returned by a previous listing operation. Please use 'null' or 'undefined' if this is the first operation.
* @param {object}             [options]                                   The request options.
* @param {int}                [options.maxResults]                        Specifies the maximum number of queues to return per call to Azure storage. This does NOT affect list size returned by this function. (maximum: 5000)
* @param {string}             [options.include]                           Include this parameter to specify that the queue's metadata be returned as part of the response body. (allowed values: '', 'metadata')
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to. 
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {bool}               [options.useNagleAlgorithm]                 Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                         The default value is false.
* @param {errorOrResult}  callback                                        `error` will contain information
*                                                                         if an error occurs; otherwise `result` will contain `entries` and `continuationToken`. 
*                                                                         `entries`  gives a list of queues and the `continuationToken` is used for the next listing operation.
*                                                                         `response` will contain information related to this operation.
*/
QueueService.prototype.listQueuesSegmented = function (currentToken, optionsOrCallback, callback) {
  this.listQueuesSegmentedWithPrefix(null /* prefix */, currentToken, optionsOrCallback, callback);
};

/**
* Lists a segment containing a collection of queue items  under the given account.
*
* @this {QueueService}
* @param {string}             prefix                                      The prefix of the queue name.
* @param {object}             currentToken                                A continuation token returned by a previous listing operation. Please use 'null' or 'undefined' if this is the first operation.* @param {string}             [options.prefix]                  Filters the results to return only queues whose name begins with the specified prefix.
* @param {object}             [options]                                   The request options.
* @param {string}             [options.marker]                            String value that identifies the portion of the list to be returned with the next list operation.
* @param {int}                [options.maxResults]                        Specifies the maximum number of queues to return per call to Azure storage. This does NOT affect list size returned by this function. (maximum: 5000)
* @param {string}             [options.include]                           Include this parameter to specify that the queue's metadata be returned as part of the response body. (allowed values: '', 'metadata')
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to. 
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {bool}               [options.useNagleAlgorithm]                 Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                         The default value is false.
* @param {errorOrResult}  callback                                        `error` will contain information
*                                                                         if an error occurs; otherwise `result` will contain `entries` and `continuationToken`. 
*                                                                         `entries`  gives a list of queues and the `continuationToken` is used for the next listing operation.
*                                                                         `response` will contain information related to this operation.
*/
QueueService.prototype.listQueuesSegmentedWithPrefix = function (prefix, currentToken, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('listQueuesSegmentedWithPrefix', function (v) {
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  var webResource = WebResource.get();
  webResource.withQueryOption(QueryStringConstants.COMP, 'list')
    .withQueryOption(QueryStringConstants.MAX_RESULTS, options.maxResults)
    .withQueryOption(QueryStringConstants.INCLUDE, options.include)
    .withQueryOption(QueryStringConstants.PREFIX, prefix);

  if(!azureutil.objectIsNull(currentToken)) {
    webResource.withQueryOption(QueryStringConstants.MARKER, currentToken.nextMarker);
  }

  options.requestLocationMode = azureutil.getNextListingLocationMode(currentToken);

  var processResponseCallback = function (responseObject, next) {
    responseObject.listQueuesResult = null;

    if (!responseObject.error) {
      responseObject.listQueuesResult = {
        entries: null,
        continuationToken: null
      };
      responseObject.listQueuesResult.entries = [];
      var queues = [];

      if (responseObject.response.body.EnumerationResults.Queues && responseObject.response.body.EnumerationResults.Queues.Queue) {
        queues = responseObject.response.body.EnumerationResults.Queues.Queue;

        if (!_.isArray(queues)) {
          queues = [ queues ];
        }

        queues.forEach(function (currentQueue) {
          var queueResult = QueueResult.parse(currentQueue);
          responseObject.listQueuesResult.entries.push(queueResult);
        });

        if(responseObject.response.body.EnumerationResults.NextMarker) {
          responseObject.listQueuesResult.continuationToken = {
            nextMarker: null,
            targetLocation: null
          };

          responseObject.listQueuesResult.continuationToken.nextMarker = responseObject.response.body.EnumerationResults.NextMarker;
          responseObject.listQueuesResult.continuationToken.targetLocation = responseObject.targetLocation;
        }
      }
    }

    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.listQueuesResult, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

/**
* Checks to see if a queue exists.
*
* @this {QueueService}
* @param {string}             queue                                       The queue name.
* @param {object}             [options]                                   The request options.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to. 
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {bool}               [options.useNagleAlgorithm]                 Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                         The default value is false.
* @param {errorOrResult}                   callback                       `error` will contain information
*                                                                         if an error occurs; otherwise, `result`
*                                                                         will be true if the queue exists and false if not,
*                                                                         and `response` will contain information related to this operation.
*/
QueueService.prototype.doesQueueExist = function (queue, optionsOrCallback, callback) {
  this._doesQueueExist(queue, false, optionsOrCallback, callback);
};

/**
* Creates a new queue under the given account.
*
* @this {QueueService}
* @param {string}             queue                                       The queue name.
* @param {object}             [options]                                   The request options.
* @param {object}             [options.metadata]                          The metadata key/value pairs.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to. 
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {bool}               [options.useNagleAlgorithm]                 Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                         The default value is false.
* @param {errorOrResult}  callback                                        `error` will contain information
*                                                                         if an error occurs; otherwise `result` will contain
*                                                                         the queue information.
*                                                                         `response` will contain information related to this operation.
*/
QueueService.prototype.createQueue = function (queue, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('createQueue', function (v) {
    v.string(queue, 'queue');
    v.queueNameIsValid(queue);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  var webResource = WebResource.put(queue);
  if (options) {
    webResource.addOptionalMetadataHeaders(options.metadata);
  }

  var processResponseCallback = function (responseObject, next) {
    responseObject.queueResult = null;
    if (!responseObject.error) {
      responseObject.queueResult = new QueueResult(queue);
      if (options && options.metadata) {
        responseObject.queueResult.metadata = options.metadata;
      }
    }

    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.queueResult, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

/**
* Creates a new queue under the given account if it doesn't exist.
*
* @this {QueueService}
* @param {string}             queue                                       The queue name.
* @param {object}             [options]                                   The request options.
* @param {object}             [options.metadata]                          The metadata key/value pairs.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to. 
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {bool}               [options.useNagleAlgorithm]                 Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                         The default value is false.
* @param {errorOrResult}  callback                                       `error` will contain information
*                                                                         if an error occurs; otherwise `result` will be true if the 
*                                                                         queue was created by this operation and false if not, and 
*                                                                         `response` will contain information related to this operation.
*
* @example
* var azure = require('azure-storage');
* var queueService = azure.createQueueService();
* queueService.createQueueIfNotExists('taskqueue', function(error) {
*   if(!error) {
*     // Queue created or exists
*   }
* }); 
*/
QueueService.prototype.createQueueIfNotExists = function (queue, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('createQueueIfNotExists', function (v) {
    v.string(queue, 'queue');
    v.queueNameIsValid(queue);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  var self = this;
  self._doesQueueExist(queue, true, options, function(error, exists, response) {
    if (error) {
      callback(error, exists, response);
    } else if (exists) {
      response.isSuccessful = true;
      callback(error, false, response);
    } else {
      self.createQueue(queue, options, function(createError, responseQueue, createResponse) {
        var created;
        if (!createError) {
          created = true;
        }
        else if (createError && createError.statusCode === Constants.HttpConstants.HttpResponseCodes.Conflict && createError.code === Constants.QueueErrorCodeStrings.QUEUE_ALREADY_EXISTS) {
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
* Permanently deletes the specified queue.
*
* @this {QueueService}
* @param {string}             queue                                       The queue name.
* @param {object}             [options]                                   The request options.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to. 
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {bool}               [options.useNagleAlgorithm]                 Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                         The default value is false.
* @param {errorOrResponse}  callback                                      `error` will contain information if an error occurs; 
*                                                                         `response` will contain information related to this operation.
*/
QueueService.prototype.deleteQueue = function (queue, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('deleteQueue', function (v) {
    v.string(queue, 'queue');
    v.queueNameIsValid(queue);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  var webResource = WebResource.del(queue);
  var processResponseCallback = function (responseObject, next) {
    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

/**
* Permanently deletes the specified queue if it exists.
*
* @this {QueueService}
* @param {string}             queue                                       The queue name.
* @param {object}             [options]                                   The request options.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to. 
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {bool}               [options.useNagleAlgorithm]                 Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                         The default value is false.
* @param {errorOrResult}  callback                                        `error` will contain information
*                                                                         if an error occurs; otherwise `result` will contain
*                                                                         'true' if the queue was deleted and 'false' if the queue did not exist.
*                                                                         `response` will contain information related to this operation.
*/
QueueService.prototype.deleteQueueIfExists = function (queue, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('deleteQueueIfExists', function (v) {
    v.string(queue, 'queue');
    v.queueNameIsValid(queue);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  var self = this;
  self._doesQueueExist(queue, true, options, function existsCallback(error, exists, response) {
    if (error) {
      callback(error, exists, response);
    } else if (!exists) {
      response.isSuccessful = true;
      callback(error, false, response);
    } else {
      self.deleteQueue(queue, options, function(deleteError, deleteResponse) {
        var deleted;
        if (!deleteError) {
          deleted = true;
        } else if (deleteError && deleteError.statusCode === Constants.HttpConstants.HttpResponseCodes.NotFound && deleteError.code === Constants.QueueErrorCodeStrings.QUEUE_NOT_FOUND) {
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
* Returns queue properties, including user-defined metadata.
*
* @this {QueueService}
* @param {string}             queue                                       The queue name.
* @param {object}             [options]                                   The request options.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to. 
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {bool}               [options.useNagleAlgorithm]                 Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                         The default value is false.
* @param {errorOrResult}  callback                                        `error` will contain information
*                                                                         if an error occurs; otherwise `result` will contain
*                                                                         the queue information.
*                                                                         `response` will contain information related to this operation.
*/
QueueService.prototype.getQueueMetadata = function (queue, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('getQueueMetadata', function (v) {
    v.string(queue, 'queue');
    v.queueNameIsValid(queue);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  var webResource = WebResource.get(queue)
    .withQueryOption(QueryStringConstants.COMP, 'metadata');

  options.requestLocationMode = Constants.RequestLocationMode.PRIMARY_OR_SECONDARY;

  var self = this;
  var processResponseCallback = function (responseObject, next) {
    responseObject.queueResult = null;
    if (!responseObject.error) {
      responseObject.queueResult = new QueueResult(queue);
      responseObject.queueResult.metadata = self.parseMetadataHeaders(responseObject.response.headers);
      responseObject.queueResult.getPropertiesFromHeaders(responseObject.response.headers);
    }

    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.queueResult, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

/**
* Sets user-defined metadata on the specified queue. Metadata is associated with the queue as name-value pairs.
*
* @this {QueueService}
* @param {string}             queue                                       The queue name.
* @param {object}             metadata                                    The metadata key/value pairs.
* @param {object}             [options]                                   The request options.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to. 
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {bool}               [options.useNagleAlgorithm]                 Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                         The default value is false.
* @param {errorOrResult}  callback                                        `error` will contain information
*                                                                         if an error occurs; otherwise `result` will contain
*                                                                         the queue information.
*                                                                         `response` will contain information related to this operation.
*/
QueueService.prototype.setQueueMetadata = function (queue, metadata, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('setQueueMetadata', function (v) {
    v.string(queue, 'queue');
    v.queueNameIsValid(queue);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  var webResource = WebResource.put(queue)
    .withQueryOption(QueryStringConstants.COMP, 'metadata')
    .addOptionalMetadataHeaders(metadata);

  var processResponseCallback = function (responseObject, next) {
    responseObject.queueResult = null;
    if (!responseObject.error) {
      responseObject.queueResult = new QueueResult(queue, metadata);
      responseObject.queueResult.getPropertiesFromHeaders(responseObject.response.headers);
    }

    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.queueResult, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

/**
* Adds a new message to the back of the message queue. 
* The encoded message can be up to 64KB in size for versions 2011-08-18 and newer, or 8KB in size for previous versions. 
* Unencoded messages must be in a format that can be included in an XML request with UTF-8 encoding. 
* Queue messages are encoded by default. See queueService.encodeMessage to set encoding defaults. 
* 
* @this {QueueService}
* @param {string}             queue                                       The queue name.
* @param {string|Buffer}      messageText                                 The message text.
* @param {object}             [options]                                   The request options.
* @param {int}                [options.messagettl]                        The time-to-live interval for the message, in seconds. The maximum time-to-live allowed is 7 days. If this parameter is omitted, the default time-to-live is 7 days
* @param {int}                [options.visibilityTimeout]                 Specifies the new visibility timeout value, in seconds, relative to server time. The new value must be larger than or equal to 0, and cannot be larger than 7 days. The visibility timeout of a message cannot be set to a value later than the expiry time. visibilitytimeout should be set to a value smaller than the time-to-live value.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to. 
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {bool}               [options.useNagleAlgorithm]                 Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                         The default value is false.
* @param {errorOrResult}  callback                                        `error` will contain information
*                                                                         if an error occurs; otherwise `result` will contain
*                                                                         the result.
*                                                                         `response` will contain information related to this operation.
*
* @example
* var azure = require('azure-storage');
* var queueService = azure.createQueueService();
* queueService.createMessage('taskqueue', 'Hello world!', function(error) {
*   if(!error) {
*     // Message inserted
*   }
* });
*/
QueueService.prototype.createMessage = function (queue, messageText, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('createMessage', function (v) {
    v.string(queue, 'queue');
    v.queueNameIsValid(queue);
    v.callback(callback);
  });

  var xmlMessageDescriptor = QueueMessageResult.serialize(messageText, this.encodeMessage);

  var options = extend(true, {}, userOptions);
  var webResource = WebResource.post(queue + '/messages')
    .withHeader(HeaderConstants.CONTENT_TYPE, 'application/atom+xml;charset="utf-8"')
    .withHeader(HeaderConstants.CONTENT_LENGTH, Buffer.byteLength(xmlMessageDescriptor, 'utf8'))
    .withQueryOption(QueryStringConstants.MESSAGE_TTL, options.messagettl)
    .withQueryOption(QueryStringConstants.VISIBILITY_TIMEOUT, options.visibilityTimeout)
    .withBody(xmlMessageDescriptor);

  var processResponseCallback = function (responseObject, next) {
    responseObject.queueMessageResult = null;
    if (!responseObject.error) {
      responseObject.queueMessageResult = new QueueMessageResult(queue);
      responseObject.queueMessageResult.getPropertiesFromHeaders(responseObject.response.headers);
    }

    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.queueMessageResult, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, webResource.body, options, processResponseCallback);
};

/**
* Retrieves a message from the queue and makes it invisible to other consumers.
*
* @this {QueueService}
* @param {string}             queue                                       The queue name.
* @param {object}             [options]                                   The request options.
* @param {int}                [options.numOfMessages]                     A nonzero integer value that specifies the number of messages to retrieve from the queue, up to a maximum of 32. By default, a single message is retrieved from the queue with this operation.
* @param {bool}               [options.peekOnly]                          Boolean value indicating wether the visibility of the message should be changed or not.
* @param {int}                [options.visibilityTimeout]                 Required if not peek only. Specifies the new visibility timeout value, in seconds, relative to server time. The new value must be larger than or equal to 0, and cannot be larger than 7 days. The visibility timeout of a message can be set to a value later than the expiry time.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to. 
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {bool}               [options.useNagleAlgorithm]                 Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                         The default value is false.
* @param {errorOrResult}  callback                                        `error` will contain information
*                                                                         if an error occurs; otherwise `result` will contain
*                                                                         the message.
*                                                                         `response` will contain information related to this operation.
*
* @example    
* var azure = require('azure-storage');
* var queueService = azure.createQueueService();
* var queueName = 'taskqueue';
* queueService.getMessages(queueName, function(error, serverMessages) {
*   if(!error) {
*     // Process the message in less than 30 seconds, the message
*     // text is available in serverMessages[0].messagetext
*     queueService.deleteMessage(queueName, serverMessages[0].messageid, serverMessages[0].popreceipt, function(error) {
*       if(!error){
*           // Message deleted
*       }
*     });
*   }
* });
*/
QueueService.prototype.getMessages = function (queue, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('getMessages', function (v) {
    v.string(queue, 'queue');
    v.queueNameIsValid(queue);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);

  var webResource = WebResource.get(queue + '/messages')
    .withQueryOption(QueryStringConstants.NUM_OF_MESSAGES, options.numOfMessages)
    .withQueryOption(QueryStringConstants.VISIBILITY_TIMEOUT, options.visibilityTimeout)
    .withQueryOption(QueryStringConstants.PEEK_ONLY, options.peekOnly);

  var encodeMessage = this.encodeMessage;
  var processResponseCallback = function (responseObject, next) {
    responseObject.queueMessageResults = null;

    if (!responseObject.error) {
      responseObject.queueMessageResults = [];

      if (responseObject.response.body.QueueMessagesList && responseObject.response.body.QueueMessagesList.QueueMessage) {
        var messages = responseObject.response.body.QueueMessagesList.QueueMessage;

        if (!_.isArray(messages)) {
          messages = [ messages ];
        }

        messages.forEach(function (message) {
          var queueMessageResult = QueueMessageResult.parse(message, encodeMessage);
          responseObject.queueMessageResults.push(queueMessageResult);
        });
      }
    }

    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.queueMessageResults, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

/**
* Retrieves a message from the front of the queue, without changing the message visibility.
*
* @this {QueueService}
* @param {string}             queue                                       The queue name.
* @param {object}             [options]                                   The request options.
* @param {int}                [options.numOfMessages]                     A nonzero integer value that specifies the number of messages to retrieve from the queue, up to a maximum of 32. By default, a single message is retrieved from the queue with this operation.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to. 
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {bool}               [options.useNagleAlgorithm]                 Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                         The default value is false.
* @param {errorOrResult}  callback                                        `error` will contain information
*                                                                         if an error occurs; otherwise `result` will contain
*                                                                         the message.
*                                                                         `response` will contain information related to this operation.
*/
QueueService.prototype.peekMessages = function (queue, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('peekMessages', function (v) {
    v.string(queue, 'queue');
    v.queueNameIsValid(queue);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);

  if (!options.numOfMessages) {
    options.numOfMessages = 1;
  }

  options.peekOnly = true;
  this.getMessages(queue, options, callback);
};

/**
* Deletes a specified message from the queue.
*
* @this {QueueService}
* @param {string}             queue                                       The queue name.
* @param {string}             messageId                                   The message identifier of the message to delete.
* @param {string}             popReceipt                                  A valid pop receipt value returned from an earlier call to the Get Messages or Update Message operation
* @param {object}             [options]                                   The request options.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to. 
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {bool}               [options.useNagleAlgorithm]                 Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                         The default value is false.
* @param {errorOrResponse}  callback                                      `error` will contain information if an error occurs; 
*                                                                         `response` will contain information related to this operation.
*/
QueueService.prototype.deleteMessage = function (queue, messageId, popReceipt, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('deleteMessage', function (v) {
    v.string(queue, 'queue');
    v.queueNameIsValid(queue);
    v.callback(callback);
  });

  if (azureutil.objectIsNull(popReceipt)) {
    throw new Error(SR.INVALID_POP_RECEIPT);
  }

  if (azureutil.objectIsNull(messageId)) {
    throw new Error(SR.INVALID_MESSAGE_ID);
  }

  var options = extend(true, {}, userOptions);
  var webResource = WebResource.del(queue + '/messages/' + messageId)
    .withQueryOption(QueryStringConstants.POP_RECEIPT, popReceipt, null, true);

  var processResponseCallback = function (responseObject, next) {
    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

/**
* Clears all messages from the queue.
*
* @this {QueueService}
* @param {string}             queue                                       The queue name.
* @param {object}             [options]                                   The request options.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to. 
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {bool}               [options.useNagleAlgorithm]                 Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                         The default value is false.
* @param {errorOrResponse}  callback                                      `error` will contain information
*                                                                         if an error occurs; otherwise 
*                                                                         `response` will contain information related to this operation.
*/
QueueService.prototype.clearMessages = function (queue, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('clearMessages', function (v) {
    v.string(queue, 'queue');
    v.queueNameIsValid(queue);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  var webResource = WebResource.del(queue + '/messages');

  var processResponseCallback = function (responseObject, next) {
    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

/**
* Updates the visibility timeout of a message. You can also use this operation to update the contents of a message.
* A message must be in a format that can be included in an XML request with UTF-8 encoding, and the encoded message can be up to 64KB in size.
*
* @this {QueueService}
* @param {string}             queue                                       The queue name.
* @param {string}             messageId                                   The message identifier of the message to update.
* @param {string}             popReceipt                                  A valid pop receipt value returned from an earlier call to the Get Messages or Update Message operation
* @param {int}                visibilityTimeout                           Specifies the new visibility timeout value, in seconds, relative to server time. The new value must be larger than or equal to 0, and cannot be larger than 7 days. The visibility timeout of a message can be set to a value later than the expiry time.
* @param {object}             [options]                                   The request options.
* @param {object}             [options.messageText]                       The new message text.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to. 
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {bool}               [options.useNagleAlgorithm]                 Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                         The default value is false.
* @param {errorOrResult}  callback                                        `error` will contain information
*                                                                         if an error occurs; otherwise `result` will contain
*                                                                         the message result information.
*                                                                         `response` will contain information related to this operation.
*/
QueueService.prototype.updateMessage = function (queue, messageId, popReceipt, visibilityTimeout, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('updateMessage', function (v) {
    v.string(queue, 'queue');
    v.queueNameIsValid(queue);
    v.callback(callback);
  });

  if (azureutil.objectIsNull(popReceipt)) {
    throw new Error(SR.INVALID_POP_RECEIPT);
  }

  if (azureutil.objectIsNull(messageId)) {
    throw new Error(SR.INVALID_MESSAGE_ID);
  }

  var options = extend(true, {}, userOptions);
  var content = null;
  if (options.messagetext) {
    content = QueueMessageResult.serialize(options.messageText, this.encodeMessage);
  }

  var contentLength = content ? Buffer.byteLength(content, 'utf8') : 0;

  var webResource = WebResource.put(queue + '/messages/' + messageId)
    .withHeader(HeaderConstants.CONTENT_TYPE, 'application/atom+xml;charset="utf-8"')
    .withHeader(HeaderConstants.CONTENT_LENGTH, contentLength)
    .withQueryOption(QueryStringConstants.POP_RECEIPT, popReceipt, null, true)
    .withQueryOption(QueryStringConstants.VISIBILITY_TIMEOUT, visibilityTimeout)
    .withBody(content);

  var processResponseCallback = function (responseObject, next) {
    responseObject.queueMessageResult = null;
    if (!responseObject.error) {
      responseObject.queueMessageResult = new QueueMessageResult(queue, messageId);
      responseObject.queueMessageResult.getPropertiesFromHeaders(responseObject.response.headers);
    }

    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.queueMessageResult, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, webResource.body, options, processResponseCallback);
};

/**
* Gets the queue's ACL.
*
* @this {QueueService}
* @param {string}             queue                                       The queue name.
* @param {object}             [options]                                   The request options.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to. 
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {bool}               [options.useNagleAlgorithm]                 Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                         The default value is false.
* @param {errorOrResult}  callback                                        `error` will contain information
*                                                                         if an error occurs; otherwise `result` will contain
*                                                                         information for the queue.
*                                                                         `response` will contain information related to this operation.
*/
QueueService.prototype.getQueueAcl = function (queue, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('getQueueAcl', function (v) {
    v.string(queue, 'queue');
    v.queueNameIsValid(queue);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  var webResource = WebResource.get(queue)
    .withQueryOption(QueryStringConstants.COMP, 'acl');

  options.requestLocationMode = Constants.RequestLocationMode.PRIMARY_OR_SECONDARY;

  var processResponseCallback = function (responseObject, next) {
    responseObject.queueResult = null;
    if (!responseObject.error) {
      responseObject.queueResult = new QueueResult(queue);
      responseObject.queueResult.getPropertiesFromHeaders(responseObject.response.headers);
      responseObject.queueResult.signedIdentifiers = AclResult.parse(responseObject.response.body);
    }

    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.queueResult, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

/**
* Updates the queue's ACL.
*
* @this {QueueService}
* @param {string}             queue                                       The queue name.
* @param {object}             signedIdentifiers                           The signed identifiers. Signed identifiers must be in an array.
* @param {object}             [options]                                   The request options.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to. 
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {bool}               [options.useNagleAlgorithm]                 Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                         The default value is false.
* @param {errorOrResult}  callback                                        `error` will contain information
*                                                                         if an error occurs; otherwise `result` will contain
*                                                                         information for the queue.
*                                                                         `response` will contain information related to this operation.
* @example
* var azure = require('azure-storage');
* var SharedAccessPermissions = azure.QueueUtilities.SharedAccessPermissions;
* var queueService = azure.createQueueService();
* var sharedAccessPolicy = [
* {AccessPolicy: {
*     Permissions: PROCESS,
*     Start: startDate,
*     Expiry: expiryDate
*   },
*   Id: processOnly,
* },
* {AccessPolicy: {
*     Permissions: SharedAccessPermissions.PROCESS + SharedAccessPermissions.DELETE,
*     Start: startDate,
*     Expiry: expiryDate
*   },
*   Id: processAndDelete,
* }];
* 
* queueService.setQueueAcl(queueName, sharedAccessPolicy, function(error, queueResult, response) {
*     // do whatever
* });
*/
QueueService.prototype.setQueueAcl = function (queue, signedIdentifiers, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('setQueueAcl', function (v) {
    v.string(queue, 'queue');
    v.queueNameIsValid(queue);
    v.callback(callback);
  });

  var policies = null;
  if (signedIdentifiers) {
    if (!_.isArray(signedIdentifiers)) {
      throw new Error(SR.INVALID_SIGNED_IDENTIFIERS);
    }

    policies = AclResult.serialize(signedIdentifiers);
  }

  var options = extend(true, {}, userOptions);
  var webResource = WebResource.put(queue)
    .withQueryOption(QueryStringConstants.COMP, 'acl')
    .withHeader(HeaderConstants.CONTENT_LENGTH, !azureutil.objectIsNull(policies) ? Buffer.byteLength(policies) : 0)
    .withBody(policies);

  var processResponseCallback = function (responseObject, next) {
    responseObject.containerResult = null;
    if (!responseObject.error) {
      responseObject.queueResult = new QueueResult(queue);
      responseObject.queueResult.getPropertiesFromHeaders(responseObject.response.headers);
      if (options && options.signedIdentifiers) {
        responseObject.queueResult.signedIdentifiers = options.signedIdentifiers;
      }
    }

    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.queueResult, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, webResource.body, options, processResponseCallback);
};

/**
* Retrieves a shared access signature token.
*
* @this {QueueService}
* @param {string}                   queue                                         The queue name.
* @param {object}                   sharedAccessPolicy                            The shared access policy.
* @param {string}                   [sharedAccessPolicy.Id]                       The signed identifier.
* @param {object}                   [sharedAccessPolicy.AccessPolicy.Permissions] The permission type.
* @param {date|string}              [sharedAccessPolicy.AccessPolicy.Start]       The time at which the Shared Access Signature becomes valid (The UTC value will be used).
* @param {date|string}              sharedAccessPolicy.AccessPolicy.Expiry        The time at which the Shared Access Signature becomes expired (The UTC value will be used).
* @return {string}                                                                The shared access signature query string. Note this string does not contain the leading "?".
*/
QueueService.prototype.generateSharedAccessSignature = function (queue, sharedAccessPolicy) {
  return this.generateSharedAccessSignatureWithVersion(queue, sharedAccessPolicy, null);
};

/**
* Retrieves a shared access signature token.
*
* @this {QueueService}
* @param {string}                   queue                                         The queue name.
* @param {object}                   sharedAccessPolicy                            The shared access policy.
* @param {string}                   [sharedAccessPolicy.Id]                       The signed identifier.
* @param {object}                   [sharedAccessPolicy.AccessPolicy.Permissions] The permission type.
* @param {date|string}              [sharedAccessPolicy.AccessPolicy.Start]       The time at which the Shared Access Signature becomes valid (The UTC value will be used).
* @param {date|string}              sharedAccessPolicy.AccessPolicy.Expiry        The time at which the Shared Access Signature becomes expired (The UTC value will be used).
* @param {string}                   [sasVersion]                                  An optional string indicating the desired SAS version to use. Value must be 2012-02-12 or later.
* @return {string}                                                                The shared access signature query string. Note this string does not contain the leading "?".
*/
QueueService.prototype.generateSharedAccessSignatureWithVersion = function (queue, sharedAccessPolicy, sasVersion) {
  // check if the QueueService is able to generate a shared access signature
  if (!this.storageCredentials || !this.storageCredentials.generateSignedQueryString) {
    throw new Error(SR.CANNOT_CREATE_SAS_WITHOUT_ACCOUNT_KEY);
  }

  validate.validateArgs('generateSharedAccessSignature', function (v) {
    v.string(queue, 'queue');
    v.queueNameIsValid(queue);
    v.object(sharedAccessPolicy, 'sharedAccessPolicy');
  });

  return this.storageCredentials.generateSignedQueryString(queue, sharedAccessPolicy, sasVersion);
};

/**
* Checks to see if a queue exists.
* @ignore
*
* @this {QueueService}
* @param {string}             queue                                       The queue name.
* @param {string}             primaryOnly                                 If true, the request will be executed against the primary storage location.
* @param {object}             [options]                                   The request options.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to. 
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {bool}               [options.useNagleAlgorithm]                 Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                         The default value is false.
* @param {Function(error, result, response)}         callback             `error` will contain information
*                                                                         if an error occurs; otherwise, `result`
*                                                                         will be true if the queue exists and false if not,
*                                                                         and `response` will contain information related to this operation.
*
*/
QueueService.prototype._doesQueueExist = function (queue, primaryOnly, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('doesQueueExist', function(v) {
    v.string(queue, 'queue');
    v.queueNameIsValid(queue);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  var webResource = WebResource.head(queue)
    .withQueryOption(QueryStringConstants.COMP, 'metadata');

  if(primaryOnly === false) {
    options.requestLocationMode = RequestLocationMode.PRIMARY_OR_SECONDARY;
  }

  var processResponseCallback = function(responseObject, next) {
    if (!responseObject.error) {
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

module.exports = QueueService;
