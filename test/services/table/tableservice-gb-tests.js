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
var mocha = require('mocha');

// Test includes
var testutil = require('../../framework/util');
var tabletestutil = require('./table-test-utils');
var TestSuite = require('../../framework/test-suite');

// Lib includes
var azure = testutil.libRequire('azure-storage');

var tableNames = [];
var tablePrefix = 'tableservice';

var suite = new TestSuite('tableservice-gb-tests');

var tableService;
var suiteUtil;

describe('tableservice-gb-tests', function () {
  before(function (done) {
    if (suite.isMocked) {
      testutil.POLL_REQUEST_INTERVAL = 0;
    }
    suite.setupSuite(function () {
      tableService = azure.createTableService().withFilter(new azure.ExponentialRetryPolicyFilter());
      done();
    }); 
  });

  after(function (done) {
    suite.teardownSuite(done);
  });

  var tableName;

  var partitionKey = '\u2488\u2460\u216B\u3128\u3129'.toString('GB18030');
  var rowKey = '\u2488\u2460\u216B\u3128\u3129'.toString('GB18030');
  var value = 'test';

  beforeEach(function (done) {
    suite.setupTest(function(){
      tableName = suite.getName(tablePrefix).replace(/-/g,'');
      tableService.createTable(tableName, function (err) {
        should.not.exist(err);
        done();
      });
    });
  });

  afterEach(function (done) {
    var tables = [];
    tabletestutil.listTables(tableService, tablePrefix, tables, null, null, function() {
      var deleteTables = function(tablesToDelete) {
        if (tablesToDelete.length === 0) {
          suite.teardownTest(done);
        } else {
          tableService.deleteTable(tablesToDelete[0], function (createError, table, createResponse) {
            deleteTables(tablesToDelete.slice(1));
          });
        }
      };

      deleteTables(tables.slice(0));
    });
  });

  describe('when entity with gb keys exist', function () {

    beforeEach(function (done) {

      tableService.insertEntity(tableName, {
          PartitionKey: { _:partitionKey},
          RowKey: { _:rowKey},
          Value: { _:value}
        },
        done);
    });

    it('retrieve entity should work', function (done) {
      tableService.retrieveEntity(tableName, partitionKey, rowKey, function (err, res) {
        should.not.exist(err);
        res.PartitionKey['_'].should.equal(partitionKey);
        res.RowKey['_'].should.equal(rowKey);
        res.Value['_'].should.equal(value);

        done();
      });
    });
  });

  describe('inserting entity with gb18030 data', function () {

    var entity1 = { PartitionKey: { _:'part1'},
      RowKey: { _:'row1'},
      field: { _:'my field'},
      otherfield: { _:'my other field'},
      otherprops: { _:'my properties'},
      gb18030: { _:"𡬁𠻝𩂻耨鬲, 㑜䊑㓣䟉䋮䦓, ᡨᠥ᠙ᡰᢇ᠘ᠶ, ࿋ཇ࿂ོ༇ྒ, ꃌꈗꈉꋽ, Uighur, ᥗᥩᥬᥜᥦ "}
    };

    it('should store data with encoded fields', function (done) {
      tableService.insertEntity(tableName, entity1, function (err) {
        if (err) { return done(err); }

        tableService.queryEntities(tableName, null, null, function (err, result) {
          if (err) { return done(err); }

          result.entries.length.should.equal(1);
          result.entries[0].PartitionKey['_'].should.equal(entity1.PartitionKey['_']);
          result.entries[0].RowKey['_'].should.equal(entity1.RowKey['_']);
          result.entries[0].field['_'].should.equal(entity1.field['_']);
          result.entries[0].otherfield['_'].should.equal(entity1.otherfield['_']);
          result.entries[0].otherprops['_'].should.equal(entity1.otherprops['_']);
          result.entries[0].gb18030['_'].should.equal(entity1.gb18030['_']);

          done();
        });
      });
    });
  });
});