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
var util = require('util');
var extend = require('extend');
var _ = require('underscore');

var azureCommon = require('./../../common/common');
var azureutil = azureCommon.util;
var validate = azureCommon.validate;
var SR = azureCommon.SR;
var StorageServiceClient = azureCommon.StorageServiceClient;
var SharedKeyTable = require('./internal/sharedkeytable');
var RequestHandler = require('./internal/requesthandler');
var TableQuery = require('./tablequery');
var WebResource = azureCommon.WebResource;
var Constants = azureCommon.Constants;
var QueryStringConstants = Constants.QueryStringConstants;
var HeaderConstants = Constants.HeaderConstants;
var TableConstants = Constants.TableConstants;
var RequestLocationMode = Constants.RequestLocationMode;

// Models requires
var tableResult = require('./models/tableresult');
var entityResult = require('./models/entityresult');
var BatchResult = require('./models/batchresult');
var ServicePropertiesResult = azureCommon.ServicePropertiesResult;
var ServiceStatsParser = azureCommon.ServiceStatsParser;
var AclResult = azureCommon.AclResult;
var TableUtilities = require('./tableutilities');

/**
* Creates a new TableService object.
* If no connection string or storageaccount and storageaccesskey are provided,
* the AZURE_STORAGE_CONNECTION_STRING or AZURE_STORAGE_ACCOUNT and AZURE_STORAGE_ACCESS_KEY environment variables will be used.
* @class
* The TableService object allows you to peform management operations with the Microsoft Azure Table Service.
* The Table Service stores data in rows of key-value pairs. A table is composed of multiple rows, and each row
* contains key-value pairs. There is no schema, so each row in a table may store a different set of keys.
*
* For more information on the Table Service, as well as task focused information on using it from a Node.js application, see
* [How to Use the Table Service from Node.js](http://azure.microsoft.com/en-us/documentation/articles/storage-nodejs-how-to-use-table-storage/).
* The following defaults can be set on the Table service.
* defaultTimeoutIntervalInMs                          The default timeout interval, in milliseconds, to use for request made via the Table service.
* defaultMaximumExecutionTimeInMs                     The default maximum execution time across all potential retries, for requests made via the Table service.
* defaultLocationMode                                 The default location mode for requests made via the Table service.
* defaultPayloadFormat                                The default payload format for requests made via the Table service.
* useNagleAlgorithm                                   Determines whether the Nagle algorithm is used for requests made via the Table service.; true to use the  
*                                                     Nagle algorithm; otherwise, false. The default value is false.
* @constructor
* @extends {StorageServiceClient}
*
* @param {string} [storageAccountOrConnectionString]  The storage account or the connection string.
* @param {string} [storageAccessKey]                  The storage access key.
* @param {string|object} [host]                       The host address. To define primary only, pass a string. 
*                                                     Otherwise 'host.primaryHost' defines the primary host and 'host.secondaryHost' defines the secondary host.
* @param {string} [sasToken]                          The Shared Access Signature token.
*/
function TableService(storageAccountOrConnectionString, storageAccessKey, host, sasToken) {
  var storageServiceSettings = StorageServiceClient.getStorageSettings(storageAccountOrConnectionString, storageAccessKey, host, sasToken);

  TableService['super_'].call(this,
    storageServiceSettings._name,
    storageServiceSettings._key,
    storageServiceSettings._tableEndpoint,
    storageServiceSettings._usePathStyleUri,
    storageServiceSettings._sasToken);

  if (this.anonymous) {
    throw new Error(SR.ANONYMOUS_ACCESS_BLOBSERVICE_ONLY);
  }

  if(this.storageAccount && this.storageAccessKey) {
    this.storageCredentials = new SharedKeyTable(this.storageAccount, this.storageAccessKey, this.usePathStyleUri);
  }

  this.defaultPayloadFormat = TableUtilities.PayloadFormat.MINIMAL_METADATA;
}

util.inherits(TableService, StorageServiceClient);

// Table service methods

/**
* Gets the service stats for a storage account’s Table service.
*
* @this {TableService}
* @param {object}         [options]                                       The request options.
* @param {LocationMode}   [options.locationMode]                          Specifies the location mode used to decide which location the request should be sent to. 
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}            [options.timeoutIntervalInMs]                   The server timeout interval, in milliseconds, to use for the request.
* @param {int}            [options.maximumExecutionTimeInMs]              The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {bool}           [options.useNagleAlgorithm]                     Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                         The default value is false.
* @param {errorOrResult}  callback                                        `error` will contain information if an error occurs; 
*                                                                         otherwise `result` will contain the properties.
*                                                                         `response` will contain information related to this operation.
*/
TableService.prototype.getServiceStats = function (optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('getServiceStats', function (v) {
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  options.requestLocationMode = Constants.RequestLocationMode.PRIMARY_OR_SECONDARY;

  var webResource = WebResource.get()
    .withQueryOption(QueryStringConstants.COMP, 'stats')
    .withQueryOption(QueryStringConstants.RESTYPE, 'service');

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
* Gets the properties of a storage account’s Table service, including Azure Storage Analytics.
*
* @this {TableService}
* @param {object}             [options]                                    The request options.
* @param {LocationMode}       [options.locationMode]                       Specifies the location mode used to decide which location the request should be sent to. 
*                                                                          Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]                The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]           The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                          The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                          execution time is checked intermittently while performing requests, and before executing retries.
* @param {bool}               [options.useNagleAlgorithm]                  Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                          The default value is false.
* @param {errorOrResult}  callback                                         `error` will contain information if an error occurs; 
*                                                                          otherwise `result` will contain the properties.
*                                                                         `response` will contain information related to this operation.
* @return {undefined}
*/
TableService.prototype.getServiceProperties = function (optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('getServiceProperties', function (v) {
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  options.requestLocationMode = Constants.RequestLocationMode.PRIMARY_OR_SECONDARY;

  var webResource = WebResource.get()
    .withQueryOption(QueryStringConstants.RESTYPE, 'service')
    .withQueryOption(QueryStringConstants.COMP, 'properties');

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
* Sets the properties of a storage account’s Table service, including Azure Storage Analytics.
* You can also use this operation to set the default request version for all incoming requests that do not have a version specified.
*
* @this {TableService}
* @param {object}             serviceProperties                            The service properties.
* @param {object}             [options]                                    The request options.
* @param {LocationMode}       [options.locationMode]                       Specifies the location mode used to decide which location the request should be sent to. 
*                                                                          Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]                The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]           The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                          The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                          execution time is checked intermittently while performing requests, and before executing retries.
* @param {bool}               [options.useNagleAlgorithm]                  Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                          The default value is false.
* @param {errorOrResponse}  callback                                       `error` will contain information if an error occurs; 
*                                                                          `response` will contain information related to this operation.
* @return {undefined}
*/
TableService.prototype.setServiceProperties = function (serviceProperties, optionsOrCallback, callback) {
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
    .withHeader(HeaderConstants.CONTENT_LENGTH, Buffer.byteLength(servicePropertiesXml, 'utf8'))
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
* Lists a segment containing a collection of table items under the specified account.
*
* @this {TableService}
* @param {object}             currentToken                                      A continuation token returned by a previous listing operation. Please use 'null' or 'undefined' if this is the first operation.
* @param {object}             [options]                                         The create options or callback function.
* @param {int}                [options.maxResults]                              Specifies the maximum number of tables to return per call to Azure ServiceClient. 
* @param {LocationMode}       [options.locationMode]                            Specifies the location mode used to decide which location the request should be sent to. 
*                                                                               Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]                     The server timeout interval, in milliseconds, to use for the request.
* @param {string}             [options.payloadFormat]                           The payload format to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]                The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                               The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                               execution time is checked intermittently while performing requests, and before executing retries.
* @param {bool}               [options.useNagleAlgorithm]                       Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                               The default value is false.
* @param {errorOrResult}  callback                                              `error` will contain information if an error occurs; 
*                                                                               otherwise `result` will contain `entries` and `continuationToken`. 
*                                                                               `entries`  gives a list of tables and the `continuationToken` is used for the next listing operation.
*                                                                               `response` will contain information related to this operation.
* @return {undefined}
*/
TableService.prototype.listTablesSegmented = function (currentToken, optionsOrCallback, callback) {
  this.listTablesSegmentedWithPrefix(null /* prefix */, currentToken, optionsOrCallback, callback);
};

/**
* Lists a segment containing a collection of table items under the specified account.
*
* @this {TableService}
* @param {string}             prefix                                            The prefix of the table name.
* @param {object}             currentToken                                      A continuation token returned by a previous listing operation. Please use 'null' or 'undefined' if this is the first operation.
* @param {object}             [options]                                         The create options or callback function.
* @param {int}                [options.maxResults]                              Specifies the maximum number of tables to return per call to Azure ServiceClient. 
* @param {LocationMode}       [options.locationMode]                            Specifies the location mode used to decide which location the request should be sent to. 
*                                                                               Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]                     The server timeout interval, in milliseconds, to use for the request.
* @param {string}             [options.payloadFormat]                           The payload format to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]                The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                               The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                               execution time is checked intermittently while performing requests, and before executing retries.
* @param {bool}               [options.useNagleAlgorithm]                       Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                               The default value is false.
* @param {errorOrResult}  callback                                              `error` will contain information if an error occurs; 
*                                                                               otherwise `result` will contain `entries` and `continuationToken`. 
*                                                                               `entries`  gives a list of tables and the `continuationToken` is used for the next listing operation.
*                                                                               `response` will contain information related to this operation.
* @return {undefined}
*/
TableService.prototype.listTablesSegmentedWithPrefix = function (prefix, currentToken, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('listTables', function (v) {
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  options.payloadFormat = options.payloadFormat || this.defaultPayloadFormat;

  var webResource = WebResource.get(TableConstants.TABLE_SERVICE_TABLE_NAME);
  RequestHandler.setTableRequestHeadersAndBody(webResource, null, options.payloadFormat);

  if(!azureutil.objectIsNull(currentToken)) {
    webResource.withQueryOption(TableConstants.NEXT_TABLE_NAME, currentToken.nextTableName);
  }

  if(!azureutil.objectIsNull(prefix)) {
    var query = new TableQuery()
      .where(TableConstants.TABLE_NAME + ' >= ?', prefix)
      .and(TableConstants.TABLE_NAME + ' < ?', prefix + '{');
    
    webResource.withQueryOption(QueryStringConstants.FILTER, query.toQueryObject().$filter);
  }

  if(!azureutil.objectIsNull(options.maxResults)) {
    var query = TableQuery.top(options.maxResults);
    webResource.withQueryOption(QueryStringConstants.TOP, query.toQueryObject().$top);
  }

  options.requestLocationMode = azureutil.getNextListingLocationMode(currentToken);

  var processResponseCallback = function (responseObject, next) {
    responseObject.listTablesResult = null;

    if (!responseObject.error) {
      responseObject.listTablesResult = {
        entries: null,
        continuationToken: null
      };
      responseObject.listTablesResult.entries = tableResult.parse(responseObject.response);

      if (responseObject.response.headers[TableConstants.CONTINUATION_NEXT_TABLE_NAME] &&
      !azureutil.objectIsEmpty(responseObject.response.headers[TableConstants.CONTINUATION_NEXT_TABLE_NAME])) {
        responseObject.listTablesResult.continuationToken = {
          nextTableName: null,
          targetLocation: null
        };

        responseObject.listTablesResult.continuationToken.nextTableName = responseObject.response.headers[TableConstants.CONTINUATION_NEXT_TABLE_NAME];
        responseObject.listTablesResult.continuationToken.targetLocation = responseObject.targetLocation;
      }
    }

    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.listTablesResult, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

// Table Methods

/**
* Gets the table's ACL.
*
* @this {TableService}
* @param {string}             table                                        The table name.
* @param {object}             [options]                                    The request options.
* @param {LocationMode}       [options.locationMode]                       Specifies the location mode used to decide which location the request should be sent to. 
*                                                                          Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]                The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]           The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                          The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                          execution time is checked intermittently while performing requests, and before executing retries.
* @param {bool}               [options.useNagleAlgorithm]                  Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                          The default value is false.
* @param {errorOrResult}  callback                                         `error` will contain information if an error occurs; 
*                                                                          otherwise `result` will contain the ACL information for the table.
*                                                                          `response` will contain information related to this operation.
*/
TableService.prototype.getTableAcl = function (table, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('getTableAcl', function (v) {
    v.string(table, 'table');
    v.tableNameIsValid(table);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  options.requestLocationMode = Constants.RequestLocationMode.PRIMARY_OR_SECONDARY;

  var webResource = WebResource.get(table)
    .withQueryOption(QueryStringConstants.COMP, 'acl');

  var processResponseCallback = function (responseObject, next) {
    responseObject.tableResult = null;
    if (!responseObject.error) {
      responseObject.tableResult = tableResult.parse(responseObject.response, true);
      responseObject.tableResult.signedIdentifiers = AclResult.parse(responseObject.response.body);
    }

    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.tableResult, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

/**
* Updates the table's ACL.
*
* @this {TableService}
* @param {string}             table                                        The table name.
* @param {object}             [options]                                    The request options.
* @param {object}             [options.signedIdentifiers]                  The signed identifiers.
* @param {LocationMode}       [options.locationMode]                       Specifies the location mode used to decide which location the request should be sent to. 
*                                                                          Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]                The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]           The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                          The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                          execution time is checked intermittently while performing requests, and before executing retries.
* @param {bool}               [options.useNagleAlgorithm]                  Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                          The default value is false.
* @param {errorOrResult}  callback                                         `error` will contain information if an error occurs; 
*                                                                          otherwise `result` will contain information for the table.
*                                                                          `response` will contain information related to this operation.
*/
TableService.prototype.setTableAcl = function (table, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('setTableAcl', function (v) {
    v.string(table, 'table');
    v.tableNameIsValid(table);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);

  var policies = null;
  if (options.signedIdentifiers) {
    if (!_.isArray(options.signedIdentifiers)) {
      throw new Error(SR.INVALID_SIGNED_IDENTIFIERS);
    }

    policies = AclResult.serialize(options.signedIdentifiers);
  }

  var webResource = WebResource.put(table)
    .withQueryOption(QueryStringConstants.COMP, 'acl')
    .withHeader(HeaderConstants.CONTENT_LENGTH, !azureutil.objectIsNull(policies) ? Buffer.byteLength(policies) : 0)
    .withBody(policies);

  var processResponseCallback = function (responseObject, next) {
    responseObject.tableResult = null;
    if (!responseObject.error) {

      // SetTableAcl doesn't actually return anything in the response
      responseObject.tableResult = {TableName : table};
      if (options && options.signedIdentifiers) {
        responseObject.tableResult.signedIdentifiers = options.signedIdentifiers;
      }
    }

    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.tableResult, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, webResource.body, options, processResponseCallback);
};

/**
* Retrieves a shared access signature token.
*
* @this {TableService}
* @param {string}                   table                                         The table name.
* @param {object}                   sharedAccessPolicy                            The shared access policy.
* @param {string}                   [sharedAccessPolicy.Id]                       The signed identifier.
* @param {object}                   [sharedAccessPolicy.AccessPolicy.Permissions] The permission type.
* @param {date|string}              [sharedAccessPolicy.AccessPolicy.Start]       The time at which the Shared Access Signature becomes valid (The UTC value will be used).
* @param {date|string}              sharedAccessPolicy.AccessPolicy.Expiry        The time at which the Shared Access Signature becomes expired (The UTC value will be used).
* @param {string}                   [sharedAccessPolicy.AccessPolicy.StartPk]     The starting Partition Key for which the SAS will be valid.
* @param {string}                   [sharedAccessPolicy.AccessPolicy.EndPk]       The ending Partition Key for which the SAS will be valid.
* @param {string}                   [sharedAccessPolicy.AccessPolicy.StartRk]     The starting Row Key for which the SAS will be valid.
* @param {string}                   [sharedAccessPolicy.AccessPolicy.EndRk]       The ending Row Key for which the SAS will be valid.
* @return {object}                                                                An object with the shared access signature.
*/
TableService.prototype.generateSharedAccessSignature = function (table, sharedAccessPolicy) {
  return this.generateSharedAccessSignatureWithVersion(table, sharedAccessPolicy, null);
};

/**
* Retrieves a shared access signature token.
*
* @this {TableService}
* @param {string}                   table                                         The table name.
* @param {object}                   sharedAccessPolicy                            The shared access policy.
* @param {string}                   [sharedAccessPolicy.Id]                       The signed identifier.
* @param {object}                   [sharedAccessPolicy.AccessPolicy.Permissions] The permission type.
* @param {date|string}              [sharedAccessPolicy.AccessPolicy.Start]       The time at which the Shared Access Signature becomes valid (The UTC value will be used).
* @param {date|string}              sharedAccessPolicy.AccessPolicy.Expiry        The time at which the Shared Access Signature becomes expired (The UTC value will be used).
* @param {string}                   [sharedAccessPolicy.AccessPolicy.StartPk]     The starting Partition Key for which the SAS will be valid.
* @param {string}                   [sharedAccessPolicy.AccessPolicy.EndPk]       The ending Partition Key for which the SAS will be valid.
* @param {string}                   [sharedAccessPolicy.AccessPolicy.StartRk]     The starting Row Key for which the SAS will be valid.
* @param {string}                   [sharedAccessPolicy.AccessPolicy.EndRk]       The ending Row Key for which the SAS will be valid.
* @param {string}                   [sasVersion]                                  An optional string indicating the desired SAS version to use. Value must be 2012-02-12 or later.
* @return {object}                                                                An object with the shared access signature.
*/
TableService.prototype.generateSharedAccessSignatureWithVersion = function (table, sharedAccessPolicy, sasVersion) {
  // check if the TableService is able to generate a shared access signature
  if (!this.storageCredentials || !this.storageCredentials.generateSignedQueryString) {
    throw new Error(SR.CANNOT_CREATE_SAS_WITHOUT_ACCOUNT_KEY);
  }

  validate.validateArgs('generateSharedAccessSignature', function (v) {
    v.string(table, 'table');
    v.tableNameIsValid(table);
    v.object(sharedAccessPolicy, 'sharedAccessPolicy');
  });

  return this.storageCredentials.generateSignedQueryString(table , sharedAccessPolicy, sasVersion, {tableName: table });
};

/**
* Checks whether or not a table exists on the service.
*
* @this {TableService}
* @param {string}             table                                   The table name.
* @param {object}             [options]                               The request options.
* @param {LocationMode}       [options.locationMode]                  Specifies the location mode used to decide which location the request should be sent to. 
*                                                                     Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]           The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]      The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                     The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                     execution time is checked intermittently while performing requests, and before executing retries.
* @param {bool}               [options.useNagleAlgorithm]             Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                     The default value is false.
* @param {errorOrResult}  callback                                    `error` will contain information if an error occurs; 
*                                                                     otherwise `result` will contain be true if the table exists, or false if the table does not exist. 
*                                                                     `response` will contain information related to this operation.
*/
TableService.prototype.doesTableExist = function (table, optionsOrCallback, callback) {
  this._doesTableExist(table, false, optionsOrCallback, callback);
};

/**
* Creates a new table within a storage account.
*
* @this {TableService}
* @param {string}             table                                   The table name.
* @param {object}             [options]                               The request options.
* @param {LocationMode}       [options.locationMode]                  Specifies the location mode used to decide which location the request should be sent to. 
*                                                                     Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]           The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]      The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                     The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                     execution time is checked intermittently while performing requests, and before executing retries.
* @param {bool}               [options.useNagleAlgorithm]             Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                     The default value is false.
* @param {errorOrResult}  callback                                    `error` will contain information if an error occurs; 
*                                                                     otherwise `result` will contain the new table information.
*                                                                     `response` will contain information related to this operation.
* @return {undefined}
*/
TableService.prototype.createTable = function (table, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('createTable', function (v) {
    v.string(table, 'table');
    v.tableNameIsValid(table);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);

  var tableDescriptor = tableResult.serialize(table);

  var webResource = WebResource.post('Tables')
    .withHeader(HeaderConstants.PREFER, HeaderConstants.PREFER_NO_CONTENT);

  RequestHandler.setTableRequestHeadersAndBody(webResource, tableDescriptor);

  var processResponseCallback = function (responseObject, next) {
    responseObject.tableResponse = null;
    if (!responseObject.error) {
      responseObject.tableResponse = {TableName: table};
    }

    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.tableResponse, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, webResource.body, options, processResponseCallback);
};

/**
* Creates a new table within a storage account if it does not exists.
*
* @this {TableService}
* @param {string}             table                                   The table name.
* @param {object}             [options]                               The request options.
* @param {LocationMode}       [options.locationMode]                  Specifies the location mode used to decide which location the request should be sent to. 
*                                                                     Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]           The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]      The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                     The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                     execution time is checked intermittently while performing requests, and before executing retries.
* @param {bool}               [options.useNagleAlgorithm]             Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                     The default value is false.
* @param {errorOrResult}  callback                                    `error` will contain information if an error occurs; 
*                                                                     `result` will be `true` if table was created, false otherwise
*                                                                     `response` will contain information related to this operation.
* @return {undefined}
*
* @example
* var azure = require('azure-storage');
* var tableService = azure.createTableService();
* tableService.createTableIfNotExists('tasktable', function(error) {
*   if(!error) { 
*     // Table created or exists
*   }
* });
*/
TableService.prototype.createTableIfNotExists = function (table, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('createTableIfNotExists', function (v) {
    v.string(table, 'table');
    v.tableNameIsValid(table);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);

  var self = this;
  self._doesTableExist(table, true, options, function(error, exists, response) {
    if (error) {
      callback(error, exists, response);
    } else if (exists) {
      callback(error, false, response);
    } else {
      self.createTable(table, options, function(createError, createResponse) {
        var created;
        if (!createError) {
          created = true;
        }
        else if (createError && createError.statusCode === Constants.HttpConstants.HttpResponseCodes.Conflict && createError.code === Constants.TableErrorCodeStrings.TABLE_ALREADY_EXISTS) {
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
* Deletes a table from a storage account.
*
* @this {TableService}
* @param {string}             table                                   The table name.
* @param {object}             [options]                               The request options.
* @param {LocationMode}       [options.locationMode]                  Specifies the location mode used to decide which location the request should be sent to. 
*                                                                     Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]           The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]      The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                     The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                     execution time is checked intermittently while performing requests, and before executing retries.
* @param {bool}               [options.useNagleAlgorithm]             Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                     The default value is false.
* @param {errorOrResponse}  callback                                  `error` will contain information if an error occurs;
*                                                                     `response` will contain information related to this operation.
* @return {undefined}
*/
TableService.prototype.deleteTable = function (table, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('deleteTable', function (v) {
    v.string(table, 'table');
    v.tableNameIsValid(table);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);

  var webResource = WebResource.del('Tables(\'' + table + '\')');
  RequestHandler.setTableRequestHeadersAndBody(webResource);

  var processResponseCallback = function (responseObject, next) {
    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

/**
* Deletes a table from a storage account, if it exists.
*
* @this {TableService}
* @param {string}             table                                   The table name.
* @param {object}             [options]                               The request options.
* @param {LocationMode}       [options.locationMode]                  Specifies the location mode used to decide which location the request should be sent to. 
*                                                                     Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]           The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]      The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                     The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                     execution time is checked intermittently while performing requests, and before executing retries.
* @param {bool}               [options.useNagleAlgorithm]             Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                     The default value is false.
* @param {errorOrResult}  callback                                    `error` will contain information if an error occurs; 
*                                                                     `result` will be `true` if table was deleted, false otherwise
*                                                                     `response` will contain information related to this operation.
* @return {undefined}
*/
TableService.prototype.deleteTableIfExists = function (table, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('deleteTableIfExists', function (v) {
    v.string(table, 'table');
    v.tableNameIsValid(table);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);

  var self = this;
  self._doesTableExist(table, true, options, function(error, exists, response) {
    if (error) {
      callback(error, exists, response);
    } else if (!exists) {
      response.isSuccessful = true;
      callback(error, false, response);
    } else {
      self.deleteTable(table, options, function(deleteError, deleteResponse) {
        var deleted;
        if (!deleteError) {
          deleted = true;
        } else if (deleteError && deleteError.statusCode === Constants.HttpConstants.HttpResponseCodes.NotFound && deleteError.code === Constants.StorageErrorCodeStrings.RESOURCE_NOT_FOUND) {
          deleted = false;
          deleteError = null;
          deleteResponse.isSuccessful = true;
        }

        callback(deleteError, deleted, deleteResponse);
      });
    }
  });
};

// Table Entity Methods

/**
* Queries data in a table. To retrieve a single entity by partition key and row key, use retrieve entity.
*
* @this {TableService}
* @param {string}             table                                                The table name.
* @param {TableQuery}         tableQuery                                           The query to perform. Use null, undefined, or new TableQuery() to get all of the entities in the table.
* @param {object}             currentToken                                         A continuation token returned by a previous listing operation. 
*                                                                                  Please use 'null' or 'undefined' if this is the first operation.
* @param {object}             [options]                                            The request options.
* @param {LocationMode}       [options.locationMode]                               Specifies the location mode used to decide which location the request should be sent to. 
*                                                                                  Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]                        The server timeout interval, in milliseconds, to use for the request.
* @param {string}             [options.payloadFormat]                              The payload format to use for the request.
* @param {bool}               [options.autoResolveProperties]                      If true, guess at all property types.
* @param {int}                [options.maximumExecutionTimeInMs]                   The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                                  The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                                  execution time is checked intermittently while performing requests, and before executing retries.
* @param {bool}               [options.useNagleAlgorithm]                          Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                                  The default value is false.
* @param {Function(entity)} [options.entityResolver]                               The entity resolver. Given a single entity returned by the query, returns a modified object which is added to 
*                                                                                  the entities array.
* @param {TableService~propertyResolver}  [options.propertyResolver]               The property resolver. Given the partition key, row key, property name, property value,
*                                                                                  and the property Edm type if given by the service, returns the Edm type of the property.
* @param {TableService~queryResponse} callback                                     `error` will contain information if an error occurs; 
*                                                                                  otherwise `entities` will contain the entities returned by the query. 
*                                                                                  If more matching entities exist, and could not be returned,
*                                                                                  `queryResultContinuation` will contain a continuation token that can be used
*                                                                                  to retrieve the next set of results.
*                                                                                  `response` will contain information related to this operation.
* @return {undefined}
*
* The logic for returning entity types can get complicated.  Here is the algorithm used:
* ```
* var propertyType;
*
* if (propertyResovler) {                      // If the caller provides a propertyResolver in the options, use it
*   propertyType = propertyResolver(partitionKey, rowKey, propertyName, propertyValue, propertyTypeFromService);
* } else if (propertyTypeFromService) {        // If the service provides us a property type, use it.  See below for an explanation of when this will and won't occur.
*   propertyType = propertyTypeFromService;
* } else if (autoResolveProperties) {          // If options.autoResolveProperties is set to true
*   if (javascript type is string) {           // See below for an explanation of how and why autoResolveProperties works as it does.
*     propertyType = 'Edm.String';
*   } else if (javascript type is boolean) {
*     propertyType = 'Edm.Boolean';
*   }
* }
*
* if (propertyType) {
*   // Set the property type on the property.
* } else {
*   // Property gets no EdmType. 
* }
* ```
* Notes:
* 
* * The service only provides a type if JsonFullMetadata or JsonMinimalMetadata is used, and if the type is Int64, Guid, Binary, or DateTime.
* * Explanation of autoResolveProperties:
*     * String gets correctly resolved to 'Edm.String'.
*     * Int64, Guid, Binary, and DateTime all get resolved to 'Edm.String.'  This only happens if JsonNoMetadata is used (otherwise the service will provide the propertyType in a prior step).
*     * Boolean gets correctly resolved to 'Edm.Boolean'.
*     * For both Int32 and Double, no type information is returned, even in the case of autoResolveProperties = true.  This is due to an
*          inability to distinguish between the two in certain cases.
*
* @example
* var azure = require('azure-storage');
* var tableService = azure.createTableService();
* // tasktable should already exist and have entities
* 
* // returns all entities in tasktable, and a continuation token for the next page of results if necessary
* tableService.queryEntities('tasktable', null, null \/*currentToken*\/, function(error, result) {
*   if(!error) { 
*     var entities = result.entities;
*     // do stuff with the returned entities if there are any
*   }
* });
* 
* // returns field1 and field2 of the entities in tasktable, and a continuation token for the next page of results if necessary
* var tableQuery = new TableQuery().select('field1', 'field2');
* tableService.queryEntities('tasktable', tableQuery, null \/*currentToken*\/, function(error, result) {
*   if(!error) { 
*     var entities = result.entities;
*     // do stuff with the returned entities if there are any
*   }
* });
*/
TableService.prototype.queryEntities = function (table, tableQuery, currentToken, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('queryEntities', function (v) {
    v.string(table, 'table');
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  options.payloadFormat = options.payloadFormat || this.defaultPayloadFormat;

  var webResource = WebResource.get(table);
  RequestHandler.setTableRequestHeadersAndBody(webResource, null, options.payloadFormat);

  if (tableQuery) {
    var queryString = tableQuery.toQueryObject();
    Object.keys(queryString).forEach(function (queryStringName) {
      webResource.withQueryOption(queryStringName, queryString[queryStringName]);
    });
  }

  if(!azureutil.objectIsNull(currentToken)) {
    webResource.withQueryOption(TableConstants.NEXT_PARTITION_KEY, currentToken.nextPartitionKey);
    webResource.withQueryOption(TableConstants.NEXT_ROW_KEY, currentToken.nextRowKey);
  }

  options.requestLocationMode = azureutil.getNextListingLocationMode(currentToken);

  var processResponseCallback = function (responseObject, next) {
    responseObject.queryEntitiesResult = null;
    if (!responseObject.error) {
      responseObject.queryEntitiesResult = {
        entries: null,
        continuationToken: null
      };

      // entries
      responseObject.queryEntitiesResult.entries = entityResult.parseQuery(responseObject.response, options.autoResolveProperties, options.propertyResolver, options.entityResolver);

      // continuation token
      var continuationToken = {
          nextPartitionKey: responseObject.response.headers[TableConstants.CONTINUATION_NEXT_PARTITION_KEY],
          nextRowKey: responseObject.response.headers[TableConstants.CONTINUATION_NEXT_ROW_KEY],
          targetLocation: responseObject.targetLocation
        };

      if (!azureutil.IsNullOrEmptyOrUndefinedOrWhiteSpace(continuationToken.nextPartitionKey)) {
        responseObject.queryEntitiesResult.continuationToken = continuationToken;
      }
    }

    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.queryEntitiesResult, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

/**
* Retrieves an entity from a table.
*
* @this {TableService}
* @param {string}             table                                           The table name.
* @param {string}             partitionKey                                    The partition key.
* @param {string}             rowKey                                          The row key.
* @param {object}             [options]                                       The request options.
* @param {LocationMode}       [options.locationMode]                          Specifies the location mode used to decide which location the request should be sent to. 
*                                                                             Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]                   The server timeout interval, in milliseconds, to use for the request.
* @param {string}             [options.payloadFormat]                         The payload format to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]              The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                             The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                             execution time is checked intermittently while performing requests, and before executing retries.
* @param {bool}               [options.useNagleAlgorithm]                     Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                             The default value is false.
* @param {TableService~propertyResolver}  [options.propertyResolver]          The property resolver. Given the partition key, row key, property name, property value,
*                                                                             and the property Edm type if given by the service, returns the Edm type of the property.
* @param {Function(entity)} [options.entityResolver]                          The entity resolver. Given the single entity returned by the query, returns a modified object.
* @param {errorOrResult}  callback                                            `error` will contain information if an error occurs; 
*                                                                             otherwise `result` will be the matching entity.
*                                                                             `response` will contain information related to this operation.
* @return {undefined}
*
* @example
* var azure = require('azure-storage');
* var tableService = azure.createTableService();
* tableService.retrieveEntity('tasktable', 'tasksSeattle', '1', function(error, serverEntity) {
*   if(!error) {
*     // Entity available in serverEntity variable
*   }
* }); 
*/
TableService.prototype.retrieveEntity = function (table, partitionKey, rowKey, optionsOrCallback, callback) {
  var entityDescriptor = { PartitionKey: {_: partitionKey, $: 'Edm.String'},
    RowKey: {_: rowKey, $: 'Edm.String'},
  };

  validate.validateArgs('retrieveEntity', function (v) {
    v.stringAllowEmpty(partitionKey, 'partitionKey');
    v.stringAllowEmpty(rowKey, 'rowKey');
  });

  this._performEntityOperation(TableConstants.Operations.RETRIEVE, table, entityDescriptor, optionsOrCallback, callback);
};

/**
* Inserts a new entity into a table.
*
* @this {TableService}
* @param {string}             table                                           The table name.
* @param {object}             entityDescriptor                                The entity descriptor.
* @param {object}             [options]                                       The request options.
* @param {string}             [options.echoContent]                           Whether or not to return the entity upon a successful insert. Default to false.
* @param {string}             [options.payloadFormat]                         The payload format to use in the response, if options.echoContent is true.
* @param {LocationMode}       [options.locationMode]                          Specifies the location mode used to decide which location the request should be sent to. 
*                                                                             Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]                   The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]              The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                             The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                             execution time is checked intermittently while performing requests, and before executing retries.
* @param {bool}               [options.useNagleAlgorithm]                     Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                             The default value is false.
* @param {TableService~propertyResolver}  [options.propertyResolver]          The property resolver. Only applied if echoContent is true. Given the partition key, row key, property name, 
*                                                                             property value, and the property Edm type if given by the service, returns the Edm type of the property.
* @param {Function(entity)} [options.entityResolver]                          The entity resolver. Only applied if echoContent is true. Given the single entity returned by the insert, returns 
*                                                                             a modified object.
* @param {errorOrResult}  callback                                            `error` will contain information if an error occurs; 
*                                                                             otherwise `result` will contain the entity information.
*                                                                             `response` will contain information related to this operation.
* @return {undefined}
*
* @example
* var azure = require('azure-storage');
* var tableService = azure.createTableService();
* var task1 = {
*   PartitionKey : {'_': 'tasksSeattle', '$':'Edm.String'},
*   RowKey: {'_': '1', '$':'Edm.String'},
*   Description: {'_': 'Take out the trash', '$':'Edm.String'},
*   DueDate: {'_': new Date(2011, 12, 14, 12), '$':'Edm.DateTime'}
* };
* tableService.insertEntity('tasktable', task1, function(error) {
*   if(!error) {
*     // Entity inserted
*   }
* }); 
*/
TableService.prototype.insertEntity = function (table, entityDescriptor, optionsOrCallback, callback) {
  this._performEntityOperation(TableConstants.Operations.INSERT, table, entityDescriptor, optionsOrCallback, callback);
};

/**
* Inserts or updates a new entity into a table.
*
* @this {TableService}
* @param {string}             table                                   The table name.
* @param {object}             entityDescriptor                        The entity descriptor.
* @param {object}             [options]                               The request options.
* @param {LocationMode}       [options.locationMode]                  Specifies the location mode used to decide which location the request should be sent to. 
*                                                                     Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]           The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]      The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                     The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                     execution time is checked intermittently while performing requests, and before executing retries.
* @param {bool}               [options.useNagleAlgorithm]             Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                     The default value is false.
* @param {errorOrResult}  callback                                    `error` will contain information if an error occurs; 
*                                                                     otherwise `result` will contain the entity information.
*                                                                     `response` will contain information related to this operation.
* @return {undefined}
*/
TableService.prototype.insertOrReplaceEntity = function (table, entityDescriptor, optionsOrCallback, callback) {
  this._performEntityOperation(TableConstants.Operations.INSERT_OR_REPLACE, table, entityDescriptor, optionsOrCallback, callback);
};

/**
* Updates an existing entity within a table by replacing it. To update conditionally based on etag, set entity['.metadata']['etag'].
*
* @this {TableService}
* @param {string}             table                                   The table name.
* @param {object}             entityDescriptor                        The entity descriptor.
* @param {object}             [options]                               The request options.
* @param {LocationMode}       [options.locationMode]                  Specifies the location mode used to decide which location the request should be sent to. 
*                                                                     Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]           The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]      The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                     The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                     execution time is checked intermittently while performing requests, and before executing retries.
* @param {bool}               [options.useNagleAlgorithm]             Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                     The default value is false.
* @param {errorOrResult}  callback                                    `error` will contain information if an error occurs; 
*                                                                     otherwise `result` will contain the entity information.
*                                                                     `response` will contain information related to this operation.
* @return {undefined}
*/
TableService.prototype.updateEntity = function (table, entityDescriptor, optionsOrCallback, callback) {
  this._performEntityOperation(TableConstants.Operations.UPDATE, table, entityDescriptor, optionsOrCallback, callback);
};

/**
* Updates an existing entity within a table by merging new property values into the entity. To merge conditionally based on etag, set entity['.metadata']['etag'].
*
* @this {TableService}
* @param {string}             table                                   The table name.
* @param {object}             entityDescriptor                        The entity descriptor. 
* @param {object}             [options]                               The request options.
* @param {LocationMode}       [options.locationMode]                  Specifies the location mode used to decide which location the request should be sent to. 
*                                                                     Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]           The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]      The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                     The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                     execution time is checked intermittently while performing requests, and before executing retries.
* @param {bool}               [options.useNagleAlgorithm]             Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                     The default value is false.
* @param {errorOrResult}  callback                                    `error` will contain information if an error occurs; 
*                                                                     otherwise `result` will contain the entity information.
*                                                                     response` will contain information related to this operation.
* @return {undefined}
*/
TableService.prototype.mergeEntity = function (table, entityDescriptor, optionsOrCallback, callback) {
  this._performEntityOperation(TableConstants.Operations.MERGE, table, entityDescriptor, optionsOrCallback, callback);
};

/**
* Inserts or updates an existing entity within a table by merging new property values into the entity.
*
* @this {TableService}
* @param {string}             table                                   The table name.
* @param {object}             entityDescriptor                        The entity descriptor.
* @param {object}             [options]                               The request options.
* @param {LocationMode}       [options.locationMode]                  Specifies the location mode used to decide which location the request should be sent to. 
*                                                                     Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]           The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]      The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                     The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                     execution time is checked intermittently while performing requests, and before executing retries.
* @param {bool}               [options.useNagleAlgorithm]             Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                     The default value is false.
* @param {errorOrResult}  callback                                    `error` will contain information if an error occurs; 
*                                                                     otherwise `result` will contain the entity information.
*                                                                     `response` will contain information related to this operation.
* @return {undefined}
*/
TableService.prototype.insertOrMergeEntity = function (table, entityDescriptor, optionsOrCallback, callback) {
  this._performEntityOperation(TableConstants.Operations.INSERT_OR_MERGE, table, entityDescriptor, optionsOrCallback, callback);
};

/**
* Deletes an entity within a table. To delete conditionally based on etag, set entity['.metadata']['etag'].
*
* @this {TableService}
* @param {string}             table                                   The table name.
* @param {object}             entityDescriptor                        The entity descriptor.
* @param {object}             [options]                               The request options.
* @param {LocationMode}       [options.locationMode]                  Specifies the location mode used to decide which location the request should be sent to. 
*                                                                     Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]           The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]      The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                     The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                     execution time is checked intermittently while performing requests, and before executing retries.
* @param {bool}               [options.useNagleAlgorithm]             Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                     The default value is false.
* @param {errorOrResponse}  callback                                  `error` will contain information if an error occurs; 
*                                                                     `response` will contain information related to this operation.
* @return {undefined}
*/
TableService.prototype.deleteEntity = function (table, entityDescriptor, optionsOrCallback, callback) {
  this._performEntityOperation(TableConstants.Operations.DELETE, table, entityDescriptor, optionsOrCallback, callback);
};

/**
* Executes the operations in the batch.
*
* @this {TableService}
* @param {string}             table                                           The table name.
* @param {TableBatch}         batch                                           The table batch to execute.
* @param {object}             [options]                                       The create options or callback function.
* @param {LocationMode}       [options.locationMode]                          Specifies the location mode used to decide which location the request should be sent to. 
*                                                                             Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]                   The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]              The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                             The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                             execution time is checked intermittently while performing requests, and before executing retries.
* @param {bool}               [options.useNagleAlgorithm]                     Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                             The default value is false.
* @param {errorOrResult}  callback                                            `error` will contain information if an error occurs; 
*                                                                             otherwise `result` will contain responses for each operation executed in the batch;
*                                                                             `result.entity` will contain the entity information for each operation executed.
*                                                                             `result.response` will contain the response for each operations executed.
*                                                                             `response` will contain information related to this operation.
* @return {undefined}
*/
TableService.prototype.executeBatch = function (table, batch, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('executeBatch', function (v) {
    v.string(table, 'table');
    v.tableNameIsValid(table);
    v.object(batch, 'batch');
    v.callback(callback);
  });

  if(!batch.hasOperations()) {
    throw new Error(SR.EMPTY_BATCH);
  }

  var options = extend(true, {}, userOptions);

  var batchResult = new BatchResult(this, table, batch.operations);
  var webResource = batchResult.constructWebResource();

  var body = batchResult.serialize();
  webResource.withBody(body);
  webResource.withHeader(HeaderConstants.CONTENT_LENGTH, Buffer.byteLength(body, 'utf8'));

  var processResponseCallback = function (responseObject, next) {
    var responseObjects = batchResult.parse(responseObject);
    // if the batch was unsuccesful, there will be a single response indicating the error
    if (responseObjects && responseObjects.length > 0 && !responseObjects[0].response.isSuccessful) {
      responseObject = responseObjects[0];
    } else {
      responseObject.operationResponses = responseObjects;
    }

    var finalCallback = function (returnObject) {
      // perform final callback
      callback(returnObject.error, returnObject.operationResponses, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, webResource.body, options, processResponseCallback);
};

// Private methods

/**
* Checks whether or not a table exists on the service.
* @ignore
*
* @this {TableService}
* @param {string}             table                                   The table name.
* @param {string}             primaryOnly                             If true, the request will be executed against the primary storage location.
* @param {object}             [options]                               The request options.
* @param {LocationMode}       [options.locationMode]                  Specifies the location mode used to decide which location the request should be sent to. 
*                                                                     Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]           The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]      The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                     The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                     execution time is checked intermittently while performing requests, and before executing retries.
* @param {bool}               [options.useNagleAlgorithm]             Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                     The default value is false.
* @param {errorOrResult}  callback                                    `error` will contain information if an error occurs; 
*                                                                     otherwise `result` will contain be true if the table exists, or false if the table does not exist. 
*                                                                     `response` will contain information related to this operation.
*/
TableService.prototype._doesTableExist = function (table, primaryOnly, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('doesTableExist', function (v) {
    v.string(table, 'table');
    v.tableNameIsValid(table);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);

  if(primaryOnly === false) {
    options.requestLocationMode = RequestLocationMode.PRIMARY_OR_SECONDARY;
  }

  var webResource = WebResource.get('Tables(\'' + table + '\')');
  RequestHandler.setTableRequestHeadersAndBody(webResource);

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
* Peforms a table operation.
*
* @this {TableService}
* @param {string}             operation                           The operation to perform.
* @param {string}             table                               The table name.
* @param {object}             entityDescriptor                    The entity descriptor.
* @param {object}             [options]                           The create options or callback function.
* @param {string}             [options.echoContent]               Whether or not to return the entity upon a successful insert. Default to false.
* @param {string}             [options.payloadFormat]             The payload format to use for the request.
* @param {LocationMode}       [options.locationMode]              Specifies the location mode used to decide which location the request should be sent to. 
*                                                                 Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]       The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]  The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                 The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                 execution time is checked intermittently while performing requests, and before executing retries.
* @param {bool}               [options.useNagleAlgorithm]         Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                 The default value is false.
* @param {errorOrResult}  callback                                `error` will contain information if an error occurs; 
*                                                                 otherwise `entity` will contain the entity information.
*                                                                 `response` will contain information related to this operation.
* @return {undefined}
* @ignore
*/
TableService.prototype._performEntityOperation = function (operation, table, entityDescriptor, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('entityOperation', function (v) {
    v.string(table, 'table');
    v.tableNameIsValid(table);
    v.object(entityDescriptor, 'entityDescriptor');
    v.object(entityDescriptor.PartitionKey, 'entityDescriptor.PartitionKey');
    v.object(entityDescriptor.RowKey, 'entityDescriptor.RowKey');
    v.stringAllowEmpty(entityDescriptor.PartitionKey._, 'entityDescriptor.PartitionKey._');
    v.stringAllowEmpty(entityDescriptor.RowKey._, 'entityDescriptor.RowKey._');
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  options.payloadFormat = options.payloadFormat || this.defaultPayloadFormat;

  var webResource = RequestHandler.constructEntityWebResource(operation, table, entityDescriptor, options);

  var processResponseCallback = function (responseObject, next) {
    var finalCallback;
    if (operation === TableConstants.Operations.DELETE) {
      finalCallback = function (returnObject) {
        callback(returnObject.error, returnObject.response);
      };
    } else {
      responseObject.entityResponse = null;
      if (!responseObject.error) {
        responseObject.entityResponse = entityResult.parseEntity(responseObject.response, options.autoResolveProperties, options.propertyResolver, options.entityResolver);
      }

      finalCallback = function (returnObject) {
        callback(returnObject.error, returnObject.entityResponse, returnObject.response);
      };
    }

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, webResource.body, options, processResponseCallback);
};

/**
* Given the partition key, row key, property name, property value,
* and the property Edm type if given by the service, returns the Edm type of the property.
* @typedef {function} TableService~propertyResolver
* @param {object} pk  The partition key.
* @param {object} rk  The row key.
* @param {string} name  The property name.
* @param {object} value The property value.
* @param {string} type  The EDM type.
*/

/** 
* Returns entities matched by a query.
* @callback TableService~queryResponse                                                                                
* @param {object} error                     If an error occurs, the error information.
* @param {object} entities                  The entities returned by the query.
* @param {object} queryResultContinuation   If more matching entities exist, and could not be returned,
*                                           a continuation token that can be used to retrieve more results.
* @param {object} response                  Information related to this operation.
*/

module.exports = TableService;