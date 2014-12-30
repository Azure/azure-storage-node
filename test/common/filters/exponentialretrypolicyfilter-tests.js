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
var azure = testutil.libRequire('azure-storage');

var ExponentialRetryPolicyFilter = azure.ExponentialRetryPolicyFilter;
var Constants = azure.Constants;

var exponentialRetryPolicyFilter;

var tableNames = [];
var tablePrefix = 'expretry';

var tableService;
var tableName;

var suite = new TestSuite('exponentialretrypolicyfilter-tests');

describe('exponentialretrypolicyfilter-tests', function () {
  before(function (done) {
    if (suite.isMocked) {
      testutil.POLL_REQUEST_INTERVAL = 0;
    }
    suite.setupSuite(function () {
      exponentialRetryPolicyFilter = new ExponentialRetryPolicyFilter();
      tableService = azure.createTableService().withFilter(exponentialRetryPolicyFilter);
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
    tableService.deleteTableIfExists(tableName, function (deleteError) {
      assert.equal(deleteError, null);
      suite.teardownTest(done);
    });
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
    exponentialRetryPolicyFilter.shouldRetry = function (statusCode, retryData) {
      var currentCount = (retryData && retryData.retryCount) ? retryData.retryCount : 0;

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
});