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
if (testutil.isBrowser()) {
  var azure = AzureStorage.File;
} else {
  var azure = require('../../../');
}
var azureutil = require('../../../lib/common/util/util');

var fileSseSuite = new TestSuite('fileservice-sse-tests');
var sseEnabledAccountConnectionString = process.env.AZURE_STORAGE_CONNECTION_STRING_SSE_ENABLED_ACCOUNT;
var runSseSuite = !azureutil.IsNullOrEmptyOrUndefinedOrWhiteSpace(sseEnabledAccountConnectionString) || fileSseSuite.isPlayback();
var runSseCase = runSseSuite ? it : it.skip;

var shareNamesPrefix = 'sse-file-test-share-';
var directoryNamesPrefix = 'sse-dir-';
var fileNamesPrefix = 'sse-file-';

var fileService;
var shareName;
var directoryName;
var fileName;

describe('FileServiceStorageServiceEncryption', function () {
  before(function (done) {
    if (!runSseSuite) {
      done();
    } else {
      if (fileSseSuite.isMocked) {
        testutil.POLL_REQUEST_INTERVAL = 0;
      }
      fileSseSuite.setupSuite(function () {
        sseEnabledAccountConnectionString = process.env.AZURE_STORAGE_CONNECTION_STRING_SSE_ENABLED_ACCOUNT;
        fileService = azure.createFileService(sseEnabledAccountConnectionString).withFilter(new azure.ExponentialRetryPolicyFilter());
        shareName = fileSseSuite.getName(shareNamesPrefix);
        directoryName = fileSseSuite.getName(directoryNamesPrefix);
        fileName = fileSseSuite.getName(fileNamesPrefix);

        done();
      });
    }
  });

  after(function (done) {
    if (!runSseSuite) {
      done();
    } else {
      fileSseSuite.teardownSuite(done);
    }
  });

  beforeEach(function (done) {
    if (!runSseSuite) {
      done();
    } else {
      fileSseSuite.setupTest(done);
    }
  });

  afterEach(function (done) {
    if (!runSseSuite) {
      done();
    } else {
      fileSseSuite.teardownTest(done);
    }
  });

  describe('create share, directory and file for file SSE testing', function () {
    runSseCase('should work', function (done) {
      fileService.createShareIfNotExists(shareName, function (createError) {
        assert.equal(createError, null);

        fileService.createDirectoryIfNotExists(shareName, directoryName, function (createError, directoryResult, createResponse) {
          assert.equal(createError, null);
          assert.ok(createResponse.isSuccessful);
          // As Azure document https://docs.microsoft.com/en-us/rest/api/storageservices/create-directory updated at 7/17/2017,
          // CreateDirectory should return x-ms-request-server-encrypted but not x-ms-server-encrypted, contacting owner.
          // assert.strictEqual(createResponse.headers["x-ms-request-server-encrypted"], "true"); // Assert fail

          fileService.doesFileExist(shareName, directoryName, fileName, function (error, fileResult, response) {
            assert.equal(error, null);
            if (!azureutil.IsNullOrEmptyOrUndefinedOrWhiteSpace(fileResult) && !fileResult.exists) {
              var fileText = "sseTestFile";
              fileService.createFileFromText(shareName, directoryName, fileName, fileText, function (createError, fileResult, createResponse) {
                assert.equal(createError, null);
                assert.ok(createResponse.isSuccessful);
                assert.strictEqual(createResponse.requestServerEncrypted, true);

                done();
              });
            }
          });
        });
      });
    });
  });

  describe('setFileProperties', function () {
    runSseCase('should contain requestServerEncrypted in response', function (done) {
      fileService.setFileProperties(shareName, directoryName, fileName, {}, function (error, fileResult, response) {
        assert.equal(error, null);
        assert.ok(response.isSuccessful);
        assert.notEqual(fileResult, null);
        assert.strictEqual(fileResult.serverEncrypted, undefined); // TODO: Align to blob design, plan to switch serverEncrypted's type to boolean in next major release.
        assert.strictEqual(response.requestServerEncrypted, true);

        done();
      });
    });
  });

  describe('getDirectoryProperties', function () {
    runSseCase('should contain property serverEncrypted in directoryResult', function (done) {
      fileService.getDirectoryProperties(shareName, directoryName, function (error, directoryResult, response) {
        assert.equal(error, null);
        assert.ok(response.isSuccessful);
        assert.notEqual(directoryResult, null);
        assert.strictEqual(directoryResult.serverEncrypted, "true"); // TODO: Align to blob design, plan to switch serverEncrypted's type to boolean in next major release.
        assert.strictEqual(response.requestServerEncrypted, undefined);

        done();
      });
    });
  });

  describe('getFileToText', function () {
    runSseCase('should contain property serverEncrypted in fileResult', function (done) {
      fileService.getFileToText(shareName, directoryName, fileName, function (error, fileText, fileResult, response) {
        assert.equal(error, null);
        assert.ok(response.isSuccessful);
        assert.notEqual(fileResult, null);
        assert.strictEqual(fileResult.serverEncrypted, "true"); // TODO: Align to blob design, plan to switch serverEncrypted's type to boolean in next major release.
        assert.strictEqual(response.requestServerEncrypted, undefined);

        done();
      });
    });
  });

  describe('getFileProperties', function () {
    runSseCase('should contain property serverEncrypted in fileResult', function (done) {
      fileService.getFileProperties(shareName, directoryName, fileName, function (error, fileResult, response) {
        assert.equal(error, null);
        assert.ok(response.isSuccessful);
        assert.notEqual(fileResult, null);
        assert.strictEqual(fileResult.serverEncrypted, "true"); // TODO: Align to blob design, plan to switch serverEncrypted's type to boolean in next major release.
        assert.strictEqual(response.requestServerEncrypted, undefined);

        done();
      });
    });
  });

  describe('getDirectoryMetadata', function () {
    runSseCase('should not contain property serverEncrypted in directoryResult and requestServerEncrypted in response', function (done) {
      fileService.getDirectoryMetadata(shareName, directoryName, function (error, directoryResult, response) {
        assert.equal(error, null);
        assert.ok(response.isSuccessful);
        assert.notEqual(directoryResult, null);
        assert.strictEqual(directoryResult.serverEncrypted, undefined); // TODO: Align to blob design, plan to switch serverEncrypted's type to boolean in next major release.
        assert.strictEqual(response.requestServerEncrypted, undefined);

        done();
      });
    });
  });

  describe('delete file and directory for file SSE testing', function () {
    runSseCase('should work', function (done) {
      fileService.deleteFileIfExists(shareName, directoryName, fileName, function (deleteError, deleted) {
        assert.equal(deleteError, null);
        assert.strictEqual(deleted, true);

        fileService.deleteDirectoryIfExists(shareName, directoryName, function (deleteError, deleted) {
          assert.equal(deleteError, null);
          assert.strictEqual(deleted, true);

          done();
        });
      });
    });
  });

}); // outer describe end