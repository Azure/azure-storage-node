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
var testutil = require('../../framework/util');
var TestSuite = require('../../framework/test-suite');

// Lib includes
var azureutil = require('../../../lib/common/util/util');//testutil.libRequire('/common/util/util');
if (testutil.isBrowser()) {
  var azure = AzureStorage.Blob;
} else {
  var azure = require('../../../');
}

var blobSseSuite = new TestSuite('blobservice-sse-tests');
var sseEnabledAccountConnectionString = process.env.AZURE_STORAGE_CONNECTION_STRING_SSE_ENABLED_ACCOUNT;
var runSseSuite = !azureutil.IsNullOrEmptyOrUndefinedOrWhiteSpace(sseEnabledAccountConnectionString) || blobSseSuite.isPlayback();
var runSseCase = runSseSuite ? it : it.skip;

var containerNamesPrefix = 'sse-cont-';
var blobNamesPrefix = 'sse-blob-';

var blobService;
var containerName;
var blobName;

describe('BlobServiceStorageServiceEncryption', function () {
  before(function (done) {
    if (!runSseSuite) {
      done();
    } else {
      if (blobSseSuite.isMocked) {
        testutil.POLL_REQUEST_INTERVAL = 0;
      }
      blobSseSuite.setupSuite(function () {
        sseEnabledAccountConnectionString = process.env.AZURE_STORAGE_CONNECTION_STRING_SSE_ENABLED_ACCOUNT;
        blobService = azure.createBlobService(sseEnabledAccountConnectionString).withFilter(new azure.ExponentialRetryPolicyFilter());
        containerName = blobSseSuite.getName(containerNamesPrefix).toLowerCase();
        blobName = blobSseSuite.getName(blobNamesPrefix).toLowerCase();

        done();
      });
    }
  });

  after(function (done) {
    if (!runSseSuite) {
      done();
    } else {
      blobSseSuite.teardownSuite(done);
    }
  });

  beforeEach(function (done) {
    if (!runSseSuite) {
      done();
    } else {
      blobSseSuite.setupTest(done);
    }
  });

  afterEach(function (done) {
    if (!runSseSuite) {
      done();
    } else {
      blobSseSuite.teardownTest(done);
    }
  });

  describe('create container and blob for blob SSE testing', function () {
    runSseCase('should work', function (done) {
      blobService.deleteContainerIfExists(containerName, function (deleteError) {
        assert.equal(deleteError, null);

        blobService.createContainerIfNotExists(containerName, function (createError, container) {
          assert.equal(createError, null);
          assert.notEqual(container, null);

          var blobText = "sseTestBlob";
          blobService.createBlockBlobFromText(containerName, blobName, blobText, function (uploadError, blob, uploadResponse) {
            assert.equal(uploadError, null);
            assert.ok(uploadResponse.isSuccessful);
            assert.strictEqual(uploadResponse.requestServerEncrypted, true);

            done();
          });
        });
      });
    });
  });

  describe('setBlobMetadata', function () {
    runSseCase('should contain requestServerEncrypted in response', function (done) {
      blobService.setBlobMetadata(containerName, blobName, {'testKey': 'testValue'}, function (error, blobResult, response) {
        assert.equal(error, null);
        assert.ok(response.isSuccessful);
        assert.notEqual(blobResult, null);
        assert.strictEqual(blobResult.serverEncrypted, undefined); // TODO: Backward compatibility, plan to switch serverEncrypted's type to boolean in next major release.
        assert.strictEqual(response.requestServerEncrypted, true);

        done();
      });
    });
  });

  describe('getBlobToText', function () {
    runSseCase('should contain property serverEncrypted in blobResult', function (done) {
      blobService.getBlobToText(containerName, blobName, function (error, blobText, blobResult, response) {
        assert.equal(error, null);
        assert.ok(response.isSuccessful);
        assert.notEqual(blobResult, null);
        assert.strictEqual(blobResult.serverEncrypted, "true"); // TODO: Backward compatibility, plan to switch serverEncrypted's type to boolean in next major release.
        assert.strictEqual(response.requestServerEncrypted, undefined);

        done();
      });
    });
  });

  describe('getBlobProperties', function () {
    runSseCase('should contain property serverEncrypted in blobResult', function (done) {
      blobService.getBlobProperties(containerName, blobName, function (error, blobResult) {
        assert.equal(error, null);
        assert.notEqual(blobResult, null);
        assert.strictEqual(blobResult.serverEncrypted, "true"); // TODO: Backward compatibility, plan to switch serverEncrypted's type to boolean in next major release.

        done();
      });
    });
  });

  describe('getBlobMetadata', function () {
    runSseCase('should not contain property serverEncrypted in blobResult and requestServerEncrypted in response', function (done) {
      blobService.getBlobMetadata(containerName, blobName, function (error, blobResult, response) {
        assert.equal(error, null);
        assert.ok(response.isSuccessful);
        assert.notEqual(blobResult, null);
        assert.strictEqual(blobResult.serverEncrypted, undefined); // TODO: Backward compatibility, plan to switch serverEncrypted's type to boolean in next major release.
        assert.strictEqual(response.requestServerEncrypted, undefined);

        done();
      });
    });
  });

  describe('delete container for blob SSE testing', function () {
    runSseCase('should work', function (done) {
      blobService.deleteContainerIfExists(containerName, function (deleteError) {
        assert.equal(deleteError, null);

        done();
      });
    });
  });

}); // outer describe end