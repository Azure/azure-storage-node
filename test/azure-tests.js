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

// Test includes
var testutil = require('./framework/util');

// Lib includes
var azure = testutil.libRequire('azure-storage');

var Constants = azure.Constants;
var StorageServiceClientConstants = Constants.StorageServiceClientConstants;

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

  it('ExponentialRetryPolicyFilter', function (done) {
    assert.notEqual(azure.ExponentialRetryPolicyFilter, null);

    done();
  });

  it('LinearRetryPolicyFilter', function (done) {
    assert.notEqual(azure.LinearRetryPolicyFilter, null);

    done();
  });

  it('Constants', function (done) {
    assert.notEqual(azure.Constants, null);

    done();
  });

  it('NotEmulatedExplicitCredentials', function (done) {
    // Make sure is not emulated
    delete process.env[StorageServiceClientConstants.EnvironmentVariables.EMULATED];

    // set some environment credentials for the production azure services
    process.env[StorageServiceClientConstants.EnvironmentVariables.AZURE_STORAGE_ACCOUNT] = environmentAzureStorageAccount;
    process.env[StorageServiceClientConstants.EnvironmentVariables.AZURE_STORAGE_ACCESS_KEY] = environmentAzureStorageAccessKey;
    process.env[StorageServiceClientConstants.EnvironmentVariables.AZURE_STORAGE_DNS_SUFFIX] = environmentAzureStorageDnsSuffix;

    // Create blob client passing some credentials
    var blobService = azure.createBlobService(parameterAzureStorageAccount, parameterAzureStorageAccessKey);

    // Points to the production services
    assert.equal(blobService.usePathStyleUri, false);
    assert.equal(blobService.host.primaryHost, 'https://' + parameterAzureStorageAccount.toLowerCase() + '.' + StorageServiceClientConstants.CLOUD_BLOB_HOST + ':443/');
    assert.equal(blobService.host.secondaryHost, 'https://' + parameterAzureStorageAccount.toLowerCase() + '-secondary.' + StorageServiceClientConstants.CLOUD_BLOB_HOST + ':443/');

    // And credentials are the ones passed
    assert.equal(blobService.storageCredentials.storageAccount, parameterAzureStorageAccount);
    assert.equal(blobService.storageCredentials.storageAccessKey, parameterAzureStorageAccessKey);

    done();
  });

  it('EmulatedExplicitCredentials', function (done) {
    // set emulated to true
    process.env[StorageServiceClientConstants.EnvironmentVariables.EMULATED] = true;

    // set some environment credentials for the production azure services
    process.env[StorageServiceClientConstants.EnvironmentVariables.AZURE_STORAGE_ACCOUNT] = environmentAzureStorageAccount;
    process.env[StorageServiceClientConstants.EnvironmentVariables.AZURE_STORAGE_ACCESS_KEY] = environmentAzureStorageAccessKey;
    process.env[StorageServiceClientConstants.EnvironmentVariables.AZURE_STORAGE_DNS_SUFFIX] = environmentAzureStorageDnsSuffix;

    // Create blob client passing some credentials
    var blobService = azure.createBlobService(parameterAzureStorageAccount, parameterAzureStorageAccessKey);

    // Points to the credentials
    assert.equal(blobService.usePathStyleUri, false);
    assert.equal(blobService.host.primaryHost, 'https://' + parameterAzureStorageAccount.toLowerCase() + '.' +  StorageServiceClientConstants.CLOUD_BLOB_HOST + ':443/');
    assert.equal(blobService.host.secondaryHost, 'https://' + parameterAzureStorageAccount.toLowerCase() + '-secondary.' +  StorageServiceClientConstants.CLOUD_BLOB_HOST + ':443/');

    // But the used credentials are the ones passed because we were explicit
    assert.equal(blobService.storageCredentials.storageAccount, parameterAzureStorageAccount);
    assert.equal(blobService.storageCredentials.storageAccessKey, parameterAzureStorageAccessKey);

    done();
  });

  it('NotEmulatedWithoutParameters', function (done) {
    // Make sure is not emulated
    var connString = process.env[StorageServiceClientConstants.EnvironmentVariables.AZURE_STORAGE_CONNECTION_STRING];
    delete process.env[StorageServiceClientConstants.EnvironmentVariables.AZURE_STORAGE_CONNECTION_STRING];
    delete process.env[StorageServiceClientConstants.EnvironmentVariables.EMULATED];

    // set some environment credentials for the production azure services
    process.env[StorageServiceClientConstants.EnvironmentVariables.AZURE_STORAGE_ACCOUNT] = environmentAzureStorageAccount;
    process.env[StorageServiceClientConstants.EnvironmentVariables.AZURE_STORAGE_ACCESS_KEY] = environmentAzureStorageAccessKey;
    process.env[StorageServiceClientConstants.EnvironmentVariables.AZURE_STORAGE_DNS_SUFFIX] = environmentAzureStorageDnsSuffix;

    // Create blob client without passing any credentials
    var blobService = azure.createBlobService();

    // Points to the production service
    assert.equal(blobService.usePathStyleUri, false);
    assert.equal(blobService.host.primaryHost, 'https://' + environmentAzureStorageAccount + '.' + StorageServiceClientConstants.CLOUD_BLOB_HOST + ':443/');
    assert.equal(blobService.host.secondaryHost, 'https://' + environmentAzureStorageAccount + '-secondary.' + StorageServiceClientConstants.CLOUD_BLOB_HOST + ':443/');

    // and uses the environment variables
    assert.equal(blobService.storageCredentials.storageAccount, environmentAzureStorageAccount);
    assert.equal(blobService.storageCredentials.storageAccessKey, environmentAzureStorageAccessKey);

    process.env[StorageServiceClientConstants.EnvironmentVariables.AZURE_STORAGE_CONNECTION_STRING] = connString;
    done();
  });

  it('EmulatedWithoutParameters', function (done) {
    // set emulated to true
    process.env[StorageServiceClientConstants.EnvironmentVariables.EMULATED] = true;

    // set some environment credentials for the production azure services
    process.env[StorageServiceClientConstants.EnvironmentVariables.AZURE_STORAGE_ACCOUNT] = environmentAzureStorageAccount;
    process.env[StorageServiceClientConstants.EnvironmentVariables.AZURE_STORAGE_ACCESS_KEY] = environmentAzureStorageAccessKey;
    process.env[StorageServiceClientConstants.EnvironmentVariables.AZURE_STORAGE_DNS_SUFFIX] = environmentAzureStorageDnsSuffix;

    // Create blob client without passing any credentials
    var blobService = azure.createBlobService();

    // Points to the emulator
    assert.equal(blobService.usePathStyleUri, true);
    assert.equal(blobService.host.primaryHost, 'http://' + StorageServiceClientConstants.DEVSTORE_BLOB_HOST + '/devstoreaccount1');
    assert.equal(blobService.host.secondaryHost, 'http://' + StorageServiceClientConstants.DEVSTORE_BLOB_HOST + '/devstoreaccount1-secondary');

    // And uses the emulator credentials
    assert.equal(blobService.storageCredentials.storageAccount, StorageServiceClientConstants.DEVSTORE_STORAGE_ACCOUNT);
    assert.equal(blobService.storageCredentials.storageAccessKey, StorageServiceClientConstants.DEVSTORE_STORAGE_ACCESS_KEY);

    done();
  });
});