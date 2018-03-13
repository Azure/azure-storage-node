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

var assert = require('assert');
var qs = require('querystring');
var fs = require('fs');
var crypto = require('crypto');
var batch = require('batchflow');
var extend = require('extend');

// Test includes
var testutil = require('./framework/util');
var TestSuite = require('./framework/test-suite');

// Lib includes
if (testutil.isBrowser()) {
  var azure = extend({}, AzureStorage.Blob, AzureStorage.Table, AzureStorage.Queue, AzureStorage.File);
} else {
  var azure = require('../');
}

var rfs = require('../lib/common/streams/readablefs');

var Constants = azure.Constants;
var AccountSasConstants = Constants.AccountSasConstants;
var QueryStringConstants = Constants.QueryStringConstants;
var HeaderConstants = Constants.HeaderConstants;
var StorageServiceClientConstants = Constants.StorageServiceClientConstants;
var BlobConstants = Constants.BlobConstants;
var ServiceTypes = Constants.ServiceType;
var TableUtilities = azure.TableUtilities;
var eg = TableUtilities.entityGenerator;

var environmentAzureStorageAccount = 'myaccount';
var environmentAzureStorageAccessKey = 'AhlzsbLRkjfwObuqff3xrhB2yWJNh1EMptmcmxFJ6fvPTVX3PZXwrG2YtYWf5DPMVgNsteKStM5iBLlknYFVoA==';
var environmentAzureStorageDnsSuffix = 'core.windows.net';

var parameterAzureStorageAccount = 'storageAccount';
var parameterAzureStorageAccessKey = 'AhlzsbLRkjfwObuqff3xrhB2yWJNh1EMptmcmxFJ6fvPTVX3PZXwrG2YtYWf5DPMVgNsteKStM5iBLlknYFVoA==';

var firstRun = true;
var originalAzureStorageAccount = null;
var originalAzureStorageAccessKey = null;
var originalAzureStorageDnsSuffix = null;
var originalAzureStorageConnectionString = null;
var originalAzureStorageEmulated = null;


var suite = new TestSuite('accountsas-tests');
var runOrSkip = suite.isMocked ? it.skip : it;
var skipBrowser = testutil.isBrowser() ? it.skip : it;
var skipMockAndBrowser = suite.isBrowser ? it.skip : (suite.isMocked ? it.skip : it);

var getPolicyWithFullPermissions = function(){
  var startDate = new Date();
  var expiryDate = new Date();
  startDate.setTime(startDate.getTime() - 1000);
  expiryDate.setTime(expiryDate.getTime() + 24*60*60*1000);
  
  var sharedAccessPolicy = {
    AccessPolicy: {
      Services: AccountSasConstants.Services.BLOB + 
                AccountSasConstants.Services.FILE + 
                AccountSasConstants.Services.QUEUE + 
                AccountSasConstants.Services.TABLE,
      ResourceTypes: AccountSasConstants.Resources.SERVICE + 
                     AccountSasConstants.Resources.CONTAINER +
                     AccountSasConstants.Resources.OBJECT,
      Permissions: AccountSasConstants.Permissions.READ + 
                   AccountSasConstants.Permissions.ADD +
                   AccountSasConstants.Permissions.CREATE +
                   AccountSasConstants.Permissions.UPDATE +
                   AccountSasConstants.Permissions.PROCESS +
                   AccountSasConstants.Permissions.WRITE +
                   AccountSasConstants.Permissions.DELETE +
                   AccountSasConstants.Permissions.LIST,
      Protocols: AccountSasConstants.Protocols.HTTPSORHTTP,
      Start: startDate,
      Expiry: expiryDate
    }
  };
  
  return sharedAccessPolicy;
};

function defaultServiceProperties(serviceType){
  var serviceProperties = {};
  
  if (serviceType !== ServiceTypes.File) {
    serviceProperties.Logging = {};
    serviceProperties.Logging.Version = '1.0';
    serviceProperties.Logging.Delete = true;
    serviceProperties.Logging.Read = true;
    serviceProperties.Logging.Write = true;
    serviceProperties.Logging.RetentionPolicy = {};
    serviceProperties.Logging.RetentionPolicy.Enabled = true;
    serviceProperties.Logging.RetentionPolicy.Days = 1;
  }
    
  serviceProperties.HourMetrics = {};
  serviceProperties.HourMetrics.Enabled = true;
  serviceProperties.HourMetrics.Version = '1.0';
  serviceProperties.HourMetrics.IncludeAPIs = true;
  serviceProperties.HourMetrics.RetentionPolicy = {};
  serviceProperties.HourMetrics.RetentionPolicy.Enabled = true;
  serviceProperties.HourMetrics.RetentionPolicy.Days = 1;
  
  serviceProperties.MinuteMetrics = {};
  serviceProperties.MinuteMetrics.Enabled = true;
  serviceProperties.MinuteMetrics.Version = '1.0';
  serviceProperties.MinuteMetrics.IncludeAPIs = true;
  serviceProperties.MinuteMetrics.RetentionPolicy = {};
  serviceProperties.MinuteMetrics.RetentionPolicy.Enabled = true;
  serviceProperties.MinuteMetrics.RetentionPolicy.Days = 1;

  serviceProperties.Cors = {};
  var rule = {};
  rule.AllowedOrigins = ['www.ab.com', 'www.bcd.com'];
  rule.AllowedMethods = ['GET', 'PUT'];
  rule.AllowedHeaders = ['x-ms-meta-data*', 'x-ms-meta-target*', 'x-ms-meta-xyz', 'x-ms-meta-foo'];
  rule.ExposedHeaders = ['x-ms-meta-data*', 'x-ms-meta-source*', 'x-ms-meta-abc', 'x-ms-meta-bcd'];
  rule.MaxAgeInSeconds = 500;
  
  var browserRule = {};
  browserRule.AllowedOrigins = ['*'];
  browserRule.AllowedMethods = ['GET', 'PUT', 'POST', 'DELETE', 'OPTIONS', 'HEAD', 'MERGE'];
  browserRule.AllowedHeaders = ['*'];
  browserRule.ExposedHeaders = ['*'];
  browserRule.MaxAgeInSeconds = 88888;

  serviceProperties.Cors.CorsRule = [rule, browserRule];
  
  if (serviceType === ServiceTypes.Blob) {
    serviceProperties.DefaultServiceVersion = HeaderConstants.TARGET_STORAGE_VERSION;
  }

  return serviceProperties;
}

function writeFile(fileName, content) {
  fs.writeFileSync(fileName, content);
  var md5hash = crypto.createHash('md5');
  md5hash.update(content);
  return md5hash.digest('base64');
}

var getAllPossibleFlagsStringEnum = function(enumType){
  var keys = Object.keys(enumType);
  var keyLength = keys.length;
  var resultArrayLength = 1 << keys.length;
  var result = [];
  for(var i = 0; i < resultArrayLength; i++){
    var value = '';
    for(var j = 0; j < keyLength; j++){
      if(((i >> j) & 1) === 1){
        value += enumType[keys[j]];
      }
    }
    result.push(value);
  }
  return result;
}

var runBlobsPermissionTests = function(sharedAccessPolicy, next){
  // General pattern - If current perms support doing a thing with SAS, do the thing with SAS and validate with shared
  // Otherwise, make sure SAS fails and then do the thing with shared key.

  // Things to do:
  // Create the container (Create / Write perms, Container RT)
  // List containers with prefix (List perms, Service RT)
  // Create an append blob (Create / Write perms, Object RT)
  // Read the data from the append blob (Read perms, Object RT)
  // Append a block to append blob (Add / Write perms, Object RT)
  // Delete the blob (Delete perms, Object RT)
  
  var blobService = azure.createBlobService(process.env['AZURE_STORAGE_CONNECTION_STRING']).withFilter(new azure.ExponentialRetryPolicyFilter());  
  var token = azure.generateAccountSharedAccessSignature(process.env['AZURE_STORAGE_CONNECTION_STRING'], null, sharedAccessPolicy);
  var sharedBlobService = azure.createBlobServiceWithSas(blobService.host, token).withFilter(new azure.ExponentialRetryPolicyFilter());; 
  
  var containerNames = [];
  var blobLength = 10000;
  var containerNamesPrefix = 'cont' + (suite.isMocked ? 0 : Math.floor(Math.random() * blobLength));
  var containerName = testutil.generateId(containerNamesPrefix, containerNames, suite.isMocked);
  var blobName = 'testblob';
  var blobText = "blobText";
  
  var testCreateContainer = function(next){
    if((sharedAccessPolicy.AccessPolicy.Permissions.indexOf(AccountSasConstants.Permissions.CREATE) > -1 ||
    sharedAccessPolicy.AccessPolicy.Permissions.indexOf(AccountSasConstants.Permissions.WRITE) > -1) &&
    sharedAccessPolicy.AccessPolicy.ResourceTypes.indexOf(AccountSasConstants.Resources.CONTAINER) > -1){
      sharedBlobService.createContainer(containerName, function(error, result){
        if(error) {
          throw error;
        }
        assert.notEqual(result, null);
        assert.equal(result.name, containerName);
        next();
      });
    } else {
      sharedBlobService.createContainer(containerName, function(error, result){
        assert.notEqual(error, null, 'Create a container should fail with SAS without Create or Write and Container-level permissions.');
        
        blobService.createContainer(containerName, function(error, result){
          assert.equal(error, null);
          assert.notEqual(result, null);
          assert.equal(result.name, containerName);
          next();
        });
      });
    }
  };
  
  var testListContainersWithPrefix = function(next){
    if(sharedAccessPolicy.AccessPolicy.Permissions.indexOf(AccountSasConstants.Permissions.LIST) > -1 &&
    sharedAccessPolicy.AccessPolicy.ResourceTypes.indexOf(AccountSasConstants.Resources.SERVICE) > -1){
      sharedBlobService.listContainersSegmentedWithPrefix(containerNamesPrefix, null, function(error, result){
        if(error) {
          throw error;
        }
        assert.notEqual(result, null);
        next();
      });
    } else {
      sharedBlobService.listContainersSegmentedWithPrefix(containerNamesPrefix, null, function(error, result){
        assert.notEqual(error, null, 'List containers should fail with SAS without List and Service-level permissions.');
        next();
      });
    }
  };
  
  var testCreateAppendBlob = function(next){
    if((sharedAccessPolicy.AccessPolicy.Permissions.indexOf(AccountSasConstants.Permissions.CREATE) > -1 ||
      sharedAccessPolicy.AccessPolicy.Permissions.indexOf(AccountSasConstants.Permissions.WRITE) > -1) &&
      sharedAccessPolicy.AccessPolicy.ResourceTypes.indexOf(AccountSasConstants.Resources.OBJECT) > -1){
      sharedBlobService.createOrReplaceAppendBlob(containerName, blobName, function(error, result){
        if(error) {
          throw error;
        }
        next();
      });
    } else {
      sharedBlobService.createOrReplaceAppendBlob(containerName, blobName, function(error){
          assert.notEqual(error, null, 'Creating an append blob should fail with SAS without Create or Write and Object-level perms.');
          
          blobService.createOrReplaceAppendBlob(containerName, blobName, function(error, result){
          assert.equal(error, null);
          next();
        });
      });
    }
  };
  
  var testAppendBlockToAppendBlob = function(next){
    if(sharedAccessPolicy.AccessPolicy.Permissions.indexOf(AccountSasConstants.Permissions.READ) > -1 &&
    sharedAccessPolicy.AccessPolicy.Permissions.indexOf(AccountSasConstants.Permissions.WRITE) > -1 &&
    sharedAccessPolicy.AccessPolicy.ResourceTypes.indexOf(AccountSasConstants.Resources.OBJECT) > -1){
      sharedBlobService.appendFromText(containerName, blobName, blobText, function(error, result){
        if(error) {
          throw error;
        }
        assert.notEqual(result, null);
        next();
      });
    } else {
      sharedBlobService.appendFromText(containerName, blobName, blobText, function(error){
        assert.notEqual(error, null, 'Append a block to an append blob should fail with SAS without Add or Write and Object-level perms.');
        
        blobService.appendFromText(containerName, blobName, blobText, function(error, result){
          assert.equal(error, null);
          assert.notEqual(result, null);
          next();
        });
      });
    }
  };
  
  var testDownloadAppendBlobText = function(next){
    if(sharedAccessPolicy.AccessPolicy.Permissions.indexOf(AccountSasConstants.Permissions.READ) > -1 &&
    sharedAccessPolicy.AccessPolicy.ResourceTypes.indexOf(AccountSasConstants.Resources.OBJECT) > -1){
      sharedBlobService.getBlobToText(containerName, blobName, function(error, blobTextResponse){
        if(error) {
          throw error;
        }
        assert.notEqual(blobTextResponse, null);
        next();
      });
    } else {
      sharedBlobService.getBlobToText(containerName, blobName, function(error){
        assert.notEqual(error, null, 'Reading a blob contents with SAS without Read and Object-level permissions should fail.');
        next();
      });
    }
  };
  
  var testDeleteBlob = function(next){
    if(sharedAccessPolicy.AccessPolicy.Permissions.indexOf(AccountSasConstants.Permissions.DELETE) > -1 &&
    sharedAccessPolicy.AccessPolicy.ResourceTypes.indexOf(AccountSasConstants.Resources.OBJECT) > -1){
      sharedBlobService.deleteBlob(containerName, blobName, function(error){
        if(error) {
          throw error;
        }
        next();
      });
    } else {
      sharedBlobService.deleteBlob(containerName, blobName, function(error){
        assert.notEqual(error, null, 'Deleting a blob with SAS without Delete and Object-level perms should fail.');
        
        blobService.deleteBlob(containerName, blobName, function(error){
          next();
        });
      });
    }
  };
  
  var testDeleteContainer = function(next){
    if(sharedAccessPolicy.AccessPolicy.Permissions.indexOf(AccountSasConstants.Permissions.DELETE) > -1 &&
    sharedAccessPolicy.AccessPolicy.ResourceTypes.indexOf(AccountSasConstants.Resources.CONTAINER) > -1){
      sharedBlobService.deleteContainer(containerName, function(error){
        if(error) {
          throw error;
        }
        next();
      });
    } else {
      sharedBlobService.deleteContainer(containerName, function(error){
        assert.notEqual(error, null, 'Deleting a container with SAS without Delete and Container-level perms should fail.');
        
        blobService.deleteContainer(containerName, function(error){
          assert.equal(error, null);
          next();
        });
      });
    }
  };
  
  testCreateContainer(function(){
    testListContainersWithPrefix(function(){
      testCreateAppendBlob(function(){
        testAppendBlockToAppendBlob(function(){
          testDownloadAppendBlobText(function(){
            testDeleteBlob(function(){
              testDeleteContainer(function(){
                next();
              });
            });
          });
        });
      });
    });
  });
};

var runTablesPermissionTests = function(sharedAccessPolicy, next){
  // General pattern - If current perms support doing a thing with SAS, do the thing with SAS and validate with shared
  // Otherwise, make sure SAS fails and then do the thing with shared key.

  // Things to do:
  // Create the table (Create or Write perms, Container RT)
  // List tables (List perms, Container RT)
  // Set table service properties (Write perms, Service RT)
  // Insert an entity (Add perms, Object RT)
  // Merge an entity (Update perms, Object RT)
  // Insert or merge an entity (Add and update perms, Object RT) (test this twice, once for insert, once for merge.)
  // Query the table for the entity (Read perms, Object RT)
  // Delete the entity (Delete perms, Object RT)
  // Delete the table (Delete perms, Container RT)

  var tableService = azure.createTableService(process.env['AZURE_STORAGE_CONNECTION_STRING']).withFilter(new azure.ExponentialRetryPolicyFilter());;
  var token = azure.generateAccountSharedAccessSignature(process.env['AZURE_STORAGE_CONNECTION_STRING'], null, sharedAccessPolicy);
  var sharedTableService = azure.createTableServiceWithSas(tableService.host, token).withFilter(new azure.ExponentialRetryPolicyFilter());;
  var tablePrefix = 'tableservice';
  var tableName = suite.getName(tablePrefix).replace(/-/g,'');
  var entity1 = { PartitionKey: eg.String('part1'),
    RowKey: eg.String('row1'),
    field: eg.String('my field')
  };
  var entity2 =  { PartitionKey: eg.String('part1'),
    RowKey: eg.String('row2'),
    field: eg.String('my field')
  };
    
  var testCreateTable = function(next){
    if((sharedAccessPolicy.AccessPolicy.Permissions.indexOf(AccountSasConstants.Permissions.CREATE) > -1 ||
    sharedAccessPolicy.AccessPolicy.Permissions.indexOf(AccountSasConstants.Permissions.WRITE) > -1) &&
    sharedAccessPolicy.AccessPolicy.ResourceTypes.indexOf(AccountSasConstants.Resources.CONTAINER) > -1){
      sharedTableService.createTable(tableName, function(error, result){
        if(error) {
          throw error;
        }
        assert.notEqual(result, null);
        assert.equal(result.TableName, tableName);
        next();
      });
    } else {
      sharedTableService.createTable(tableName, function(error, result){
        assert.notEqual(error, null, 'Creating a table with SAS should fail without Add and Container-level permissions.');
        
        tableService.createTable(tableName, function(error, result){
          assert.equal(error, null);
          assert.notEqual(result, null);
          assert.equal(result.TableName, tableName);
          next();
        });
      });
    }
  };
  
  var testListTablesWithPrefix = function(next){
    if(sharedAccessPolicy.AccessPolicy.Permissions.indexOf(AccountSasConstants.Permissions.LIST) > -1 &&
    sharedAccessPolicy.AccessPolicy.ResourceTypes.indexOf(AccountSasConstants.Resources.CONTAINER) > -1){
      sharedTableService.listTablesSegmentedWithPrefix(tablePrefix, null, function(error, result){
        if(error) {
          throw error;
        }
        assert.notEqual(result, null);
        next();
      });
    } else {
      sharedTableService.listTablesSegmentedWithPrefix(tablePrefix, null, function(error, result){
        assert.notEqual(error, null, 'Listing tables with SAS should fail without Read and Container-level permissions.');
        next();
      });
    }
  };
  
  var testSetTableServiceProperties = function(next){
    var serviceProperties = defaultServiceProperties(ServiceTypes.Table);
    
    if(sharedAccessPolicy.AccessPolicy.Permissions.indexOf(AccountSasConstants.Permissions.WRITE) > -1 &&
    sharedAccessPolicy.AccessPolicy.ResourceTypes.indexOf(AccountSasConstants.Resources.SERVICE) > -1){
      sharedTableService.setServiceProperties(serviceProperties, function (error) {
        if(error) {
          throw error;
        }
        next();
      });
    } else {
      sharedTableService.setServiceProperties(serviceProperties, function (error) {
        assert.notEqual(error, null, 'Setting table service properties should fail with SAS without Write and Service-level permissions.');
        
        tableService.setServiceProperties(serviceProperties, function (error) {
          if(error) {
            throw error;
          }
          next();
        });
      });
    }
  };
  
  var testInsertEntity = function(next){
    if(sharedAccessPolicy.AccessPolicy.Permissions.indexOf(AccountSasConstants.Permissions.ADD) > -1 &&
    sharedAccessPolicy.AccessPolicy.ResourceTypes.indexOf(AccountSasConstants.Resources.OBJECT) > -1){
      sharedTableService.insertEntity(tableName, entity1, function (error) {
        if(error) {
          throw error;
        }
        next();
      });
    } else {
      sharedTableService.insertEntity(tableName, entity1, function (error) {
        assert.notEqual(error, null, 'Inserting an entity should fail without Add and Object-level permissions.');
        
        tableService.insertEntity(tableName, entity1, function (error) {
          assert.equal(error, null);
          next();
        }); 
      });
    }
  };
  
  var testMergeEntity = function(next){
    var entity1Changed =  { PartitionKey: eg.String('part1'),
      RowKey: eg.String('row1'),
      newField: eg.String('new field to be merged')
    };
    
    if(sharedAccessPolicy.AccessPolicy.Permissions.indexOf(AccountSasConstants.Permissions.UPDATE) > -1 &&
    sharedAccessPolicy.AccessPolicy.ResourceTypes.indexOf(AccountSasConstants.Resources.OBJECT) > -1){
      sharedTableService.mergeEntity(tableName, entity1Changed, function (error) {
        if(error) {
          throw error;
        }
        next();
      });
    } else {
      sharedTableService.mergeEntity(tableName, entity1Changed, function (error) {
        assert.notEqual(error, null, 'Merging an entity should fail without Update and Object-level permissions.');
        
        tableService.mergeEntity(tableName, entity1Changed, function (error) {
          assert.equal(error, null);
          next();
        });
      });
    }
  };
  
  // InsertOrMerge - Insert
  var testInsertOrMergeEntity = function(next){
    if(sharedAccessPolicy.AccessPolicy.Permissions.indexOf(AccountSasConstants.Permissions.ADD) > -1 &&
    sharedAccessPolicy.AccessPolicy.Permissions.indexOf(AccountSasConstants.Permissions.UPDATE) > -1 &&
    sharedAccessPolicy.AccessPolicy.ResourceTypes.indexOf(AccountSasConstants.Resources.OBJECT) > -1){
      sharedTableService.insertOrMergeEntity(tableName, entity2, function (error) {
        if(error) {
          throw error;
        }
        next();
      });
    } else {
      sharedTableService.insertOrMergeEntity(tableName, entity2, function (error) {
        assert.notEqual(error, null, 'Inserting or merging an entity should fail without Add and Update and Object-level permissions.');
        
        tableService.insertOrMergeEntity(tableName, entity2, function (error) {
          assert.equal(error, null);
          next();
        });
      });
    }
  };
  
  // InsertOrMerge - Merge
  var testInsertOrMergeEntity2 = function(next){    
    var entity2Changed =  { PartitionKey: eg.String('part1'),
      RowKey: eg.String('row2'),
      newField: eg.String('new field to be merged')
    };
    if(sharedAccessPolicy.AccessPolicy.Permissions.indexOf(AccountSasConstants.Permissions.ADD) > -1 &&
    sharedAccessPolicy.AccessPolicy.Permissions.indexOf(AccountSasConstants.Permissions.UPDATE) > -1 &&
    sharedAccessPolicy.AccessPolicy.ResourceTypes.indexOf(AccountSasConstants.Resources.OBJECT) > -1){
      sharedTableService.insertOrMergeEntity(tableName, entity2Changed, function (error) {
        if(error) {
          throw error;
        }
        next();
      });
    } else {
      sharedTableService.insertOrMergeEntity(tableName, entity2Changed, function (error) {
        assert.notEqual(error, null, 'Inserting or merging an entity should fail without Add and Update and Object-level permissions.');
        
        tableService.insertOrMergeEntity(tableName, entity2Changed, function (error) {
          assert.equal(error, null);
          next();
        });
      });
    }
  };
  
  var testRetrieveEntity = function(next){
    if(sharedAccessPolicy.AccessPolicy.Permissions.indexOf(AccountSasConstants.Permissions.READ) > -1 &&
    sharedAccessPolicy.AccessPolicy.ResourceTypes.indexOf(AccountSasConstants.Resources.OBJECT) > -1){
      sharedTableService.retrieveEntity(tableName, 'part1', 'row1', function (error, result) {
        if(error) {
          throw error;
        }
        assert.notEqual(result, null);
        next();
      });
    } else {
      sharedTableService.retrieveEntity(tableName, 'part1', 'row1', function (error) {
        assert.notEqual(error, null, 'Querying tables should fail with SAS without Read and Object-level permissions.');
        next();
      });
    }
  };
  
  var testDeleteEntity = function(next){
    if(sharedAccessPolicy.AccessPolicy.Permissions.indexOf(AccountSasConstants.Permissions.DELETE) > -1 &&
    sharedAccessPolicy.AccessPolicy.ResourceTypes.indexOf(AccountSasConstants.Resources.OBJECT) > -1){
      sharedTableService.deleteEntity(tableName, entity1, function (error, response) {
        if(error) {
          throw error;
        }
        assert.ok(response.isSuccessful);
        next();
      });
    } else {
      sharedTableService.deleteEntity(tableName, entity1, function (error) {
        assert.notEqual(error, null, 'Deleting an entity should fail with SAS without Delete and Object-level permissions.');
        
        tableService.deleteEntity(tableName, entity1, function (error) {
          next();
        });
      });
    }
  };
  
  var testDeleteTable = function(next){
    if(sharedAccessPolicy.AccessPolicy.Permissions.indexOf(AccountSasConstants.Permissions.DELETE) > -1 &&
    sharedAccessPolicy.AccessPolicy.ResourceTypes.indexOf(AccountSasConstants.Resources.CONTAINER) > -1){
      sharedTableService.deleteTable(tableName, function (error, response) {
        if(error) {
          throw error;
        }
        assert.ok(response.isSuccessful);
        next();
      });
    } else {
      sharedTableService.deleteTable(tableName, function (error) {
        assert.notEqual(error, null, 'Deleting an table should fail with SAS without Delete and Container-level permissions.');

        tableService.deleteTable(tableName, function (error) {
          next();
        });
      });
    }
  };
  
  testCreateTable(function(){
    testListTablesWithPrefix(function(){
      testSetTableServiceProperties(function(){
        testInsertEntity(function(){
          testMergeEntity(function(){
            testInsertOrMergeEntity(function(){
              testInsertOrMergeEntity2(function(){
                testRetrieveEntity(function(){
                  testDeleteEntity(function(){
                    testDeleteTable(function(){
                      next();
                    })
                  })
                })
              })
            })
          })
        })
      })
    })
  });
};

var runQueuesPermissionTests = function(sharedAccessPolicy, next){
  // General pattern - If current perms support doing a thing with SAS, do the thing with SAS and validate with shared
  // Otherwise, make sure SAS fails and then do the thing with shared key.

  // Things to do:
  // Create the queue (Create or Write perms, Container RT)
  // List queues (List perms, Service RT)
  // Set queue metadata (Write perms, Container RT)
  // Insert a message (Add perms, Object RT)
  // Peek a message (Read perms, Object RT)
  // Get a message (Process perms, Object RT)
  // Update a message (Update perms, Object RT)
  // Clear all messages (Delete perms, Object RT)
  // Delete the queue (Delete perms, Container RT)
  
  var queueService = azure.createQueueService(process.env['AZURE_STORAGE_CONNECTION_STRING']).withFilter(new azure.ExponentialRetryPolicyFilter());;
  var token = azure.generateAccountSharedAccessSignature(process.env['AZURE_STORAGE_CONNECTION_STRING'], null, sharedAccessPolicy);
  var sharedQueueService = azure.createQueueServiceWithSas(queueService.host, token).withFilter(new azure.ExponentialRetryPolicyFilter());;
  var queuePrefix = 'queueservice';
  var queueName = suite.getName(queuePrefix);
  
  var testCreateQueue = function(next){
    if((sharedAccessPolicy.AccessPolicy.Permissions.indexOf(AccountSasConstants.Permissions.CREATE) > -1 ||
    sharedAccessPolicy.AccessPolicy.Permissions.indexOf(AccountSasConstants.Permissions.WRITE) > -1) &&
    sharedAccessPolicy.AccessPolicy.ResourceTypes.indexOf(AccountSasConstants.Resources.CONTAINER) > -1){
      sharedQueueService.createQueue(queueName, function(error, result){
        if(error) {
          throw error;
        }
        assert.notEqual(result, null);
        assert.equal(result.name, queueName);
        next();
      });
    } else {
      sharedQueueService.createQueue(queueName, function(error, result){
        assert.notEqual(error, null, 'Creating a queue with SAS should fail without Add and Container-level permissions.');
        
        queueService.createQueue(queueName, function(error, result){
          if(error) {
            throw error;
          }
          assert.notEqual(result, null);
          assert.equal(result.name, queueName);
          next();
        });
      });
    }
  };
  
  var testListQueuesWithPrefix = function(next){
    if(sharedAccessPolicy.AccessPolicy.Permissions.indexOf(AccountSasConstants.Permissions.LIST) > -1 &&
    sharedAccessPolicy.AccessPolicy.ResourceTypes.indexOf(AccountSasConstants.Resources.SERVICE) > -1){
      sharedQueueService.listQueuesSegmentedWithPrefix(queuePrefix, null, function(error, result){
        if(error) {
          throw error;
        }
        assert.notEqual(result, null);
        next();
      });
    } else {
      sharedQueueService.listQueuesSegmentedWithPrefix(queuePrefix, null, function(error, result){
        assert.notEqual(error, null, 'Listing queues with SAS should fail without Read and Service-level permissions.');
        next();
      });
    }
  };
  
  var testSetQueueMetadata = function(next){
    var metadata = { 'Class': 'Test' };
    
    if(sharedAccessPolicy.AccessPolicy.Permissions.indexOf(AccountSasConstants.Permissions.WRITE) > -1 &&
    sharedAccessPolicy.AccessPolicy.ResourceTypes.indexOf(AccountSasConstants.Resources.CONTAINER) > -1){
      sharedQueueService.setQueueMetadata(queueName, metadata, function(error){
        if(error) {
          throw error;
        }
        next();
      });
    } else {
      sharedQueueService.setQueueMetadata(queueName, metadata, function(error){
        assert.notEqual(error, null, 'Setting a queue metadata with SAS should fail without Write and Container-level permissions.');
        next();
      });
    }
  };
  
  var testCreateMessage = function(next){
    if(sharedAccessPolicy.AccessPolicy.Permissions.indexOf(AccountSasConstants.Permissions.ADD) > -1 &&
    sharedAccessPolicy.AccessPolicy.ResourceTypes.indexOf(AccountSasConstants.Resources.OBJECT) > -1){
      sharedQueueService.createMessage(queueName, 'msg1', function(error){
        if(error) {
          throw error;
        }
        next();
      });
    } else {
      sharedQueueService.createMessage(queueName, 'msg1', function(error){
        assert.notEqual(error, null, 'Adding a queue message should fail with SAS without Add and Object-level permissions.');
        
        queueService.createMessage(queueName, 'msg1', function(error){
          assert.equal(error, null);
          next();
        });
      });
    }
  };
  
  var testPeekMessages = function(next){
    if(sharedAccessPolicy.AccessPolicy.Permissions.indexOf(AccountSasConstants.Permissions.READ) > -1 &&
    sharedAccessPolicy.AccessPolicy.ResourceTypes.indexOf(AccountSasConstants.Resources.OBJECT) > -1){
      sharedQueueService.peekMessages(queueName, function(error, queueMessages){
        if(error) {
          throw error;
        }
        assert.notEqual(queueMessages, null);
        var queueMessage = queueMessages[0];
        assert.ok(queueMessage);
        assert.ok(queueMessage['messageId']);
        assert.ok(queueMessage['insertionTime']);
        assert.ok(queueMessage['expirationTime']);
        assert.equal(queueMessage.messageText, 'msg1');
        next();
      });
    } else {
      sharedQueueService.peekMessages(queueName, function(error){
        assert.notEqual(error, null, 'Peeking a queue message should fail with SAS without Read and Object-level permissions.');
        
        queueService.peekMessages(queueName, function(error, queueMessages){
          assert.equal(error, null);
          assert.notEqual(queueMessages, null);
          var queueMessage = queueMessages[0];
          assert.ok(queueMessage);
          assert.ok(queueMessage['messageId']);
          assert.ok(queueMessage['insertionTime']);
          assert.ok(queueMessage['expirationTime']);
          assert.equal(queueMessage.messageText, 'msg1');
          next();
        });
      });
    }
  };
  
  var testGetMessages = function(next){
    if(sharedAccessPolicy.AccessPolicy.Permissions.indexOf(AccountSasConstants.Permissions.PROCESS) > -1 &&
    sharedAccessPolicy.AccessPolicy.ResourceTypes.indexOf(AccountSasConstants.Resources.OBJECT) > -1){
      sharedQueueService.getMessages(queueName, function(error, queueMessages){
        if(error) {
          throw error;
        }
        assert.notEqual(queueMessages, null);
        var queueMessage = queueMessages[0];
        assert.ok(queueMessage);
        assert.ok(queueMessage['messageId']);
        assert.ok(queueMessage['insertionTime']);
        assert.ok(queueMessage['expirationTime']);
        assert.equal(queueMessage.messageText, 'msg1');
        
        next(queueMessage);
      });
    } else {
      sharedQueueService.getMessages(queueName, function(error){
        assert.notEqual(error, null, 'Getting a message should fail with SAS without Process and Object-level permissions.');
        
        queueService.getMessages(queueName, function(error, queueMessages){
          assert.equal(error, null);
          assert.notEqual(queueMessages, null);
          var queueMessage = queueMessages[0];
          assert.ok(queueMessage);
          assert.ok(queueMessage['messageId']);
          assert.ok(queueMessage['insertionTime']);
          assert.ok(queueMessage['expirationTime']);
          assert.equal(queueMessage.messageText, 'msg1');
          
          next(queueMessage);
        });
      });
    }
  };
  
  var testUpdateMessage = function(queueMessage, next){
    if(sharedAccessPolicy.AccessPolicy.Permissions.indexOf(AccountSasConstants.Permissions.UPDATE) > -1 &&
    sharedAccessPolicy.AccessPolicy.ResourceTypes.indexOf(AccountSasConstants.Resources.OBJECT) > -1){
      sharedQueueService.updateMessage(queueName, queueMessage.messageId, queueMessage.popReceipt, 0, { messageText: 'msg1-updated' }, function(error){
        if(error) {
          throw error;
        }
        next();
      });
    } else {
      sharedQueueService.updateMessage(queueName, queueMessage.messageId, queueMessage.popReceipt, 0, { messageText: 'msg1-updated' }, function(error){
        assert.notEqual(error, null, 'Updating a message should fail with SAS without Update and Object-level permissions.');
        
        queueService.updateMessage(queueName, queueMessage.messageId, queueMessage.popReceipt, 0, { messageText: 'msg1-updated' }, function(error){
          assert.equal(error, null);
          next();
        });
      });
    }
  };
  
  var testClearMessage = function(next){
    if(sharedAccessPolicy.AccessPolicy.Permissions.indexOf(AccountSasConstants.Permissions.DELETE) > -1 &&
    sharedAccessPolicy.AccessPolicy.ResourceTypes.indexOf(AccountSasConstants.Resources.OBJECT) > -1){
      sharedQueueService.clearMessages(queueName, function(error){
        if(error) {
          throw error;
        }
        next();
      });
    } else {
      sharedQueueService.clearMessages(queueName, function(error){
        assert.notEqual(error, null, 'Clearing messages should fail with SAS without delete and Object-level permissions.');
        
        queueService.clearMessages(queueName, function(error){
          assert.equal(error, null);
          next();
        });
      });
    }
  };
  
  var testDeleteQueue = function(next){
    if(sharedAccessPolicy.AccessPolicy.Permissions.indexOf(AccountSasConstants.Permissions.DELETE) > -1 &&
    sharedAccessPolicy.AccessPolicy.ResourceTypes.indexOf(AccountSasConstants.Resources.CONTAINER) > -1){
      sharedQueueService.deleteQueue(queueName, function(error){
        if(error) {
          throw error;
        }
        next();
      });
    } else {
      sharedQueueService.deleteQueue(queueName, function(error){
        assert.notEqual(error, null, 'Deleting queue should fail with SAS without delete and Container-level permissions.');
        
        queueService.deleteQueue(queueName, function(error){
          assert.equal(error, null);
          next();
        });
      });
    }
  };
  
  testCreateQueue(function(){
    testListQueuesWithPrefix(function(){
      testSetQueueMetadata(function(){
        testCreateMessage(function(){
          testPeekMessages(function(){
            testGetMessages(function(queueMessage){
              testUpdateMessage(queueMessage, function(){
                testClearMessage(function(){
                  testDeleteQueue(function(){
                    next();
                  })
                })
              })
            })
          })
        })
      })
    })
  });
};

var runFilesPermissionTests = function(sharedAccessPolicy, next){
  // General pattern - If current perms support doing a thing with SAS, do the thing with SAS and validate with shared
  // Otherwise, make sure SAS fails and then do the thing with shared key.

  // Things to do:
  // Create the share (Create / Write perms, Container RT)
  // List shares with prefix (List perms, Service RT)
  // Create a new file (Create / Write, Object RT)
  // Write to the file (Write, Object RT)
  // Read the data from the file (Read, Object RT)
  // Delete the file (Delete perms, Object RT)
  // Delete the share (Delete perms, Container RT)
  
  var fileService = azure.createFileService(process.env['AZURE_STORAGE_CONNECTION_STRING']).withFilter(new azure.ExponentialRetryPolicyFilter());;
  var token = azure.generateAccountSharedAccessSignature(process.env['AZURE_STORAGE_CONNECTION_STRING'], null, sharedAccessPolicy);
  var sharedFileService = azure.createFileServiceWithSas(fileService.host, token).withFilter(new azure.ExponentialRetryPolicyFilter());;
  var sharePrefix = 'fileservice-testshare';
  var shareName = suite.getName(sharePrefix);
  var fileName = suite.getName("file-");
  var localTempFileName = suite.getName('fileservice_test_block');
  var fileSize = 100;
  var fileBuffer = new Buffer( fileSize );
  fileBuffer.fill(1);
  writeFile(localTempFileName, fileBuffer);
  
  var testCreateShare = function(next){
    if((sharedAccessPolicy.AccessPolicy.Permissions.indexOf(AccountSasConstants.Permissions.CREATE) > -1 ||
    sharedAccessPolicy.AccessPolicy.Permissions.indexOf(AccountSasConstants.Permissions.WRITE) > -1) &&
    sharedAccessPolicy.AccessPolicy.ResourceTypes.indexOf(AccountSasConstants.Resources.CONTAINER) > -1){
      sharedFileService.createShare(shareName, function(error, result){
        if(error) {
          throw error;
        }
        assert.notEqual(result, null);
        assert.equal(result.name, shareName);
        next();
      });
    } else {
      sharedFileService.createShare(shareName, function(error, result){
        assert.notEqual(error, null, 'Creating a share with SAS should fail without Create or Write and Container-level perms.');
        
        fileService.createShare(shareName, function(error, result){
          assert.equal(error, null);
          assert.notEqual(result, null);
          assert.equal(result.name, shareName);
          next();
        });
      });
    }
  };
  
  var testListSharesWithPrefix = function(next){
    if(sharedAccessPolicy.AccessPolicy.Permissions.indexOf(AccountSasConstants.Permissions.LIST) > -1 &&
    sharedAccessPolicy.AccessPolicy.ResourceTypes.indexOf(AccountSasConstants.Resources.SERVICE) > -1){
      sharedFileService.listSharesSegmentedWithPrefix(sharePrefix, null, function(error){
        if(error) {
          throw error;
        }
        next();
      });
    } else {
      sharedFileService.listSharesSegmentedWithPrefix(sharePrefix, null, function(error, result){
        assert.notEqual(error, null, 'Listing shared with SAS should fail without List and Service-level perms.');
        next();
      });
    }
  };
  
  var testCreateFile = function(next){
    if((sharedAccessPolicy.AccessPolicy.Permissions.indexOf(AccountSasConstants.Permissions.CREATE) > -1 ||
    sharedAccessPolicy.AccessPolicy.Permissions.indexOf(AccountSasConstants.Permissions.WRITE) > -1) &&
    sharedAccessPolicy.AccessPolicy.ResourceTypes.indexOf(AccountSasConstants.Resources.OBJECT) > -1){
      sharedFileService.createFile(shareName, '', fileName, fileSize, function (error) {
        if(error) {
          throw error;
        }
        next();
      });
    } else {
      sharedFileService.createFile(shareName, '', fileName, fileSize, function (error) {
        assert.notEqual(error, null, 'Creating a file with SAS should fail without Create or Write and Object-level perms.');
        
        fileService.createFile(shareName, '', fileName, fileSize, function (error) {
          assert.equal(error, null);
          next();
        });
      });
    }
  };
  
  var testWriteFile = function(next){
    var writableStream;
    if(sharedAccessPolicy.AccessPolicy.Permissions.indexOf(AccountSasConstants.Permissions.WRITE) > -1 &&
    sharedAccessPolicy.AccessPolicy.ResourceTypes.indexOf(AccountSasConstants.Resources.OBJECT) > -1){
      writableStream = sharedFileService.createWriteStreamToExistingFile(shareName, '', fileName, function(error){
        if(error) {
          throw error;
        }
        next();
      });
      rfs.createReadStream(localTempFileName).pipe(writableStream);
    } else {
      sharedFileService.createRangesFromStream(shareName, '', fileName, rfs.createReadStream(localTempFileName), 0, fileSize - 1, function(error){
        assert.notEqual(error, null, 'Writing to a file with SAS should fail without Write and Object-level perms.');
        next();
      });
    }
  };
  
  var testReadFile = function(next){
    if(sharedAccessPolicy.AccessPolicy.Permissions.indexOf(AccountSasConstants.Permissions.READ) > -1 &&
    sharedAccessPolicy.AccessPolicy.ResourceTypes.indexOf(AccountSasConstants.Resources.OBJECT) > -1){
      sharedFileService.getFileToText(shareName, '', fileName, function(error){
        if(error) {
          throw error;
        }
        next();
      });
    } else {
      sharedFileService.getFileToText(shareName, '', fileName, function(error){
        assert.notEqual(error, null, 'Reading a file with SAS should fail without Read and Object-level perms.');
        next();
      });
    }
  };
  
  var testDeleteFile = function(next){
    if(sharedAccessPolicy.AccessPolicy.Permissions.indexOf(AccountSasConstants.Permissions.DELETE) > -1 &&
    sharedAccessPolicy.AccessPolicy.ResourceTypes.indexOf(AccountSasConstants.Resources.OBJECT) > -1){
      sharedFileService.deleteFile(shareName, '', fileName, function(error){
        if(error) {
          throw error;
        }
        next();
      });
    } else {
      sharedFileService.deleteFile(shareName, '', fileName, function(error){
        assert.notEqual(error, null, 'Deleting a file with SAS should fail without Delete and Object-level perms.');
        
        fileService.deleteFile(shareName, '', fileName, function(error){
          next();
        });
      });
    }
  };
  
  var testDeleteShare = function(next){
    if(sharedAccessPolicy.AccessPolicy.Permissions.indexOf(AccountSasConstants.Permissions.DELETE) > -1 &&
    sharedAccessPolicy.AccessPolicy.ResourceTypes.indexOf(AccountSasConstants.Resources.CONTAINER) > -1){
      sharedFileService.deleteShare(shareName, function(error){
        if(error) {
          throw error;
        }
        next();
      });
    } else {
      sharedFileService.deleteShare(shareName, function(error){
        assert.notEqual(error, null, 'Deleting a share with SAS should fail without Delete and Container-level perms.');
        
        fileService.deleteShare(shareName, function(error){
          next();
        });
      });
    }
  };
  
  testCreateShare(function(){
    testListSharesWithPrefix(function(){
      testCreateFile(function(){
        testWriteFile(function(){
          testReadFile(function(){
            testDeleteFile(function(){
              testDeleteShare(function(){
                fs.unlink(localTempFileName, function(error){
                  next();
                });
              });
            });
          });
        });
      });
    });
  });
};

var runBlobsSanityTest = function(sharedAccessPolicy, next, useHttp){
  
  // Simply create an append blob and upload some test text to make sure the blob service works fine with the provided account SAS
  
  var blobService = azure.createBlobService(process.env['AZURE_STORAGE_CONNECTION_STRING']).withFilter(new azure.ExponentialRetryPolicyFilter());;
  if(useHttp){
    blobService.host.primaryHost = blobService.host.primaryHost.replace('https://', 'http://').replace(':443', ':80');
    blobService.host.secondaryHost = blobService.host.primaryHost.replace('https://', 'http://').replace(':443', ':80');
  }
  
  var token = azure.generateAccountSharedAccessSignature(process.env['AZURE_STORAGE_CONNECTION_STRING'], null, sharedAccessPolicy);
  var sharedBlobService = azure.createBlobServiceWithSas(blobService.host, token).withFilter(new azure.ExponentialRetryPolicyFilter());; 
  
  var containerNames = [];
  var blobLength = 10000;
  var containerNamesPrefix = 'cont' + (suite.isMocked ? 0 : Math.floor(Math.random() * blobLength));
  var containerName = testutil.generateId(containerNamesPrefix, containerNames, suite.isMocked);
  var blobName = 'testblob';
  var blobText = "blobText";
  
  sharedBlobService.createContainer(containerName, function(error){
    if(error){
      next(error);
    } else {
      sharedBlobService.createAppendBlobFromText(containerName, blobName, blobText, function(error){
        blobService.deleteContainer(containerName, function(){
          next(error);
        });
      });
    }
  });
};

var runTablesSanityTest = function(sharedAccessPolicy, next, useHttp){
  
  // Simply create an table and insert an entity to make sure the table service works fine with the provided account SAS
  
  var tableService = azure.createTableService(process.env['AZURE_STORAGE_CONNECTION_STRING']).withFilter(new azure.ExponentialRetryPolicyFilter());;
  if(useHttp){
    tableService.host.primaryHost = tableService.host.primaryHost.replace('https://', 'http://').replace(':443', ':80');
    tableService.host.secondaryHost = tableService.host.primaryHost.replace('https://', 'http://').replace(':443', ':80');
  }
  
  var token = azure.generateAccountSharedAccessSignature(process.env['AZURE_STORAGE_CONNECTION_STRING'], null, sharedAccessPolicy);
  var sharedTableService = azure.createTableServiceWithSas(tableService.host, token).withFilter(new azure.ExponentialRetryPolicyFilter());;
  var tablePrefix = 'tableservice';
  var tableName = suite.getName(tablePrefix).replace(/-/g,'');
  var entity1 = { PartitionKey: eg.String('part1'),
    RowKey: eg.String('row1'),
    field: eg.String('my field')
  };
  
  sharedTableService.createTable(tableName, function(error, result){
    if(error){
      next(error);
    } else {
      sharedTableService.insertEntity(tableName, entity1, function (error) {
        tableService.deleteTable(tableName, function () {
          next(error);
        });
      });
    }
  });
};

var runQueuesSanityTest = function(sharedAccessPolicy, next, useHttp){
  
  // Simply create an queue and create a message to make sure the queue service works fine with the provided account SAS
  
  var queueService = azure.createQueueService(process.env['AZURE_STORAGE_CONNECTION_STRING']).withFilter(new azure.ExponentialRetryPolicyFilter());;
  if(useHttp){
    queueService.host.primaryHost = queueService.host.primaryHost.replace('https://', 'http://').replace(':443', ':80');
    queueService.host.secondaryHost = queueService.host.primaryHost.replace('https://', 'http://').replace(':443', ':80');
  }
  
  var token = azure.generateAccountSharedAccessSignature(process.env['AZURE_STORAGE_CONNECTION_STRING'], null, sharedAccessPolicy);
  var sharedQueueService = azure.createQueueServiceWithSas(queueService.host, token).withFilter(new azure.ExponentialRetryPolicyFilter());;
  var queuePrefix = 'queueservice';
  var queueName = suite.getName(queuePrefix);
  
  sharedQueueService.createQueue(queueName, function(error){
    if(error){
      next(error);
    } else {
      sharedQueueService.createMessage(queueName, 'msg1', function(error){
        queueService.deleteQueue(queueName, function(){
          next(error);
        });
      });
    }
  });
};

var runFilesSanityTest = function(sharedAccessPolicy, next, useHttp){
  
  // Simply create an share and upload a file to make sure the queue service works fine with the provided account SAS
  
  var fileService = azure.createFileService(process.env['AZURE_STORAGE_CONNECTION_STRING']).withFilter(new azure.ExponentialRetryPolicyFilter());;
  
  if(useHttp){
    fileService.host.primaryHost = fileService.host.primaryHost.replace('https://', 'http://').replace(':443', ':80');
    fileService.host.secondaryHost = fileService.host.primaryHost.replace('https://', 'http://').replace(':443', ':80');
  }
  
  var token = azure.generateAccountSharedAccessSignature(process.env['AZURE_STORAGE_CONNECTION_STRING'], null, sharedAccessPolicy);  
  var sharedFileService = azure.createFileServiceWithSas(fileService.host, token).withFilter(new azure.ExponentialRetryPolicyFilter());;
  var sharePrefix = 'fileservice-testshare';
  var shareName = suite.getName(sharePrefix);
  
  //createFileFromText
  sharedFileService.createShare(shareName, function(error){
    if(error){
      next(error);
    } else {
      sharedFileService.createFileFromText(shareName, '', 'testfilename', 'testfiletext', function(error){
        fileService.deleteShare(shareName, function(){
          next(error);
        });
      });
    }
  });
};



var runAllTestsInParallel = function(allPolicies, cb){
  batch(allPolicies).parallel(4)
  .each(function(index, policy, next){
    runBlobsPermissionTests(policy, function(){
      runTablesPermissionTests(policy, function(){
        runQueuesPermissionTests(policy, function(){
          runFilesPermissionTests(policy, function(){
            next();
          })
        })
      })
    });
  })
  .end(function(){
    cb();
  });
};

var runAllSanityTestForServicesInSequence = function(allPolicies, cb){  
  if(allPolicies.length == 0){
    cb();
  } else{
    var policy = allPolicies[0];
    
    runBlobsSanityTest(policy, function(error){
      if(policy.AccessPolicy.Services.indexOf(AccountSasConstants.Services.BLOB) > -1){
        assert.equal(error, null);
      } else {
        assert.notEqual(error ,null, 'Operation should have failed without Blob access.');
      }
      
      runTablesSanityTest(policy, function(error){
        if(policy.AccessPolicy.Services.indexOf(AccountSasConstants.Services.TABLE) > -1){
          assert.equal(error, null);
        } else {
          assert.notEqual(error ,null, 'Operation should have failed without Table access.');
        }
        
        runQueuesSanityTest(policy, function(error){
          if(policy.AccessPolicy.Services.indexOf(AccountSasConstants.Services.QUEUE) > -1){
            assert.equal(error, null);
          } else {
            assert.notEqual(error ,null, 'Operation should have failed without Queue access.');
          }
          
          runFilesSanityTest(policy, function(error){
            if(policy.AccessPolicy.Services.indexOf(AccountSasConstants.Services.FILE) > -1){
              assert.equal(error, null);
            } else {
              assert.notEqual(error ,null, 'Operation should have failed without File access.');
            }
            allPolicies.splice(0, 1);
            runAllSanityTestForServicesInSequence(allPolicies, cb);
          })
        })
      })
    });
  }
};

var runAllSanityTestForStartAndExpiryInSequence = function(allPolicies, cb){
  
  if(allPolicies.length == 0){
    cb();
  } else {
    var policy = allPolicies[0];
    var now = new Date();
    var shouldPass = (policy.AccessPolicy.Start < now && policy.AccessPolicy.Expiry > now);
     
    runBlobsSanityTest(policy, function(error){
      if(shouldPass){
        assert.equal(error, null);
      } else {
        assert.notEqual(error ,null, '"Operation should have failed with invalid start/expiry times.');
      }
      
      runTablesSanityTest(policy, function(error){
        if(shouldPass){
          assert.equal(error, null);
        } else {
          assert.notEqual(error ,null, '"Operation should have failed with invalid start/expiry times.');
        }
        
        runQueuesSanityTest(policy, function(error){
          if(shouldPass){
            assert.equal(error, null);
          } else {
            assert.notEqual(error ,null, '"Operation should have failed with invalid start/expiry times.');
          }
          
          runFilesSanityTest(policy, function(error){
            if(shouldPass){
              assert.equal(error, null);
            } else {
              assert.notEqual(error ,null, '"Operation should have failed with invalid start/expiry times.');
            }
            
            allPolicies.splice(0, 1);
            runAllSanityTestForStartAndExpiryInSequence(allPolicies, cb);
          })
        })
      })
    });
  }
};


var runAllSanityTestForSignedIPInSequence = function(allPolicies, cb){
  if(allPolicies.length == 0){
    cb();
  } else {
    var policy = allPolicies[0];
    var now = new Date();
    var shouldPass = (policy.AccessPolicy.Start < now && policy.AccessPolicy.Expiry < now);
     
    runBlobsSanityTest(policy, function(error){
      if(shouldPass){
        assert.equal(error, null);
      } else {
        assert.notEqual(error ,null, '"Operation should have failed with invalid start/expiry times.');
      }
      
      runTablesSanityTest(policy, function(error){
        if(shouldPass){
          assert.equal(error, null);
        } else {
          assert.notEqual(error ,null, '"Operation should have failed with invalid start/expiry times.');
        }
        
        runQueuesSanityTest(policy, function(error){
          if(shouldPass){
            assert.equal(error, null);
          } else {
            assert.notEqual(error ,null, '"Operation should have failed with invalid start/expiry times.');
          }
          
          runFilesSanityTest(policy, function(error){
            if(shouldPass){
              assert.equal(error, null);
            } else {
              assert.notEqual(error ,null, '"Operation should have failed with invalid start/expiry times.');
            }
            
            allPolicies.splice(0, 1);
            runAllSanityTestForStartAndExpiryInSequence(allPolicies, cb);
          })
        })
      })
    });
  }
};

describe('azure', function () {
  before(function (done) {
    if (firstRun) {
      firstRun = false;

      // On the first run store the previous azure storage account / azure storage access key from the environment
      originalAzureStorageAccount = process.env[StorageServiceClientConstants.EnvironmentVariables.AZURE_STORAGE_ACCOUNT];
      originalAzureStorageAccessKey = process.env[StorageServiceClientConstants.EnvironmentVariables.AZURE_STORAGE_ACCESS_KEY];
      originalAzureStorageDnsSuffix = process.env[StorageServiceClientConstants.EnvironmentVariables.AZURE_STORAGE_DNS_SUFFIX];
      originalAzureStorageConnectionString = process.env[StorageServiceClientConstants.EnvironmentVariables.AZURE_STORAGE_CONNECTION_STRING];
      originalAzureStorageEmulated = process.env[StorageServiceClientConstants.EnvironmentVariables.EMULATED];
    }

    done();
  });

  after(function (done) {

    if (originalAzureStorageAccount) {
      process.env[StorageServiceClientConstants.EnvironmentVariables.AZURE_STORAGE_ACCOUNT] = originalAzureStorageAccount;
    } else {
      delete process.env[StorageServiceClientConstants.EnvironmentVariables.AZURE_STORAGE_ACCOUNT];
    }

    if (originalAzureStorageAccessKey) {
      process.env[StorageServiceClientConstants.EnvironmentVariables.AZURE_STORAGE_ACCESS_KEY] = originalAzureStorageAccessKey;
    } else {
      delete process.env[StorageServiceClientConstants.EnvironmentVariables.AZURE_STORAGE_ACCESS_KEY];
    }

    if (originalAzureStorageDnsSuffix) {
      process.env[StorageServiceClientConstants.EnvironmentVariables.AZURE_STORAGE_DNS_SUFFIX] = originalAzureStorageDnsSuffix;
    } else {
      delete process.env[StorageServiceClientConstants.EnvironmentVariables.AZURE_STORAGE_DNS_SUFFIX];
    }

    if (originalAzureStorageConnectionString) {
      process.env[StorageServiceClientConstants.EnvironmentVariables.AZURE_STORAGE_CONNECTION_STRING] = originalAzureStorageConnectionString;
    } else {
      delete process.env[StorageServiceClientConstants.EnvironmentVariables.AZURE_STORAGE_CONNECTION_STRING];
    }

    if (originalAzureStorageEmulated) {
      process.env[StorageServiceClientConstants.EnvironmentVariables.EMULATED] = originalAzureStorageEmulated;
    } else {
      delete process.env[StorageServiceClientConstants.EnvironmentVariables.EMULATED];
    }

    // clean up
    done();
  });
  
  describe('AccountSAS', function(){
    skipBrowser('generateAccountSharedAccessSignature should work fine with implicit credential', function(done){
      // Make sure is not emulated
      var connString = process.env[StorageServiceClientConstants.EnvironmentVariables.AZURE_STORAGE_CONNECTION_STRING];
      delete process.env[StorageServiceClientConstants.EnvironmentVariables.AZURE_STORAGE_CONNECTION_STRING];
      delete process.env[StorageServiceClientConstants.EnvironmentVariables.EMULATED];

      // set some environment credentials for the production azure services
      process.env[StorageServiceClientConstants.EnvironmentVariables.AZURE_STORAGE_ACCOUNT] = environmentAzureStorageAccount;
      process.env[StorageServiceClientConstants.EnvironmentVariables.AZURE_STORAGE_ACCESS_KEY] = environmentAzureStorageAccessKey;

      var sharedAccessPolicy = {
        AccessPolicy: {
          Services: AccountSasConstants.Services.BLOB,
          ResourceTypes: AccountSasConstants.Resources.SERVICE,
          Permissions: AccountSasConstants.Permissions.READ,
          Protocols: AccountSasConstants.Protocols.HTTPSONLY,
          IPAddressOrRange: '168.1.5.60-168.1.5.70',
          Start: new Date('February 16, 2016 12:00:00 am GMT'),
          Expiry: new Date('February 16, 2016 12:30:00 am GMT')
        }
      };
      var sharedAccessSignature = azure.generateAccountSharedAccessSignature(process.env['AZURE_STORAGE_CONNECTION_STRING'], null, sharedAccessPolicy);
      
      assert.notEqual(sharedAccessSignature, null);
      
      var sasQueryString = qs.parse(sharedAccessSignature);

      assert.equal(sasQueryString[QueryStringConstants.SIGNED_SERVICES], sharedAccessPolicy.AccessPolicy.Services);
      assert.equal(sasQueryString[QueryStringConstants.SIGNED_RESOURCE_TYPES], sharedAccessPolicy.AccessPolicy.ResourceTypes);
      assert.equal(sasQueryString[QueryStringConstants.SIGNED_PERMISSIONS], sharedAccessPolicy.AccessPolicy.Permissions);
      assert.equal(sasQueryString[QueryStringConstants.SIGNED_START], sharedAccessPolicy.AccessPolicy.Start);
      assert.equal(sasQueryString[QueryStringConstants.SIGNED_EXPIRY], sharedAccessPolicy.AccessPolicy.Expiry);
      assert.equal(sasQueryString[QueryStringConstants.SIGNED_PROTOCOL], sharedAccessPolicy.AccessPolicy.Protocols);
      assert.equal(sasQueryString[QueryStringConstants.SIGNED_IP], sharedAccessPolicy.AccessPolicy.IPAddressOrRange);
      assert.equal(sasQueryString[QueryStringConstants.SIGNED_VERSION], HeaderConstants.TARGET_STORAGE_VERSION);
      assert.equal(sasQueryString[QueryStringConstants.SIGNATURE], 'lStwwdDw7CQXid22g62QKxhh02hW/Iwn2+eSz904spU=');

      process.env[StorageServiceClientConstants.EnvironmentVariables.AZURE_STORAGE_CONNECTION_STRING] = connString;
      done();
    });
    
    it('generateAccountSharedAccessSignature should work fine with explicit credential', function(done){
      var sharedAccessPolicy = {
        AccessPolicy: {
          Services: AccountSasConstants.Services.BLOB,
          ResourceTypes: AccountSasConstants.Resources.SERVICE,
          Permissions: AccountSasConstants.Permissions.READ,
          Protocols: AccountSasConstants.Protocols.HTTPSONLY,
          IPAddressOrRange: '168.1.5.60-168.1.5.70',
          Start: new Date('February 16, 2016 12:00:00 am GMT'),
          Expiry: new Date('February 16, 2016 12:30:00 am GMT')
        }
      };
      var sharedAccessSignature = azure.generateAccountSharedAccessSignature(environmentAzureStorageAccount, environmentAzureStorageAccessKey, sharedAccessPolicy);
      
      assert.notEqual(sharedAccessSignature, null);
      
      var sasQueryString = qs.parse(sharedAccessSignature);

      assert.equal(sasQueryString[QueryStringConstants.SIGNED_SERVICES], sharedAccessPolicy.AccessPolicy.Services);
      assert.equal(sasQueryString[QueryStringConstants.SIGNED_RESOURCE_TYPES], sharedAccessPolicy.AccessPolicy.ResourceTypes);
      assert.equal(sasQueryString[QueryStringConstants.SIGNED_PERMISSIONS], sharedAccessPolicy.AccessPolicy.Permissions);
      assert.equal(sasQueryString[QueryStringConstants.SIGNED_START], sharedAccessPolicy.AccessPolicy.Start);
      assert.equal(sasQueryString[QueryStringConstants.SIGNED_EXPIRY], sharedAccessPolicy.AccessPolicy.Expiry);
      assert.equal(sasQueryString[QueryStringConstants.SIGNED_PROTOCOL], sharedAccessPolicy.AccessPolicy.Protocols);
      assert.equal(sasQueryString[QueryStringConstants.SIGNED_IP], sharedAccessPolicy.AccessPolicy.IPAddressOrRange);
      assert.equal(sasQueryString[QueryStringConstants.SIGNED_VERSION], HeaderConstants.TARGET_STORAGE_VERSION);
      assert.equal(sasQueryString[QueryStringConstants.SIGNATURE], 'lStwwdDw7CQXid22g62QKxhh02hW/Iwn2+eSz904spU=');
      
      done();
    });
    
    skipMockAndBrowser('Various combinations of permissions should work fine for account SAS', function(done){
      var policies = [];
      
      var allPossibleCombinationsOfPermissions = getAllPossibleFlagsStringEnum(AccountSasConstants.Permissions);
      allPossibleCombinationsOfPermissions.forEach(function(permission){
        var policy = getPolicyWithFullPermissions();
        policy.AccessPolicy.Permissions = permission;
        policies.push(policy);
      });
      
      runAllTestsInParallel(policies, done);
    });
    
    skipMockAndBrowser('Various combinations of resource types should work fine for account SAS', function(done){
      var policies = [];
      var allPossibleCombinationsOfResourceTypes = getAllPossibleFlagsStringEnum(AccountSasConstants.Resources);

      allPossibleCombinationsOfResourceTypes.forEach(function(resourceType){
        var policy = getPolicyWithFullPermissions();
        policy.AccessPolicy.ResourceTypes = resourceType;
        policies.push(policy);
      });
      runAllTestsInParallel(policies, done);
    });
    
    runOrSkip('Various combinations of services should work fine for account SAS', function(done){
      var policies = [];
      var allPossibleCombinationsOfServices = getAllPossibleFlagsStringEnum(AccountSasConstants.Services);
      
      allPossibleCombinationsOfServices.forEach(function(service){
        var policy = getPolicyWithFullPermissions();
        policy.AccessPolicy.Services = service;
        policies.push(policy);
      });
      
      runAllSanityTestForServicesInSequence(policies, function(){
        done();
      });
    });

    runOrSkip('Start and expiry time should work fine for account SAS', function(done){
      var startOffsetsInMinutes = [-1, -5, 5];
      var expiryOffsetsInMinutes = [-5, 5];
      
      var policies = [];
      startOffsetsInMinutes.forEach(function(startOffset){
        expiryOffsetsInMinutes.forEach(function(expiryOffset){
          var startDate = new Date();
          startDate.setTime(startDate.getTime() + startOffset * 60 * 1000);
          var expiryDate = new Date();
          expiryDate.setTime(expiryDate.getTime() + expiryOffset * 60 * 1000);
          
          var policy = getPolicyWithFullPermissions();
          policy.AccessPolicy.Start = startDate;
          policy.AccessPolicy.Expiry = expiryDate;
          policies.push(policy);
        });
      });
      
      runAllSanityTestForStartAndExpiryInSequence(policies, function(){
        done();
      });
    });
    
    runOrSkip('Signed IPs should work fine for account SAS', function(done){
      // Only test the negative case here as positive cases are covered above
      
      var policy = getPolicyWithFullPermissions();
      //Invalid IP
      policy.AccessPolicy.IPAddressOrRange = '255.255.255.255';
      
      runBlobsSanityTest(policy, function(error){
        assert.notEqual(error ,null, 'Operation should have failed with invalid IP.');
      
        runTablesSanityTest(policy, function(error){
          assert.notEqual(error ,null, 'Operation should have failed with invalid IP.');
        
          runQueuesSanityTest(policy, function(error){
            assert.notEqual(error ,null, 'Operation should have failed with invalid IP.');
          
            runFilesSanityTest(policy, function(error){
              assert.notEqual(error ,null, 'Operation should have failed with invalid IP.');
              done();
            })
          })
        })
      });
    });
    
    runOrSkip('Signed protocols should work fine for account SAS', function(done){
      // Only test the negative case here as positive cases are covered above
      var policy = getPolicyWithFullPermissions();
      
      //Https only
      policy.AccessPolicy.Protocols = AccountSasConstants.Protocols.HTTPSONLY;
      
      runBlobsSanityTest(policy, function(error){
        assert.notEqual(error ,null, 'Operation should have failed without using Https.');
      
        runTablesSanityTest(policy, function(error){
          assert.notEqual(error ,null, 'Operation should have failed without using Https.');
        
          runQueuesSanityTest(policy, function(error){
            assert.notEqual(error ,null, 'Operation should have failed without using Https.');
          
            runFilesSanityTest(policy, function(error){
              assert.notEqual(error ,null, 'Operation should have failed without using Https.');
              done();
            }, true)
          }, true)
        }, true)
      }, true);
    });
  });
});