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

var should = require('should');
var assert = require('assert');
var url = require('url');

var testutil = require('../framework/util');
var azure = testutil.libRequire('azure-storage');
var Constants = azure.Constants;
var StorageServiceClientConstants = Constants.StorageServiceClientConstants;
var ConnectionStringKeys = Constants.ConnectionStringKeys;
var StorageServiceSettings = testutil.libRequire('common/services/storageservicesettings');

describe('StorageServiceSettingsTests', function(done) {

  it('testSetHostExplicitly', function(done) {
    var blobServiceUsingExplicitHost = azure.createBlobService('DefaultEndpointsProtocol=http;AccountName=xyz;AccountKey=abc=');
    blobServiceUsingExplicitHost.setHost({
        primaryHost: 'xyz.custom.com',
        secondaryHost: 'abc.custom.com'
    });

    assert.equal(blobServiceUsingExplicitHost.storageAccount, 'xyz');
    assert.equal(blobServiceUsingExplicitHost.host.primaryHost, 'https://xyz.custom.com:443');
    assert.equal(blobServiceUsingExplicitHost.host.secondaryHost, 'https://abc.custom.com:443');
    done();
  });

  it('testCreateDirectly', function(done) {
    var host = {
        primaryHost: 'xyz.custom.com',
        secondaryHost: 'abc.custom.com'
    }
    var blobServiceUsingExplicitHost = azure.createBlobService('xyz','abc=', host);

    assert.equal(blobServiceUsingExplicitHost.storageAccount, 'xyz');
    assert.equal(blobServiceUsingExplicitHost.host.primaryHost, 'https://xyz.custom.com:443');
    assert.equal(blobServiceUsingExplicitHost.host.secondaryHost, 'https://abc.custom.com:443');
    done();
  });

  it('testCreateDirectlySecondaryOnly', function(done) {
    var host = {
        secondaryHost: 'abc.custom.com'
    }
    var blobServiceUsingExplicitHost = azure.createBlobService('xyz','abc=', host);

    assert.equal(blobServiceUsingExplicitHost.storageAccount, 'xyz');
    assert.equal(blobServiceUsingExplicitHost.host.primaryHost, undefined);
    assert.equal(blobServiceUsingExplicitHost.host.secondaryHost, 'https://abc.custom.com:443');
    done();
  });

  it('testCreateDirectlyWithPrimaryString', function(done) {
    var blobServiceUsingExplicitHost = azure.createBlobService('xyz','abc=', 'xyz.custom.com');

    assert.equal(blobServiceUsingExplicitHost.storageAccount, 'xyz');
    assert.equal(blobServiceUsingExplicitHost.host.primaryHost, 'https://xyz.custom.com:443');
    assert.equal(blobServiceUsingExplicitHost.host.secondaryHost, undefined);
    done();
  });

  it('testCreateWithBadHost', function(done) {
    assert.throws(
      function () {var blobServiceUsingExplicitHost = azure.createBlobService('xyz','abc=', {});}, 
      function (err) {return err.message === 'The host for the storage service must be specified.';}
    );

    var blobServiceUsingExplicitHost = azure.createBlobService('DefaultEndpointsProtocol=http;AccountName=xyz;AccountKey=abc=');
    assert.throws(
      function () {blobServiceUsingExplicitHost.setHost(null);}, 
      function (err) {return err.message === 'The host for the storage service must be specified.';}
    );
    assert.throws(
      function () {blobServiceUsingExplicitHost.setHost({});}, 
      function (err) {return err.message === 'The host for the storage service must be specified.';}
    );
    assert.throws(
      function () {blobServiceUsingExplicitHost.setHost('xyz');}, 
      function (err) {return err.message === 'The provided URI "xyz" is invalid.';}
    );

    done();
  });

  it('testCreateFromConnectionStringWithUseDevStore', function(done) {
    // Setup
    var connectionString = 'UseDevelopmentStorage=true';
    var expectedName = StorageServiceClientConstants.DEVSTORE_STORAGE_ACCOUNT;
    var expectedKey = StorageServiceClientConstants.DEVSTORE_STORAGE_ACCESS_KEY;
    var expectedBlobEndpoint = StorageServiceClientConstants.DEV_STORE_URI + ':10000/' + StorageServiceClientConstants.DEVSTORE_STORAGE_ACCOUNT;
    var expectedQueueEndpoint = StorageServiceClientConstants.DEV_STORE_URI + ':10001/' + StorageServiceClientConstants.DEVSTORE_STORAGE_ACCOUNT;
    var expectedTableEndpoint = StorageServiceClientConstants.DEV_STORE_URI + ':10002/' + StorageServiceClientConstants.DEVSTORE_STORAGE_ACCOUNT;
    var expectedBlobSecondaryEndpoint = StorageServiceClientConstants.DEV_STORE_URI + ':10000/' + StorageServiceClientConstants.DEVSTORE_STORAGE_ACCOUNT + '-secondary';
    var expectedQueueSecondaryEndpoint = StorageServiceClientConstants.DEV_STORE_URI + ':10001/' + StorageServiceClientConstants.DEVSTORE_STORAGE_ACCOUNT + '-secondary';
    var expectedTableSecondaryEndpoint = StorageServiceClientConstants.DEV_STORE_URI + ':10002/' + StorageServiceClientConstants.DEVSTORE_STORAGE_ACCOUNT + '-secondary';
    var expectedUsePathStyleUri = true;

    // Test
    var actual = StorageServiceSettings.createFromConnectionString(connectionString);

    // Assert
    assert.strictEqual(actual._name, expectedName);
    assert.strictEqual(actual._key, expectedKey);
    assert.strictEqual(actual._blobEndpoint.primaryHost, expectedBlobEndpoint);
    assert.strictEqual(actual._queueEndpoint.primaryHost, expectedQueueEndpoint);
    assert.strictEqual(actual._tableEndpoint.primaryHost, expectedTableEndpoint);
    assert.strictEqual(actual._blobEndpoint.secondaryHost, expectedBlobSecondaryEndpoint);
    assert.strictEqual(actual._queueEndpoint.secondaryHost, expectedQueueSecondaryEndpoint);
    assert.strictEqual(actual._tableEndpoint.secondaryHost, expectedTableSecondaryEndpoint);
    assert.strictEqual(actual._usePathStyleUri, expectedUsePathStyleUri);
    done();
  });

  it('testCreateFromConnectionStringWithUseDevStoreUri', function(done) {
    // Setup
    var myProxyUri = 'http://222.3.5.6';
    var connectionString = 'DevelopmentStorageProxyUri=' + myProxyUri + ';UseDevelopmentStorage=true';
    var expectedName = StorageServiceClientConstants.DEVSTORE_STORAGE_ACCOUNT;
    var expectedKey = StorageServiceClientConstants.DEVSTORE_STORAGE_ACCESS_KEY;
    var expectedBlobEndpoint = myProxyUri + ':10000/' + StorageServiceClientConstants.DEVSTORE_STORAGE_ACCOUNT;
    var expectedQueueEndpoint = myProxyUri + ':10001/' + StorageServiceClientConstants.DEVSTORE_STORAGE_ACCOUNT;
    var expectedTableEndpoint = myProxyUri + ':10002/' + StorageServiceClientConstants.DEVSTORE_STORAGE_ACCOUNT;
    var expectedBlobSecondaryEndpoint = myProxyUri + ':10000/' + StorageServiceClientConstants.DEVSTORE_STORAGE_ACCOUNT + '-secondary';
    var expectedQueueSecondaryEndpoint = myProxyUri + ':10001/' + StorageServiceClientConstants.DEVSTORE_STORAGE_ACCOUNT + '-secondary';
    var expectedTableSecondaryEndpoint = myProxyUri + ':10002/' + StorageServiceClientConstants.DEVSTORE_STORAGE_ACCOUNT + '-secondary';
    var expectedUsePathStyleUri = true;

    // Test
    var actual = StorageServiceSettings.createFromConnectionString(connectionString);

    // Assert
    assert.strictEqual(actual._name, expectedName);
    assert.strictEqual(actual._key, expectedKey);
    assert.strictEqual(actual._blobEndpoint.primaryHost, expectedBlobEndpoint);
    assert.strictEqual(actual._queueEndpoint.primaryHost, expectedQueueEndpoint);
    assert.strictEqual(actual._tableEndpoint.primaryHost, expectedTableEndpoint);
    assert.strictEqual(actual._blobEndpoint.secondaryHost, expectedBlobSecondaryEndpoint);
    assert.strictEqual(actual._queueEndpoint.secondaryHost, expectedQueueSecondaryEndpoint);
    assert.strictEqual(actual._tableEndpoint.secondaryHost, expectedTableSecondaryEndpoint);
    assert.strictEqual(actual._usePathStyleUri, expectedUsePathStyleUri);
    done();
  });

  it('testCreateFromConnectionStringWithInvalidUseDevStoreFail', function(done) {
    // Setup
    var invalidValue = 'invalid_value';
    var connectionString = 'UseDevelopmentStorage=' + invalidValue;

    // Test
    (function() {
      StorageServiceSettings.createFromConnectionString(connectionString);
    }).should.throw('The provided config value ' + invalidValue + ' does not belong to the valid values subset:\n[true]');
    done();
  });

  it('testCreateFromConnectionStringWithEmptyConnectionStringFail', function(done) {
    // Setup
    var connectionString = '';

    // Test
    (function() {
      StorageServiceSettings.createFromConnectionString(connectionString);
    }).should.throw('The provided connection string "" does not have complete configuration settings.');
    done();
  });

  it('testCreateFromConnectionStringWithAutomaticNoDefaultProtocol', function(done) {
    var expectedName = 'mytestaccount';
    var expectedKey = 'AhlzsbLRkjfwObuqff3xrhB2yWJNh1EMptmcmxFJ6fvPTVX3PZXwrG2YtYWf5DPMVgNsteKStM5iBLlknYFVoA==';
    var connectionString  = 'AccountName=' + expectedName + ';AccountKey=' + expectedKey;
    
    // Test
    (function() {
      azure.createBlobService(connectionString);
    }).should.throw('The provided connection string "' + connectionString + '" does not have complete configuration settings.');

    done();
  });

  it('testCreateFromConnectionStringWithAutomatic', function(done) {
    // Setup
    var protocol = 'https';
    var expectedName = 'mytestaccount';
    var expectedKey = 'AhlzsbLRkjfwObuqff3xrhB2yWJNh1EMptmcmxFJ6fvPTVX3PZXwrG2YtYWf5DPMVgNsteKStM5iBLlknYFVoA==';
    var connectionString  = 'DefaultEndpointsProtocol=' + protocol + ';AccountName=' + expectedName + ';AccountKey=' + expectedKey;
    var expectedBlobEndpoint = url.format({ protocol: protocol, host: expectedName + '.' + ConnectionStringKeys.BLOB_BASE_DNS_NAME });
    var expectedQueueEndpoint = url.format({ protocol: protocol, host: expectedName + '.' + ConnectionStringKeys.QUEUE_BASE_DNS_NAME });
    var expectedTableEndpoint = url.format({ protocol: protocol, host: expectedName + '.' + ConnectionStringKeys.TABLE_BASE_DNS_NAME });
    var expectedBlobSecondaryEndpoint = url.format({ protocol: protocol, host: expectedName + '-secondary.' + ConnectionStringKeys.BLOB_BASE_DNS_NAME });
    var expectedQueueSecondaryEndpoint = url.format({ protocol: protocol, host: expectedName + '-secondary.' + ConnectionStringKeys.QUEUE_BASE_DNS_NAME });
    var expectedTableSecondaryEndpoint = url.format({ protocol: protocol, host: expectedName + '-secondary.' + ConnectionStringKeys.TABLE_BASE_DNS_NAME });

    // Test
    var actual = StorageServiceSettings.createFromConnectionString(connectionString);

    // Assert
    assert.strictEqual(actual._name, expectedName);
    assert.strictEqual(actual._key, expectedKey);
    assert.strictEqual(actual._blobEndpoint.primaryHost, expectedBlobEndpoint);
    assert.strictEqual(actual._queueEndpoint.primaryHost, expectedQueueEndpoint);
    assert.strictEqual(actual._tableEndpoint.primaryHost, expectedTableEndpoint);
    assert.strictEqual(actual._blobEndpoint.secondaryHost, expectedBlobSecondaryEndpoint);
    assert.strictEqual(actual._queueEndpoint.secondaryHost, expectedQueueSecondaryEndpoint);
    assert.strictEqual(actual._tableEndpoint.secondaryHost, expectedTableSecondaryEndpoint);
    assert.strictEqual(actual._usePathStyleUri, false);
    done();
  });

  it('testCreateFromConnectionStringWithTableEndpointSpecifiedNoProtocol', function(done) {
    var expectedName = 'mytestaccount';
    var expectedKey = 'AhlzsbLRkjfwObuqff3xrhB2yWJNh1EMptmcmxFJ6fvPTVX3PZXwrG2YtYWf5DPMVgNsteKStM5iBLlknYFVoA==';
    var expectedTableEndpoint = 'http://myprivatedns.com';
    var connectionString  = 'AccountName=' + expectedName + ';AccountKey=' + expectedKey + ';TableEndpoint=' + expectedTableEndpoint;
    var actual =  StorageServiceSettings.createFromConnectionString(connectionString);

    // Assert
    assert.strictEqual(actual._name, expectedName);
    assert.strictEqual(actual._key, expectedKey);
    assert.equal(actual._blobEndpoint, null);
    assert.equal(actual._queueEndpoint, null);
    assert.equal(actual._tableEndpoint.secondaryHost, null);
    assert.equal(actual._tableEndpoint.primaryHost, expectedTableEndpoint);
    done();
  });

  it('testCreateFromConnectionStringWithTableEndpointSpecified', function(done) {
    // Setup
    var protocol = 'https';
    var expectedName = 'mytestaccount';
    var expectedKey = 'AhlzsbLRkjfwObuqff3xrhB2yWJNh1EMptmcmxFJ6fvPTVX3PZXwrG2YtYWf5DPMVgNsteKStM5iBLlknYFVoA==';
    var expectedTableEndpoint = 'http://myprivatedns.com';
    var expectedBlobEndpoint = url.format({ protocol: protocol, host: expectedName + '.' + ConnectionStringKeys.BLOB_BASE_DNS_NAME });
    var expectedQueueEndpoint = url.format({ protocol: protocol, host: expectedName + '.' + ConnectionStringKeys.QUEUE_BASE_DNS_NAME });
    var expectedTableSecondaryEndpoint = url.format({ protocol: protocol, host: expectedName + '-secondary.' + ConnectionStringKeys.TABLE_BASE_DNS_NAME });
    var expectedBlobSecondaryEndpoint = url.format({ protocol: protocol, host: expectedName + '-secondary.' + ConnectionStringKeys.BLOB_BASE_DNS_NAME });
    var expectedQueueSecondaryEndpoint = url.format({ protocol: protocol, host: expectedName + '-secondary.' + ConnectionStringKeys.QUEUE_BASE_DNS_NAME });
    var connectionString  = 'DefaultEndpointsProtocol=' + protocol + ';AccountName=' + expectedName + ';AccountKey=' + expectedKey + ';TableEndpoint=' + expectedTableEndpoint;

    // Test
    var actual = StorageServiceSettings.createFromConnectionString(connectionString);

    // Assert
    actual._name.should.equal(expectedName);
    actual._key.should.equal(expectedKey);
    assert.strictEqual(actual._name, expectedName);
    assert.strictEqual(actual._key, expectedKey);
    assert.strictEqual(actual._blobEndpoint.primaryHost, expectedBlobEndpoint);
    assert.strictEqual(actual._queueEndpoint.primaryHost, expectedQueueEndpoint);
    assert.strictEqual(actual._tableEndpoint.primaryHost, expectedTableEndpoint);
    assert.strictEqual(actual._blobEndpoint.secondaryHost, expectedBlobSecondaryEndpoint);
    assert.strictEqual(actual._queueEndpoint.secondaryHost, expectedQueueSecondaryEndpoint);
    assert.strictEqual(actual._tableEndpoint.secondaryHost, expectedTableSecondaryEndpoint);
    assert.strictEqual(actual._usePathStyleUri, false);
    done();
  });

  it('testCreateFromConnectionStringWithBlobEndpointSpecified', function(done) {
    // Setup
    var protocol = 'https';
    var expectedName = 'mytestaccount';
    var expectedKey = 'AhlzsbLRkjfwObuqff3xrhB2yWJNh1EMptmcmxFJ6fvPTVX3PZXwrG2YtYWf5DPMVgNsteKStM5iBLlknYFVoA==';
    var expectedTableEndpoint = url.format({ protocol: protocol, host: expectedName + '.' + ConnectionStringKeys.TABLE_BASE_DNS_NAME });
    var expectedBlobEndpoint = 'http://myprivatedns.com';
    var expectedQueueEndpoint = url.format({ protocol: protocol, host: expectedName + '.' + ConnectionStringKeys.QUEUE_BASE_DNS_NAME });
    var expectedTableSecondaryEndpoint = url.format({ protocol: protocol, host: expectedName + '-secondary.' + ConnectionStringKeys.TABLE_BASE_DNS_NAME });
    var expectedBlobSecondaryEndpoint = url.format({ protocol: protocol, host: expectedName + '-secondary.' + ConnectionStringKeys.BLOB_BASE_DNS_NAME });
    var expectedQueueSecondaryEndpoint = url.format({ protocol: protocol, host: expectedName + '-secondary.' + ConnectionStringKeys.QUEUE_BASE_DNS_NAME });
    var connectionString  = 'DefaultEndpointsProtocol=' + protocol + ';AccountName=' + expectedName + ';AccountKey=' + expectedKey + ';BlobEndpoint=' + expectedBlobEndpoint;

    // Test
    var actual = StorageServiceSettings.createFromConnectionString(connectionString);

    // Assert
    assert.strictEqual(actual._name, expectedName);
    assert.strictEqual(actual._key, expectedKey);
    assert.strictEqual(actual._blobEndpoint.primaryHost, expectedBlobEndpoint);
    assert.strictEqual(actual._queueEndpoint.primaryHost, expectedQueueEndpoint);
    assert.strictEqual(actual._tableEndpoint.primaryHost, expectedTableEndpoint);
    assert.strictEqual(actual._blobEndpoint.secondaryHost, expectedBlobSecondaryEndpoint);
    assert.strictEqual(actual._queueEndpoint.secondaryHost, expectedQueueSecondaryEndpoint);
    assert.strictEqual(actual._tableEndpoint.secondaryHost, expectedTableSecondaryEndpoint);
    assert.strictEqual(actual._usePathStyleUri, false);
    done();
  });

  it('testCreateFromConnectionStringWithQueueEndpointSpecified', function(done) {
    // Setup
    var protocol = 'https';
    var expectedName = 'mytestaccount';
    var expectedKey = 'AhlzsbLRkjfwObuqff3xrhB2yWJNh1EMptmcmxFJ6fvPTVX3PZXwrG2YtYWf5DPMVgNsteKStM5iBLlknYFVoA==';
    var expectedTableEndpoint = url.format({ protocol: protocol, host: expectedName + '.' + ConnectionStringKeys.TABLE_BASE_DNS_NAME });
    var expectedBlobEndpoint = url.format({ protocol: protocol, host: expectedName + '.' + ConnectionStringKeys.BLOB_BASE_DNS_NAME });
    var expectedQueueEndpoint = 'http://myprivatedns.com';
    var expectedTableSecondaryEndpoint = url.format({ protocol: protocol, host: expectedName + '-secondary.' + ConnectionStringKeys.TABLE_BASE_DNS_NAME });
    var expectedBlobSecondaryEndpoint = url.format({ protocol: protocol, host: expectedName + '-secondary.' + ConnectionStringKeys.BLOB_BASE_DNS_NAME });
    var expectedQueueSecondaryEndpoint = url.format({ protocol: protocol, host: expectedName + '-secondary.' + ConnectionStringKeys.QUEUE_BASE_DNS_NAME });
    var connectionString  = 'DefaultEndpointsProtocol=' + protocol + ';AccountName=' + expectedName + ';AccountKey=' + expectedKey + ';QueueEndpoint=' + expectedQueueEndpoint;

    // Test
    var actual = StorageServiceSettings.createFromConnectionString(connectionString);

    // Assert
    assert.strictEqual(actual._name, expectedName);
    assert.strictEqual(actual._key, expectedKey);
    assert.strictEqual(actual._blobEndpoint.primaryHost, expectedBlobEndpoint);
    assert.strictEqual(actual._queueEndpoint.primaryHost, expectedQueueEndpoint);
    assert.strictEqual(actual._tableEndpoint.primaryHost, expectedTableEndpoint);
    assert.strictEqual(actual._blobEndpoint.secondaryHost, expectedBlobSecondaryEndpoint);
    assert.strictEqual(actual._queueEndpoint.secondaryHost, expectedQueueSecondaryEndpoint);
    assert.strictEqual(actual._tableEndpoint.secondaryHost, expectedTableSecondaryEndpoint);
    assert.strictEqual(actual._usePathStyleUri, false);
    done();
  });

  it('testCreateFromConnectionStringWithQueueAndBlobEndpointSpecified', function(done) {
    // Setup
    var protocol = 'https';
    var expectedName = 'mytestaccount';
    var expectedKey = 'AhlzsbLRkjfwObuqff3xrhB2yWJNh1EMptmcmxFJ6fvPTVX3PZXwrG2YtYWf5DPMVgNsteKStM5iBLlknYFVoA==';
    var expectedTableEndpoint = url.format({ protocol: protocol, host: expectedName + '.' + ConnectionStringKeys.TABLE_BASE_DNS_NAME });
    var expectedBlobEndpoint = 'http://myprivateblobdns.com';
    var expectedQueueEndpoint = 'http://myprivatequeuedns.com';
    var expectedTableSecondaryEndpoint = url.format({ protocol: protocol, host: expectedName + '-secondary.' + ConnectionStringKeys.TABLE_BASE_DNS_NAME });
    var expectedBlobSecondaryEndpoint = url.format({ protocol: protocol, host: expectedName + '-secondary.' + ConnectionStringKeys.BLOB_BASE_DNS_NAME });
    var expectedQueueSecondaryEndpoint = url.format({ protocol: protocol, host: expectedName + '-secondary.' + ConnectionStringKeys.QUEUE_BASE_DNS_NAME });
    var connectionString  = 'DefaultEndpointsProtocol=' + protocol + ';AccountName=' + expectedName + ';AccountKey=' + expectedKey + ';QueueEndpoint=' + expectedQueueEndpoint + ';BlobEndpoint=' + expectedBlobEndpoint;

    // Test
    var actual = StorageServiceSettings.createFromConnectionString(connectionString);

    // Assert
    assert.strictEqual(actual._name, expectedName);
    assert.strictEqual(actual._key, expectedKey);
    assert.strictEqual(actual._blobEndpoint.primaryHost, expectedBlobEndpoint);
    assert.strictEqual(actual._queueEndpoint.primaryHost, expectedQueueEndpoint);
    assert.strictEqual(actual._tableEndpoint.primaryHost, expectedTableEndpoint);
    assert.strictEqual(actual._blobEndpoint.secondaryHost, expectedBlobSecondaryEndpoint);
    assert.strictEqual(actual._queueEndpoint.secondaryHost, expectedQueueSecondaryEndpoint);
    assert.strictEqual(actual._tableEndpoint.secondaryHost, expectedTableSecondaryEndpoint);
    assert.strictEqual(actual._usePathStyleUri, false);
    done();
  });

  it('testCreateFromConnectionStringWithAutomaticMissingProtocolFail', function(done) {
    // Setup
    var expectedName = 'mytestaccount';
    var expectedKey = 'AhlzsbLRkjfwObuqff3xrhB2yWJNh1EMptmcmxFJ6fvPTVX3PZXwrG2YtYWf5DPMVgNsteKStM5iBLlknYFVoA==';
    var connectionString  = 'AccountName=' + expectedName + ';AccountKey=' + expectedKey;

    // Test
    (function() {
      StorageServiceSettings.createFromConnectionString(connectionString);
    }).should.throw('The provided connection string "' + connectionString + '" does not have complete configuration settings.');
    done();
  });

  it('testCreateFromConnectionStringWithAutomaticMissingAccountNameFail', function(done) {
    // Setup
    var expectedKey = 'AhlzsbLRkjfwObuqff3xrhB2yWJNh1EMptmcmxFJ6fvPTVX3PZXwrG2YtYWf5DPMVgNsteKStM5iBLlknYFVoA==';
    var connectionString  = 'DefaultEndpointsProtocol=http;AccountKey=' + expectedKey;

    // Test
    (function() {
      StorageServiceSettings.createFromConnectionString(connectionString);
    }).should.throw('The provided connection string "' + connectionString + '" does not have complete configuration settings.');
    done();
  });

  it('testCreateFromConnectionStringWithAutomaticCorruptedAccountKeyFail', function(done) {
    // Setup
    var expectedName = 'mytestaccount';
    var invalidKey = '__A&*INVALID-@Key';
    var connectionString  = 'DefaultEndpointsProtocol=http;AccountName=' + expectedName + ';AccountKey=' + invalidKey;

    // Test
    (function() {
      StorageServiceSettings.createFromConnectionString(connectionString);
    }).should.throw('The provided account key ' + invalidKey + ' is not a valid base64 string.');
    done();
  });

  it('testCreateFromConnectionStringWithQueueAndBlobAndTableEndpointSpecfied', function(done) {
    // Setup
    var protocol = 'https';
    var expectedName = 'mytestaccount';
    var expectedKey = 'AhlzsbLRkjfwObuqff3xrhB2yWJNh1EMptmcmxFJ6fvPTVX3PZXwrG2YtYWf5DPMVgNsteKStM5iBLlknYFVoA==';
    var expectedTableEndpoint = 'http://myprivatetabledns.com';
    var expectedBlobEndpoint = 'http://myprivateblobdns.com';
    var expectedQueueEndpoint = 'http://myprivatequeuedns.com';
    var expectedTableSecondaryEndpoint = url.format({ protocol: protocol, host: expectedName + '-secondary.' + ConnectionStringKeys.TABLE_BASE_DNS_NAME });
    var expectedBlobSecondaryEndpoint = url.format({ protocol: protocol, host: expectedName + '-secondary.' + ConnectionStringKeys.BLOB_BASE_DNS_NAME });
    var expectedQueueSecondaryEndpoint = url.format({ protocol: protocol, host: expectedName + '-secondary.' + ConnectionStringKeys.QUEUE_BASE_DNS_NAME });
    var connectionString  = 'DefaultEndpointsProtocol=' + protocol + ';AccountName=' + expectedName + ';AccountKey=' + expectedKey + ';QueueEndpoint=' + expectedQueueEndpoint + ';BlobEndpoint=' + expectedBlobEndpoint+ ';TableEndpoint=' + expectedTableEndpoint;

    // Test
    var actual = StorageServiceSettings.createFromConnectionString(connectionString);

    // Assert
    assert.strictEqual(actual._name, expectedName);
    assert.strictEqual(actual._key, expectedKey);
    assert.strictEqual(actual._blobEndpoint.primaryHost, expectedBlobEndpoint);
    assert.strictEqual(actual._queueEndpoint.primaryHost, expectedQueueEndpoint);
    assert.strictEqual(actual._tableEndpoint.primaryHost, expectedTableEndpoint);
    assert.strictEqual(actual._blobEndpoint.secondaryHost, expectedBlobSecondaryEndpoint);
    assert.strictEqual(actual._queueEndpoint.secondaryHost, expectedQueueSecondaryEndpoint);
    assert.strictEqual(actual._tableEndpoint.secondaryHost, expectedTableSecondaryEndpoint);
    assert.strictEqual(actual._usePathStyleUri, false);
    done();
  });

  it('testCreateFromConnectionStringMissingServicesEndpointsFail', function(done) {
    // Setup
    var expectedName = 'mytestaccount';
    var expectedKey = 'AhlzsbLRkjfwObuqff3xrhB2yWJNh1EMptmcmxFJ6fvPTVX3PZXwrG2YtYWf5DPMVgNsteKStM5iBLlknYFVoA==';
    var invalidUri = 'https://www.invalid_domain';
    var connectionString  = 'BlobEndpoint=' + invalidUri + ';DefaultEndpointsProtocol=http;AccountName=' + expectedName + ';AccountKey=' + expectedKey;

    // Test
    (function() {
      StorageServiceSettings.createFromConnectionString(connectionString);
    }).should.throw('The provided URI "' + invalidUri + '" is invalid.');
    done();
  });

  it('testCreateFromConnectionStringWithInvalidSettingKeyFail', function(done) {
    // Setup
    var expectedName = 'mytestaccount';
    var expectedKey = 'AhlzsbLRkjfwObuqff3xrhB2yWJNh1EMptmcmxFJ6fvPTVX3PZXwrG2YtYWf5DPMVgNsteKStM5iBLlknYFVoA==';
    var invalidKey = 'InvalidKey';
    var connectionString  = 'DefaultEndpointsProtocol=http;' + invalidKey + '=MyValue;AccountName=' + expectedName + ';AccountKey=' + expectedKey;

    // Test
    (function() {
      StorageServiceSettings.createFromConnectionString(connectionString);
    }).should.throw('Connection string contains unrecognized key: "' + invalidKey + '"');
    done();
  });

  it('testCreateFromConnectionStringWithCaseInsensitive', function(done) {
    // Setup
    var protocol = 'https';
    var expectedName = 'mytestaccount';
    var expectedKey = 'AhlzsbLRkjfwObuqff3xrhB2yWJNh1EMptmcmxFJ6fvPTVX3PZXwrG2YtYWf5DPMVgNsteKStM5iBLlknYFVoA==';
    var connectionString  = 'defaultendpointsprotocol=' + protocol + ';accountname=' + expectedName + ';accountkey=' + expectedKey;
    var expectedBlobEndpoint = url.format({ protocol: protocol, host: expectedName + '.' + ConnectionStringKeys.BLOB_BASE_DNS_NAME });
    var expectedQueueEndpoint = url.format({ protocol: protocol, host: expectedName + '.' + ConnectionStringKeys.QUEUE_BASE_DNS_NAME });
    var expectedTableEndpoint = url.format({ protocol: protocol, host: expectedName + '.' + ConnectionStringKeys.TABLE_BASE_DNS_NAME });
    var expectedTableSecondaryEndpoint = url.format({ protocol: protocol, host: expectedName + '-secondary.' + ConnectionStringKeys.TABLE_BASE_DNS_NAME });
    var expectedBlobSecondaryEndpoint = url.format({ protocol: protocol, host: expectedName + '-secondary.' + ConnectionStringKeys.BLOB_BASE_DNS_NAME });
    var expectedQueueSecondaryEndpoint = url.format({ protocol: protocol, host: expectedName + '-secondary.' + ConnectionStringKeys.QUEUE_BASE_DNS_NAME });

    // Test
    var actual = StorageServiceSettings.createFromConnectionString(connectionString);

    // Assert
    assert.strictEqual(actual._name, expectedName);
    assert.strictEqual(actual._key, expectedKey);
    assert.strictEqual(actual._blobEndpoint.primaryHost, expectedBlobEndpoint);
    assert.strictEqual(actual._queueEndpoint.primaryHost, expectedQueueEndpoint);
    assert.strictEqual(actual._tableEndpoint.primaryHost, expectedTableEndpoint);
    assert.strictEqual(actual._blobEndpoint.secondaryHost, expectedBlobSecondaryEndpoint);
    assert.strictEqual(actual._queueEndpoint.secondaryHost, expectedQueueSecondaryEndpoint);
    assert.strictEqual(actual._tableEndpoint.secondaryHost, expectedTableSecondaryEndpoint);
    assert.strictEqual(actual._usePathStyleUri, false);
    done();
  });

  it('getDevelopmentStorageAccount', function(done) {
    var actual = StorageServiceSettings.getDevelopmentStorageAccountSettings();

    var expectedName = StorageServiceClientConstants.DEVSTORE_STORAGE_ACCOUNT;
    var expectedKey = StorageServiceClientConstants.DEVSTORE_STORAGE_ACCESS_KEY;
    var expectedBlobEndpoint = StorageServiceClientConstants.DEV_STORE_URI + ':10000/' + StorageServiceClientConstants.DEVSTORE_STORAGE_ACCOUNT;
    var expectedQueueEndpoint = StorageServiceClientConstants.DEV_STORE_URI + ':10001/' + StorageServiceClientConstants.DEVSTORE_STORAGE_ACCOUNT;
    var expectedTableEndpoint = StorageServiceClientConstants.DEV_STORE_URI + ':10002/' + StorageServiceClientConstants.DEVSTORE_STORAGE_ACCOUNT;
    var expectedBlobSecondaryEndpoint = StorageServiceClientConstants.DEV_STORE_URI + ':10000/' + StorageServiceClientConstants.DEVSTORE_STORAGE_ACCOUNT + '-secondary';
    var expectedQueueSecondaryEndpoint = StorageServiceClientConstants.DEV_STORE_URI + ':10001/' + StorageServiceClientConstants.DEVSTORE_STORAGE_ACCOUNT + '-secondary';
    var expectedTableSecondaryEndpoint = StorageServiceClientConstants.DEV_STORE_URI + ':10002/' + StorageServiceClientConstants.DEVSTORE_STORAGE_ACCOUNT + '-secondary';

    assert.strictEqual(actual._name, expectedName);
    assert.strictEqual(actual._key, expectedKey);
    assert.strictEqual(actual._blobEndpoint.primaryHost, expectedBlobEndpoint);
    assert.strictEqual(actual._queueEndpoint.primaryHost, expectedQueueEndpoint);
    assert.strictEqual(actual._tableEndpoint.primaryHost, expectedTableEndpoint);
    assert.strictEqual(actual._blobEndpoint.secondaryHost, expectedBlobSecondaryEndpoint);
    assert.strictEqual(actual._queueEndpoint.secondaryHost, expectedQueueSecondaryEndpoint);
    assert.strictEqual(actual._tableEndpoint.secondaryHost, expectedTableSecondaryEndpoint);
    assert.strictEqual(actual._usePathStyleUri, true);
    done();
  });


  it('createFromEnvironmentPrefersConnectionStringToSeparateVariables', function(done) {
    var protocol = 'https';
    var expectedName = 'mytestaccount';
    var expectedKey = 'AhlzsbLRkjfwObuqff3xrhB2yWJNh1EMptmcmxFJ6fvPTVX3PZXwrG2YtYWf5DPMVgNsteKStM5iBLlknYFVoA==';
    var connectionString  = 'defaultendpointsprotocol=' + protocol + ';accountname=' + expectedName + ';accountkey=' + expectedKey;
    var expectedBlobEndpoint = url.format({ protocol: protocol, host: expectedName + '.' + ConnectionStringKeys.BLOB_BASE_DNS_NAME });
    var expectedQueueEndpoint = url.format({ protocol: protocol, host: expectedName + '.' + ConnectionStringKeys.QUEUE_BASE_DNS_NAME });
    var expectedTableEndpoint = url.format({ protocol: protocol, host: expectedName + '.' + ConnectionStringKeys.TABLE_BASE_DNS_NAME });
    var expectedTableSecondaryEndpoint = url.format({ protocol: protocol, host: expectedName + '-secondary.' + ConnectionStringKeys.TABLE_BASE_DNS_NAME });
    var expectedBlobSecondaryEndpoint = url.format({ protocol: protocol, host: expectedName + '-secondary.' + ConnectionStringKeys.BLOB_BASE_DNS_NAME });
    var expectedQueueSecondaryEndpoint = url.format({ protocol: protocol, host: expectedName + '-secondary.' + ConnectionStringKeys.QUEUE_BASE_DNS_NAME });

    testutil.withEnvironment({
      AZURE_STORAGE_CONNECTION_STRING: connectionString,
      AZURE_STORAGE_ACCOUNT: 'differentAcccount',
      AZURE_STORAGE_ACCESS_KEY: expectedKey
    }, function(done) {
      var settings = StorageServiceSettings.createFromEnvironment();

      assert.strictEqual(settings._name, expectedName);
      assert.strictEqual(settings._key, expectedKey);
      assert.strictEqual(settings._blobEndpoint.primaryHost, expectedBlobEndpoint);
      assert.strictEqual(settings._queueEndpoint.primaryHost, expectedQueueEndpoint);
      assert.strictEqual(settings._tableEndpoint.primaryHost, expectedTableEndpoint);
      assert.strictEqual(settings._blobEndpoint.secondaryHost, expectedBlobSecondaryEndpoint);
      assert.strictEqual(settings._queueEndpoint.secondaryHost, expectedQueueSecondaryEndpoint);
      assert.strictEqual(settings._tableEndpoint.secondaryHost, expectedTableSecondaryEndpoint);
      assert.strictEqual(settings._usePathStyleUri, false);
    });
    done();
  });

  it('createFromEnvironmentUsesSeparateVarsIfConnectionStringNotSet', function(done) {
    var protocol = 'https';
    var expectedName = 'mytestaccount';
    var expectedKey = 'AhlzsbLRkjfwObuqff3xrhB2yWJNh1EMptmcmxFJ6fvPTVX3PZXwrG2YtYWf5DPMVgNsteKStM5iBLlknYFVoA==';
    var expectedBlobEndpoint = url.format({ protocol: protocol, host: expectedName + '.' + ConnectionStringKeys.BLOB_BASE_DNS_NAME });
    var expectedQueueEndpoint = url.format({ protocol: protocol, host: expectedName + '.' + ConnectionStringKeys.QUEUE_BASE_DNS_NAME });
    var expectedTableEndpoint = url.format({ protocol: protocol, host: expectedName + '.' + ConnectionStringKeys.TABLE_BASE_DNS_NAME });
    var expectedTableSecondaryEndpoint = url.format({ protocol: protocol, host: expectedName + '-secondary.' + ConnectionStringKeys.TABLE_BASE_DNS_NAME });
    var expectedBlobSecondaryEndpoint = url.format({ protocol: protocol, host: expectedName + '-secondary.' + ConnectionStringKeys.BLOB_BASE_DNS_NAME });
    var expectedQueueSecondaryEndpoint = url.format({ protocol: protocol, host: expectedName + '-secondary.' + ConnectionStringKeys.QUEUE_BASE_DNS_NAME });

    testutil.withEnvironment({
      AZURE_STORAGE_ACCOUNT: expectedName,
      AZURE_STORAGE_ACCESS_KEY: expectedKey
    }, function(done) {
      delete process.env.AZURE_STORAGE_CONNECTION_STRING;
      var settings = StorageServiceSettings.createFromEnvironment();

      assert.strictEqual(settings._name, expectedName);
      assert.strictEqual(settings._key, expectedKey);
      assert.strictEqual(settings._blobEndpoint.primaryHost, expectedBlobEndpoint);
      assert.strictEqual(settings._queueEndpoint.primaryHost, expectedQueueEndpoint);
      assert.strictEqual(settings._tableEndpoint.primaryHost, expectedTableEndpoint);
      assert.strictEqual(settings._blobEndpoint.secondaryHost, expectedBlobSecondaryEndpoint);
      assert.strictEqual(settings._queueEndpoint.secondaryHost, expectedQueueSecondaryEndpoint);
      assert.strictEqual(settings._tableEndpoint.secondaryHost, expectedTableSecondaryEndpoint);
      assert.strictEqual(settings._usePathStyleUri, false);
    });
    done();
  });
});
