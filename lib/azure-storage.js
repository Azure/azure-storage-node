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

var exports = module.exports;

/**
* Creates a connection string that can be used to create a service which runs on the storage emulator. The emulator must be downloaded separately.
*
* @param {string}   [proxyUri]                  The proxyUri. By default, http://127.0.0.1
* @return {string}                              A connection string representing the development storage credentials.
* @example
* var azure = require('azure-storage');
* var devStoreCreds = azure.generateDevelopmentStorageCredendentials();
* var blobService = azure.createBlobService(devStoreCreds);
*/
exports.generateDevelopmentStorageCredendentials = function (proxyUri) {
  var devStore = 'UseDevelopmentStorage=true;';
  if(proxyUri){
    devStore += 'DevelopmentStorageProxyUri=' + proxyUri;
  }

  return devStore;
};

/**
 * Table client exports.
 * @ignore
 */
var TableService = require('./services/table/tableservice');

exports.TableService = TableService;
exports.TableQuery = require('./services/table/tablequery');
exports.TableBatch = require('./services/table/tablebatch');
exports.TableUtilities = require('./services/table/tableutilities');

/**
* Creates a new {@link TableService} object.
* If no storageaccount or storageaccesskey are provided, the AZURE_STORAGE_CONNECTION_STRING and then the AZURE_STORAGE_ACCOUNT and AZURE_STORAGE_ACCESS_KEY 
* environment variables will be used.
*
* @param {string} [storageAccountOrConnectionString]  The storage account or the connection string.
* @param {string} [storageAccessKey]                  The storage access key.
* @param {string|object} [host]                       The host address. To define primary only, pass a string. 
*                                                     Otherwise 'host.primaryHost' defines the primary host and 'host.secondaryHost' defines the secondary host.
* @return {TableService}                              A new TableService object.
*
*/
exports.createTableService = function (storageAccountOrConnectionString, storageAccessKey, host) {
  return new TableService(storageAccountOrConnectionString, storageAccessKey, host);
};

/**
* Creates a new {@link TableService} object using the host Uri and the SAS credentials provided.
* 
* @param {string|object} host                         The host address. To define primary only, pass a string. 
*                                                     Otherwise 'host.primaryHost' defines the primary host and 'host.secondaryHost' defines the secondary host.
* @param {string} sasToken                            The Shared Access Signature token.
* @return {TableService}                              A new TableService object with the SAS credentials.
*/
exports.createTableServiceWithSas = function (hostUri, sasToken) {
  return new TableService(null, null, hostUri, sasToken);
};

/**
 * Blob client exports.
 * @ignore
 */
var BlobService = require('./services/blob/blobservice');

exports.BlobService = BlobService;
exports.BlobUtilities = require('./services/blob/blobutilities');

/**
* Creates a new {@link BlobService} object.
* If no storageaccount or storageaccesskey are provided, the AZURE_STORAGE_CONNECTION_STRING and then the AZURE_STORAGE_ACCOUNT and AZURE_STORAGE_ACCESS_KEY 
* environment variables will be used.
*
* @param {string} storageAccountOrConnectionString    The storage account or the connection string.
* @param {string} [storageAccessKey]                  The storage access key.
* @param {string|object} [host]                       The host address. To define primary only, pass a string. 
*                                                     Otherwise 'host.primaryHost' defines the primary host and 'host.secondaryHost' defines the secondary host.
* @return {BlobService}                               A new BlobService object.
*/
exports.createBlobService = function (storageAccountOrConnectionString, storageAccessKey, host) {
  return new BlobService(storageAccountOrConnectionString, storageAccessKey, host, null);
};

/**
* Creates a new {@link BlobService} object using the host Uri and the SAS credentials provided.
* 
* @param {string|object} host                         The host address. To define primary only, pass a string. 
*                                                     Otherwise 'host.primaryHost' defines the primary host and 'host.secondaryHost' defines the secondary host.
* @param {string} sasToken                            The Shared Access Signature token.
* @return {BlobService}                               A new BlobService object with the SAS credentials.
*/
exports.createBlobServiceWithSas = function (host, sasToken) {
  return new BlobService(null, null, host, sasToken);
};

/**
* Creates a new {@link BlobService} object using the host uri and anonymous access.
* 
* @param {string|object} host                         The host address. To define primary only, pass a string. 
*                                                     Otherwise 'host.primaryHost' defines the primary host and 'host.secondaryHost' defines the secondary host.
* @return {BlobService}                               A new BlobService object with the anonymous credentials.
*/
exports.createBlobServiceAnonymous = function (host) {
  return new BlobService(null, null, host, null);
};

/**
 * File client exports.
 * @ignore
 */
var FileService = require('./services/file/fileservice');

exports.FileService = FileService;
exports.FileUtilities = require('./services/file/fileutilities');

/**
* Creates a new {@link FileService} object.
* If no storageaccount or storageaccesskey are provided, the AZURE_STORAGE_CONNECTION_STRING and then the AZURE_STORAGE_ACCOUNT and AZURE_STORAGE_ACCESS_KEY 
* environment variables will be used.
*
* @param {string} storageAccountOrConnectionString    The storage account or the connection string.
* @param {string} [storageAccessKey]                  The storage access key.
* @param {string|object} [host]                       The host address. To define primary only, pass a string. 
*                                                     Otherwise 'host.primaryHost' defines the primary host and 'host.secondaryHost' defines the secondary host.
* @return {FileService}                               A new FileService object.
*/
exports.createFileService = function (storageAccountOrConnectionString, storageAccessKey, host) {
  return new FileService(storageAccountOrConnectionString, storageAccessKey, host);
};

/**
 * Queue client exports.
 * @ignore
 */
var QueueService = require('./services/queue/queueservice');

exports.QueueService = QueueService;
exports.QueueUtilities = require('./services/queue/queueutilities');

/**
* Creates a new {@link QueueService} object.
* If no storageaccount or storageaccesskey are provided, the AZURE_STORAGE_CONNECTION_STRING and then the AZURE_STORAGE_ACCOUNT and AZURE_STORAGE_ACCESS_KEY 
* environment variables will be used.
*
* @param {string} [storageAccountOrConnectionString]  The storage account or the connection string.
* @param {string} [storageAccessKey]                  The storage access key.
* @param {string|object} [host]                       The host address. To define primary only, pass a string. 
*                                                     Otherwise 'host.primaryHost' defines the primary host and 'host.secondaryHost' defines the secondary host.
* @return {QueueService}                              A new QueueService object.
*/
exports.createQueueService = function (storageAccountOrConnectionString, storageAccessKey, host) {
  return new QueueService(storageAccountOrConnectionString, storageAccessKey, host);
};

/**
* Creates a new {@link QueueService} object using the host Uri and the SAS credentials provided.
* 
* @param {string|object} host                         The host address. To define primary only, pass a string. 
*                                                     Otherwise 'host.primaryHost' defines the primary host and 'host.secondaryHost' defines the secondary host.
* @param {string} sasToken                            The Shared Access Signature token.
* @return {QueueService}                              A new QueueService object with the SAS credentials.
*/
exports.createQueueServiceWithSas = function(hostUri, sasToken) {
  return new QueueService(null, null, hostUri, sasToken);
};

/**
* A callback that returns a response object.
* @callback errorOrResponse
* @param {object} error         If an error occurs, will contain information about the error.
* @param {object} response      Contains information about the response returned for the operation.
*                               For example, HTTP status codes and headers.
*/

/**
* A callback that returns result and response objects.
* @callback errorOrResult
* @param {object} error         If an error occurs, will contain information about the error.
* @param {object} result        The result of the operation.
* @param {object} response      Contains information about the response returned for the operation.
*                               For example, HTTP status codes and headers.
*/

var azureCommon = require('./common/common');

exports.Constants = azureCommon.Constants;
exports.StorageUtilities = azureCommon.StorageUtilities;

exports.SR = azureCommon.SR;
exports.StorageServiceClient = azureCommon.StorageServiceClient;
exports.Logger = azureCommon.Logger;
exports.WebResource = azureCommon.WebResource;
exports.Validate = azureCommon.validate;
exports.date = azureCommon.date;

// Other filters
exports.LinearRetryPolicyFilter = azureCommon.LinearRetryPolicyFilter;
exports.ExponentialRetryPolicyFilter = azureCommon.ExponentialRetryPolicyFilter;
exports.RetryPolicyFilter = azureCommon.RetryPolicyFilter;