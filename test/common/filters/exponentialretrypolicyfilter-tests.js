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
var fs = require('fs');
var extend = require('extend');

// Test includes
var testutil = require('../../framework/util');
var TestSuite = require('../../framework/test-suite');
var rfs = require('../../../lib/common/streams/readablefs');

// Lib includes
if (testutil.isBrowser()) {
  var azure = extend({}, AzureStorage.Blob, AzureStorage.Table, AzureStorage.Queue, AzureStorage.File);
} else {
  var azure = require('../../../');
}

var ExponentialRetryPolicyFilter = azure.ExponentialRetryPolicyFilter;
var Constants = azure.Constants;

var exponentialRetryPolicyFilter;

var tableNames = [];
var tablePrefix = 'expretry';

var shareNames = [];
var sharePrefix = 'expretry';

var fileNames = [];
var filePrefix = 'expretry';

var tableService;
var tableName;

var fileService;
var shareName;

var suite = new TestSuite('exponentialretrypolicyfilter-tests');
var runOrSkip = suite.isMocked ? it.skip : it;
var skipMockAndBrowser = suite.isBrowser ? it.skip : (suite.isMocked ? it.skip : it);

describe('exponentialretrypolicyfilter-tests', function () {
  before(function (done) {
    if (suite.isMocked) {
      testutil.POLL_REQUEST_INTERVAL = 0;
    }
    suite.setupSuite(function () {
      exponentialRetryPolicyFilter = new ExponentialRetryPolicyFilter();
      tableService = azure.createTableService(process.env['AZURE_STORAGE_CONNECTION_STRING']).withFilter(exponentialRetryPolicyFilter);
      done();
    });
  });

  after(function (done) {
    suite.teardownSuite(done);
  });

  beforeEach(function (done) {
    suite.setupTest(done);
  });

  afterEach(function (done) {
    if (tableName) {
      tableService.deleteTableIfExists(tableName, function (deleteError) {
        assert.equal(deleteError, null);
        if (shareName) {
          fileService.deleteShareIfExists(shareName, function (deleteError) {
            assert.equal(deleteError, null);
            suite.teardownTest(done);
          });
        } else {
          suite.teardownTest(done);
        }
      });
    } else {
      suite.teardownTest(done);
    }
  });

  it('should fail when the table already exists', function (done) {
    tableName = testutil.generateId(tablePrefix, tableNames, suite.isMocked);

    var retryCount = 3;
    var retryInterval = 30;

    exponentialRetryPolicyFilter.retryCount = retryCount;
    exponentialRetryPolicyFilter.retryInterval = retryInterval;

    tableService.createTable(tableName, function (err) {
      assert.equal(err, null);

      tableService.createTable(tableName, function (err2) {
        assert.notEqual(err2, null);
        assert.equal(err2.code, Constants.TableErrorCodeStrings.TABLE_ALREADY_EXISTS);
        assert.equal(err2.innerError, null);

        done();
      });
    });
  });

  it('should eventually succeed while using custom policy and multiple retries are used with an exponential backoff', function (done) {
    tableName = testutil.generateId(tablePrefix, tableNames, suite.isMocked);

    var retryCount = 3;

    // 30 seconds as starting time between attempts should be enough to give enough time for the
    // table creation to succeed after a deletion.
    var retryInterval = (suite.isRecording || !suite.isMocked) ? 30000 : 30;

    exponentialRetryPolicyFilter.retryCount = retryCount;
    exponentialRetryPolicyFilter.retryInterval = retryInterval;

    // replace shouldRetry to skip return codes verification and retry on 409 (deleting)
    exponentialRetryPolicyFilter.shouldRetry = function (statusCode, requestOptions) {
      var retryData = (requestOptions && requestOptions.retryContext) ? requestOptions.retryContext : {};
      var currentCount = retryData.retryCount ? retryData.retryCount : 0;

      var retryInfo = {
        retryInterval: this.retryInterval,
        retryable: currentCount < this.retryCount,
      };

      return retryInfo;
    };

    tableService.createTable(tableName, function (err) {
      assert.equal(err, null);

      tableService.deleteTable(tableName, function (err2) {
        assert.equal(err2, null);

        // trying to create a table right after a delete should force retry to kick in
        // table should be created nicely
        tableService.createTable(tableName, function (err3) {
          assert.equal(err3, null);

          done();
        });
      });
    });
  });

  it('should fail when deleteTable is tried', function (done) {
    tableName = testutil.generateId(tablePrefix, tableNames, suite.isMocked);

    var retryCount = 3;
    var retryInterval = 30;

    exponentialRetryPolicyFilter.retryCount = retryCount;
    exponentialRetryPolicyFilter.retryInterval = retryInterval;

    tableService.deleteTable(tableName, function (err) {
      assert.equal(err.code, Constants.StorageErrorCodeStrings.RESOURCE_NOT_FOUND);

      done();
    });
  });

  skipMockAndBrowser('should NOT retry when the output stream is already sent', function(done) {
    fileService = azure.createFileService(process.env['AZURE_STORAGE_CONNECTION_STRING']).withFilter(exponentialRetryPolicyFilter);
    shareName = testutil.generateId(sharePrefix, shareNames, suite.isMocked);
    var fileName = testutil.generateId(filePrefix, fileNames, suite.isMocked);
    var localTempFileName = suite.getName('fileservice_test_retry');
    var fileSize = 100;

    // Real stream length is smaller than the expected data length to mock the client timeout error to trigger the retry
    var fileBuffer = new Buffer( fileSize / 2 );
    fileBuffer.fill(1);
    fs.writeFileSync(localTempFileName, fileBuffer);
    
    fileService.createShare(shareName, function(err, result) {
      assert.equal(err, null);
      assert.notEqual(result, null);
      assert.equal(result.name, shareName);

      fileService.createFile(shareName, '', fileName, fileSize, function(err) {
        assert.equal(err, null);
        
        // Expect 100 bytes to sent but the stream only have 50 bytes.
        // It'll result in ECONNRESET error and should NOT retry. If retry, it'll hang to wait for data from the stream but the stream is already closed as the data already sent out in the 1st failed request.
        fileService.createRangesFromStream(shareName, '', fileName, rfs.createReadStream(localTempFileName), 0, fileSize - 1, function(err, result, response){
          assert.notEqual(err, null);
          done();
        });
      });
    });
  });
});