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

var assert = require('assert');

// Test includes
var testutil = require('../../framework/util');
var TestSuite = require('../../framework/test-suite');

// Lib includes
if (testutil.isBrowser()) {
  var azure = AzureStorage.Table;
} else {
  var azure = require('../../../');
}

var LinearRetryPolicyFilter = azure.LinearRetryPolicyFilter;
var Constants = azure.Constants;

var tableService;
var linearRetryPolicyFilter;

var tableNames = [];
var tablePrefix = 'linearretry';

var tableService;
var tableName;

var suite = new TestSuite('linerretrypolicyfilter-tests');

describe('linearretrypolicyfilter-tests', function () {
  before(function (done) {
    if (suite.isMocked) {
      testutil.POLL_REQUEST_INTERVAL = 0;
    }
    suite.setupSuite(function () {
      linearRetryPolicyFilter = new LinearRetryPolicyFilter();
      tableService = azure.createTableService(process.env['AZURE_STORAGE_CONNECTION_STRING']).withFilter(linearRetryPolicyFilter);
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
    tableService.deleteTableIfExists(tableName, function(deleteError) {
      assert.equal(deleteError, null);
      suite.teardownTest(done);
    });
  });

  it('should fail when the table already exists', function (done) {
    tableName = testutil.generateId(tablePrefix, tableNames, suite.isMocked);

    var retryCount = 3;
    var retryInterval = 30;

    linearRetryPolicyFilter.retryCount = retryCount;
    linearRetryPolicyFilter.retryInterval = retryInterval;

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

  it('should eventually succeed while using custom policy and multiple retries are used with a linear backoff', function (done) {
    tableName = testutil.generateId(tablePrefix, tableNames, suite.isMocked);

    var retryCount = 3;

    // 30 seconds between attempts should be enough to give enough time for the
    // table creation to succeed after a deletion.
    var retryInterval = (suite.isRecording || !suite.isMocked) ? 30000 : 30;

    linearRetryPolicyFilter.retryCount = retryCount;
    linearRetryPolicyFilter.retryInterval = retryInterval;

    // replace shouldRetry to skip return codes verification and retry on 409 (deleting)
    linearRetryPolicyFilter.shouldRetry = function (statusCode, requestOptions) {
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

    linearRetryPolicyFilter.retryCount = retryCount;
    linearRetryPolicyFilter.retryInterval = retryInterval;

    tableService.deleteTable(tableName, function (err) {
      assert.equal(err.code, Constants.StorageErrorCodeStrings.RESOURCE_NOT_FOUND);
      done();
    });
  });
});