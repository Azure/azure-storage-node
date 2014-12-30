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
var _ = require('underscore');

// Test includes
var testutil = require('../../framework/util');
var tabletestutil = require('./table-test-utils');
var TestSuite = require('../../framework/test-suite');

// Lib includes
var azure = testutil.libRequire('azure-storage');
var azureutil = testutil.libRequire('common/util/util');
var eg = azure.TableUtilities.entityGenerator;

var TableUtilities = azure.TableUtilities;
var QueryComparisons = TableUtilities.QueryComparisons;

var TableQuery = azure.TableQuery;

var tableNamePrefix = 'tabledatatype';
var tableService;
var tableName;

var suite = new TestSuite('tableservice-datatype-tests');

var stringVal = 'mystring';
var int64Val = '4294967296';
var int32Val = 123;
var doubleVal = 123.45;
var boolVal = false;
var dateVal = new Date(Date.UTC(2012, 10, 10, 3, 4, 5, 200));
var guidVal = 'debc44d5-04a9-42ea-ab2f-4e2cb49ff833';
var binaryVal = new Buffer(3);
binaryVal[0] = 0x01;
binaryVal[1] = 0x02;
binaryVal[2] = 50;

var entity = {
  PartitionKey: { _: '1'},
  RowKey: { _: '3'},
  Int32Value: {
    _: int32Val
  },
  DoubleValue: {
    _: doubleVal
  },
  BoolValue: {
    _: boolVal
  },
  StringValue: {
    _: stringVal
  },
  DateValue: {
    _: dateVal,
    $: 'Edm.DateTime' 
  },
  GuidValue: {
    _: guidVal,
    $: 'Edm.Guid' 
  },
  Int64Value: {
    _: int64Val,
    $: 'Edm.Int64' 
  },
  BinaryValue: {
    _: binaryVal,
    $: 'Edm.Binary' 
  },
};

describe('tabledatatype-tests', function () {
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

  beforeEach(function (done) {
    suite.setupTest(done);
  });

  afterEach(function (done) {
    suite.teardownTest(done);
  });

  describe('prepare a table for data type tests', function () {
    it('should create a table for data type tests', function(done) {
      tableName = suite.getName(tableNamePrefix).replace(/-/g,'');
      tableService.createTable(tableName, function () {
        tableService.insertEntity(tableName, entity, function (err) {
          assert.equal(err, null);
          done();
        });
      });
    });
  });

  describe('QueryWithWhereString', function () {
    it('filterHelper', function (done) {
      var tableQuery = new TableQuery().where(TableQuery.stringFilter('StringValue', QueryComparisons.EQUAL, stringVal));
      assert.equal('StringValue eq \'mystring\'', tableQuery.toQueryObject()['$filter']);

      tableService.queryEntities(tableName, tableQuery, null, function (err, results) {
        assert.equal(err, null);
        assert.notEqual(results, null);
        assert.equal(results.entries.length, 1);
        assert.strictEqual(stringVal, results.entries[0].StringValue._);
        done();
      });
    }) 

    it('queryStringWithoutType', function (done) {
      var tableQuery = new TableQuery().where('StringValue == ?', stringVal);
      assert.equal('StringValue eq \'mystring\'', tableQuery.toQueryObject()['$filter']);

      tableService.queryEntities(tableName, tableQuery, null, function (err, results) {
        assert.equal(err, null);
        assert.notEqual(results, null);
        assert.equal(results.entries.length, 1);
        assert.strictEqual(stringVal, results.entries[0].StringValue._);
        done();
      });
    }) 

    it('queryStringWithType', function (done) {
      var tableQuery = new TableQuery().where('StringValue == ?string?', stringVal);
      assert.equal('StringValue eq \'mystring\'', tableQuery.toQueryObject()['$filter']);

      tableService.queryEntities(tableName, tableQuery, null, function (err, results) {
        assert.equal(err, null);
        assert.notEqual(results, null);
        assert.equal(results.entries.length, 1);
        assert.strictEqual(stringVal, results.entries[0].StringValue._);
        done();
      });
    }) 
  });

  describe('QueryWithWhereDateTime', function () {
    it('filterHelper', function (done) {
      var tableQuery = new TableQuery().where(TableQuery.dateFilter('DateValue', QueryComparisons.EQUAL, dateVal));
      assert.equal('DateValue eq datetime\'2012-11-10T03:04:05.200Z\'', tableQuery.toQueryObject()['$filter']);

      tableService.queryEntities(tableName, tableQuery, null, function (err, results) {
        assert.equal(err, null);
        assert.notEqual(results, null);
        assert.equal(results.entries.length, 1);
        assert.strictEqual(dateVal.toISOString(), results.entries[0].DateValue._.toISOString());
        done();
      });
    }) 

    it('queryStringWithoutType', function (done) {
       var tableQuery = new TableQuery().where('DateValue == ?', dateVal);
      assert.equal('DateValue eq datetime\'2012-11-10T03:04:05.200Z\'', tableQuery.toQueryObject()['$filter']);

      tableService.queryEntities(tableName, tableQuery, null, function (err, results) {
        assert.equal(err, null);
        assert.notEqual(results, null);
        assert.equal(results.entries.length, 1);
        assert.strictEqual(dateVal.toISOString(), results.entries[0].DateValue._.toISOString());
        done();
      });
    }) 

    it('queryStringWithType', function (done) {
      var tableQuery = new TableQuery().where('DateValue == ?date?', dateVal);
      assert.equal('DateValue eq datetime\'2012-11-10T03:04:05.200Z\'', tableQuery.toQueryObject()['$filter']);

      tableService.queryEntities(tableName, tableQuery, null, function (err, results) {
        assert.equal(err, null);
        assert.notEqual(results, null);
        assert.equal(results.entries.length, 1);
        assert.strictEqual(dateVal.toISOString(), results.entries[0].DateValue._.toISOString());
        done();
      });
    }) 
  });

  describe('QueryWithWhereBoolean', function () {
    it('filterHelper', function (done) {
      var tableQuery = new TableQuery().where(TableQuery.booleanFilter('BoolValue', QueryComparisons.EQUAL, boolVal));
      assert.equal('BoolValue eq false', tableQuery.toQueryObject()['$filter']);

      tableService.queryEntities(tableName, tableQuery, null, function (err, results) {
        assert.equal(err, null);
        assert.notEqual(results, null);
        assert.equal(results.entries.length, 1);
        assert.strictEqual(boolVal, results.entries[0].BoolValue._);
        done();
      });
    }) 

    it('queryStringWithoutType', function (done) {
      var tableQuery = new TableQuery().where('BoolValue == ?', boolVal);
      assert.equal('BoolValue eq false', tableQuery.toQueryObject()['$filter']);

      tableService.queryEntities(tableName, tableQuery, null, function (err, results) {
        assert.equal(err, null);
        assert.notEqual(results, null);
        assert.equal(results.entries.length, 1);
        assert.strictEqual(boolVal, results.entries[0].BoolValue._);
        done();
      });
    }) 

    it('queryStringWithType', function (done) {
      var tableQuery = new TableQuery().where('BoolValue == ?bool?', boolVal);
      assert.equal('BoolValue eq false', tableQuery.toQueryObject()['$filter']);

      tableService.queryEntities(tableName, tableQuery, null, function (err, results) {
        assert.equal(err, null);
        assert.notEqual(results, null);
        assert.equal(results.entries.length, 1);
        assert.strictEqual(boolVal, results.entries[0].BoolValue._);
        done();
      });
    }) 
  });

  describe('QueryWithWhereInt32', function () {
    it('filterHelper', function (done) {
      var tableQuery = new TableQuery().where(TableQuery.int32Filter('Int32Value', QueryComparisons.EQUAL, int32Val));
      assert.equal('Int32Value eq 123', tableQuery.toQueryObject()['$filter']);

      tableService.queryEntities(tableName, tableQuery, null, function (err, results) {
        assert.equal(err, null);
        assert.notEqual(results, null);
        assert.equal(results.entries.length, 1);
        assert.strictEqual(int32Val, results.entries[0].Int32Value._);
        done();
      });
    }) 

    it('queryStringWithoutType', function (done) {
      var tableQuery = new TableQuery().where('Int32Value == ?', int32Val);
      assert.equal('Int32Value eq 123', tableQuery.toQueryObject()['$filter']);

      tableService.queryEntities(tableName, tableQuery, null, function (err, results) {
        assert.equal(err, null);
        assert.notEqual(results, null);
        assert.equal(results.entries.length, 1);
        assert.strictEqual(int32Val, results.entries[0].Int32Value._);
        done();
      });
    }) 

    it('queryStringWithType', function (done) {
      var tableQuery = new TableQuery().where('Int32Value == ?int32?', int32Val);
      assert.equal('Int32Value eq 123', tableQuery.toQueryObject()['$filter']);

      tableService.queryEntities(tableName, tableQuery, null, function (err, results) {
        assert.equal(err, null);
        assert.notEqual(results, null);
        assert.equal(results.entries.length, 1);
        assert.strictEqual(int32Val, results.entries[0].Int32Value._);
        done();
      });
    }) 
  });

  describe('QueryWithWhereDouble', function () {
    it('filterHelper', function (done) {
      var tableQuery = new TableQuery().where(TableQuery.doubleFilter('DoubleValue', QueryComparisons.EQUAL, doubleVal));
      assert.equal('DoubleValue eq 123.45', tableQuery.toQueryObject()['$filter']);

      tableService.queryEntities(tableName, tableQuery, null, function (err, results) {
        assert.equal(err, null);
        assert.notEqual(results, null);
        assert.equal(results.entries.length, 1);
        assert.strictEqual(doubleVal, results.entries[0].DoubleValue._);
        done();
      });
    }) 

    it('queryStringWithoutType', function (done) {
      var tableQuery = new TableQuery().where('DoubleValue == ?', doubleVal);
      assert.equal('DoubleValue eq 123.45', tableQuery.toQueryObject()['$filter']);

      tableService.queryEntities(tableName, tableQuery, null, function (err, results) {
        assert.equal(err, null);
        assert.notEqual(results, null);
        assert.equal(results.entries.length, 1);
        assert.strictEqual(doubleVal, results.entries[0].DoubleValue._);
        done();
      });
    }) 

    it('queryStringWithType', function (done) {
      var tableQuery = new TableQuery().where('DoubleValue == ?double?', doubleVal);
      assert.equal('DoubleValue eq 123.45', tableQuery.toQueryObject()['$filter']);

      tableService.queryEntities(tableName, tableQuery, null, function (err, results) {
        assert.equal(err, null);
        assert.notEqual(results, null);
        assert.equal(results.entries.length, 1);
        assert.strictEqual(doubleVal, results.entries[0].DoubleValue._);
        done();
      });
    }) 
  });

  describe('QueryWithWhereInt64', function () {
    it('filterHelper', function (done) {
      var tableQuery = new TableQuery().where(TableQuery.int64Filter('Int64Value', QueryComparisons.EQUAL, int64Val));
      assert.equal('Int64Value eq 4294967296L', tableQuery.toQueryObject()['$filter']);

      tableService.queryEntities(tableName, tableQuery, null, function (err, results) {
        assert.equal(err, null);
        assert.notEqual(results, null);
        assert.equal(results.entries.length, 1);
        assert.strictEqual(int64Val, results.entries[0].Int64Value._);
        done();
      });
    }) 

    // query string without type won't work

    it('queryStringWithType', function (done) {
      var tableQuery = new TableQuery().where('Int64Value == ?int64?', int64Val);
      assert.equal('Int64Value eq 4294967296L', tableQuery.toQueryObject()['$filter']);

      tableService.queryEntities(tableName, tableQuery, null, function (err, results) {
        assert.equal(err, null);
        assert.notEqual(results, null);
        assert.equal(results.entries.length, 1);
        assert.strictEqual(int64Val, results.entries[0].Int64Value._);
        done();
      });
    }) 
  });

  describe('QueryWithWhereGuid', function () {
    it('filterHelper', function (done) {
      var tableQuery = new TableQuery().where(TableQuery.guidFilter('GuidValue', QueryComparisons.EQUAL, guidVal));
      assert.equal('GuidValue eq guid\'' + guidVal + '\'', tableQuery.toQueryObject()['$filter']);

      tableService.queryEntities(tableName, tableQuery, null, function (err, results) {
        assert.equal(err, null);
        assert.notEqual(results, null);
        assert.equal(results.entries.length, 1);
        assert.strictEqual(guidVal, results.entries[0].GuidValue._);
        done();
      });
    }) 

    // query string without type won't work

    it('queryStringWithType', function (done) {
      var tableQuery = new TableQuery().where('GuidValue == ?guid?', guidVal);
      assert.equal('GuidValue eq guid\'' + guidVal + '\'', tableQuery.toQueryObject()['$filter']);

      tableService.queryEntities(tableName, tableQuery, null, function (err, results) {
        assert.equal(err, null);
        assert.notEqual(results, null);
        assert.equal(results.entries.length, 1);
        assert.strictEqual(guidVal, results.entries[0].GuidValue._);
        done();
      });
    }) 
  });

  describe('QueryWithWhereBinary', function () {
    it('filterHelper', function (done) {     
      var tableQuery = new TableQuery().where(TableQuery.binaryFilter('BinaryValue', QueryComparisons.EQUAL, binaryVal));
      assert.equal('BinaryValue eq X\'010232\'', tableQuery.toQueryObject()['$filter']);

      tableService.queryEntities(tableName, tableQuery, null, function (err, results) {
        assert.equal(err, null);
        assert.notEqual(results, null);
        assert.equal(results.entries.length, 1);
        assert.strictEqual(binaryVal.toString(), results.entries[0].BinaryValue._.toString());
        done();
      });
    }) 

    // query string without type won't work

    it('queryStringWithType', function (done) {
      var tableQuery = new TableQuery().where('BinaryValue == ?binary?', binaryVal);
      assert.equal('BinaryValue eq X\'010232\'', tableQuery.toQueryObject()['$filter']);

      tableService.queryEntities(tableName, tableQuery, null, function (err, results) {
        assert.equal(err, null);
        assert.notEqual(results, null);
        assert.equal(results.entries.length, 1);
        assert.strictEqual(binaryVal.toString(), results.entries[0].BinaryValue._.toString());
        done();
      });
    }) 
  });

  describe('delete the table for data type tests', function () {
    it('should create a table for data type tests', function(done) {
      tableService.deleteTableIfExists(tableName, function (err) {
        assert.equal(err, null);
        done(err);
      });
    });
  });
});