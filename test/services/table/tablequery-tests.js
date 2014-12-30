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

var TableQuery = azure.TableQuery;
var TableBatch = azure.TableBatch;

var QueryStringConstants = azure.Constants.QueryStringConstants;

var TableUtilities = azure.TableUtilities;
var eg = TableUtilities.entityGenerator;

var tableService;
var tablePrefix = 'querytests';

var tables = [];
var tableName;

var suite = new TestSuite('tableservice-query-tests');

function generateEntities(count) {
  var entities = [];
  
  for(var i = 0 ; i < count ; i++) {
    var entity = {
      PartitionKey: eg.String('partition1-ô- -\'-"-%20-%27-pk'),
      RowKey: eg.String('row-ô- -\'\'-"-%20-%27-rk' + (i + 1)),
      Address:  eg.String('street' + (i + 1)),
      Name:  eg.String('jennifer' + (i + 1))
    };

    entities.push(entity);
  }

  return entities;
};

function compareProperties (propFromService, prop) {
  // check type if exists
  if (propFromService['$']) {
    assert.strictEqual(propFromService['$'], prop['$']);
  }

  // check value, make sure typeof is equal as Number.NaN should not equal 'Nan'
  assert.strictEqual(typeof propFromService['_'], typeof prop['_']);
  assert.strictEqual(propFromService['_'].toString(), prop['_'].toString());
}

// The order of inputs here matters, entities from the service will have TimeStamps that we don't expect in the source.
function compareEntities (entityFromService, entity) {
  var count = 0;
  for (var propName in entityFromService) {
    if(propName === 'Timestamp') {
      assert.notEqual(entityFromService.Timestamp, null);
      count += entity.Timestamp ? 0 : 1;
    } else if (propName === '.metadata') {
      assert.notEqual(entityFromService['.metadata'], null);
      assert.notEqual(entityFromService['.metadata'].etag, null);
      count += entity['.metadata'] ? 0 : 1;
    } else {
      compareProperties(entityFromService[propName], entity[propName]);
    }
  }

  assert.strictEqual(Object.keys(entityFromService).length, Object.keys(entity).length + count);
};

describe('tablequery-tests', function () {
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
    tableName = suite.getName(tablePrefix).replace(/-/g,'');
    suite.setupTest(done);
  });

  afterEach(function (done) {
    tableService.deleteTableIfExists(tableName, function (deleteError, deleted, deleteResponse) {
      assert.equal(deleteError, null);
      assert.ok(deleteResponse.isSuccessful);

      suite.teardownTest(done);
    });
  });

  it('ReplaceOperators', function (done) {
    assert.equal(TableQuery._replaceOperators(' ==  == '), ' eq  eq ');
    assert.equal(TableQuery._replaceOperators(' >  > '), ' gt  gt ');
    assert.equal(TableQuery._replaceOperators(' <  < '), ' lt  lt ');
    assert.equal(TableQuery._replaceOperators(' >=  >= '), ' ge  ge ');
    assert.equal(TableQuery._replaceOperators(' <=  <= '), ' le  le ');
    assert.equal(TableQuery._replaceOperators(' !=  != '), ' ne  ne ');
    assert.equal(TableQuery._replaceOperators(' &&  && '), ' and  and ');
    assert.equal(TableQuery._replaceOperators(' ||  || '), ' or  or ');
    assert.equal(TableQuery._replaceOperators('! !'), 'not not');

    done();
  });

  describe('AllEntities', function () {
    it('NullQuery', function (done) {
      tableService.createTable(tableName, function (createError, table, createResponse) {
        assert.equal(createError, null);
        assert.notEqual(table, null);
        assert.ok(createResponse.isSuccessful);

        var entities = generateEntities(20);
        var batch = new TableBatch();
        entities.forEach(function (entity) {
          batch.insertEntity(entity);
        });

        tableService.executeBatch(tableName, batch, function (batchError, performBatchOperationResponses, batchResponse) {
          assert.equal(batchError, null);
          assert.notEqual(performBatchOperationResponses, null);
          assert.notEqual(batchResponse, null);
          assert.ok(batchResponse.isSuccessful);

          tableService.queryEntities(tableName, null, null, function (queryError, queryResult, queryResponse) {
            assert.equal(queryError, null);
            assert.ok(queryResponse.isSuccessful);
            assert.ok(queryResult.entries);
            assert.equal(queryResult.entries.length, 20);

            done();
          });
        });
      });
    });

    it('UndefinedQuery', function (done) {
      tableService.createTable(tableName, function (createError, table, createResponse) {
        assert.equal(createError, null);
        assert.notEqual(table, null);
        assert.ok(createResponse.isSuccessful);

        var entities = generateEntities(20);
        var batch = new TableBatch();
        entities.forEach(function (entity) {
          batch.insertEntity(entity);
        });

        tableService.executeBatch(tableName, batch, function (batchError, performBatchOperationResponses, batchResponse) {
          assert.equal(batchError, null);
          assert.notEqual(performBatchOperationResponses, null);
          assert.notEqual(batchResponse, null);
          assert.ok(batchResponse.isSuccessful);

          tableService.queryEntities(tableName, undefined, null, function (queryError, queryResult, queryResponse) {
            assert.equal(queryError, null);
            assert.ok(queryResponse.isSuccessful);
            assert.ok(queryResult.entries);
            assert.equal(queryResult.entries.length, 20);

            done();
          });
        });
      });
    });

    it('EmptyQuery', function (done) {
      tableService.createTable(tableName, function (createError, table, createResponse) {
        assert.equal(createError, null);
        assert.notEqual(table, null);
        assert.ok(createResponse.isSuccessful);

        var entities = generateEntities(20);
        var batch = new TableBatch();
        entities.forEach(function (entity) {
          batch.insertEntity(entity);
        });

        tableService.executeBatch(tableName, batch, function (batchError, performBatchOperationResponses, batchResponse) {
          assert.equal(batchError, null);
          assert.notEqual(performBatchOperationResponses, null);
          assert.notEqual(batchResponse, null);
          assert.ok(batchResponse.isSuccessful);

          tableService.queryEntities(tableName, new TableQuery(), null, function (queryError, queryResult, queryResponse) {
            assert.equal(queryError, null);
            assert.ok(queryResponse.isSuccessful);
            assert.ok(queryResult.entries);
            assert.equal(queryResult.entries.length, 20);

            done();
          });
        });
      });
    });

    it('EmpytSelect', function (done) {
      tableService.createTable(tableName, function (createError, table, createResponse) {
        assert.equal(createError, null);
        assert.notEqual(table, null);
        assert.ok(createResponse.isSuccessful);

        var entities = generateEntities(20);
        var batch = new TableBatch();
        entities.forEach(function (entity) {
          batch.insertEntity(entity);
        });

        tableService.executeBatch(tableName, batch, function (batchError, performBatchOperationResponses, batchResponse) {
          assert.equal(batchError, null);
          assert.notEqual(performBatchOperationResponses, null);
          assert.notEqual(batchResponse, null);
          assert.ok(batchResponse.isSuccessful);

          tableService.queryEntities(tableName, new TableQuery().select(), null, function (queryError, queryResult, queryResponse) {
            assert.equal(queryError, null);
            assert.ok(queryResponse.isSuccessful);
            assert.ok(queryResult.entries);
            assert.equal(queryResult.entries.length, 20);

            done();
          });
        });
      });
    });
  });

  describe('RetrieveEntity', function () {
    it('ShouldWork', function (done) {
      tableService.createTable(tableName, function (createError, table, createResponse) {
        assert.equal(createError, null);
        assert.notEqual(table, null);
        assert.ok(createResponse.isSuccessful);

        var entities = generateEntities(20);
        var batch = new TableBatch();
        entities.forEach(function (entity) {
          batch.insertEntity(entity);
        });

        tableService.executeBatch(tableName, batch, function (batchError, performBatchOperationResponses, batchResponse) {
          assert.equal(batchError, null);
          assert.notEqual(performBatchOperationResponses, null);
          assert.notEqual(batchResponse, null);
          assert.ok(batchResponse.isSuccessful);

          tableService.retrieveEntity(tableName, entities[0].PartitionKey._, entities[0].RowKey._, function (queryError, entry, queryResponse) {
            assert.equal(queryError, null);
            assert.ok(queryResponse.isSuccessful);
            assert.notEqual(entry, null);
            compareEntities(entry, entities[0]);

            done();
          });
        });
      });
    });

    it('EmptyRowkey', function (done) {
      tableService.createTable(tableName, function (error) {
        assert.equal(error, null);

        var entity = {
          PartitionKey: eg.String('1'),
          RowKey: eg.String(''),
          content: eg.String('\n\nhi\n\nthere\n\n')
        };

        var entity2 = {
          PartitionKey: eg.String(''),
          RowKey: eg.String('abc'),
          content: eg.String('\n\nhi\n\nthere\n\n')
        };

        // Should perform an insert
        tableService.insertOrMergeEntity(tableName, entity, function (error2) {
          assert.equal(error2, null);

          tableService.insertOrMergeEntity(tableName, entity2, function (error3) {
            assert.equal(error3, null);
            tableService.retrieveEntity(tableName, entity.PartitionKey['_'], entity.RowKey['_'], function (error4, entityResult) {
              assert.equal(error4, null);

              assert.notEqual(entityResult, null);
              if (entityResult) {
                assert.equal(entityResult.PartitionKey['_'], entity.PartitionKey['_']);
                assert.equal(entityResult.RowKey['_'], entity.RowKey['_']);
                assert.equal(entityResult.content['_'], entity.content['_']);
              }

              done();
            });
          });
        });
      });
    });
  });

  describe('Top', function () {
    it('ConstructQueryWithTop', function (done) {
      var tableQuery = new TableQuery().top(10);
      assert.equal(10, tableQuery.toQueryObject()['$top']);
      done();
    });

    it('ShouldWork', function (done) {
      tableService.createTable(tableName, function (createError, table, createResponse) {
        assert.equal(createError, null);
        assert.notEqual(table, null);
        assert.ok(createResponse.isSuccessful);

        var entities = generateEntities(20);
        var batch = new TableBatch();
        entities.forEach(function (entity) {
          batch.insertEntity(entity);
        });

        tableService.executeBatch(tableName, batch, function (batchError, performBatchOperationResponses, batchResponse) {
          assert.equal(batchError, null);
          assert.notEqual(performBatchOperationResponses, null);
          assert.notEqual(batchResponse, null);
          assert.ok(batchResponse.isSuccessful);

          var tableQuery = new TableQuery().top(5);

          tableService.queryEntities(tableName, tableQuery, null, function (queryError1, queryResult1, queryResponse1) {
            assert.equal(queryError1, null);
            assert.ok(queryResult1.continuationToken);
            
            assert.ok(queryResult1.entries, null);
            assert.equal(queryResult1.entries.length, 5);

            assert.notEqual(queryResponse1, null);
            assert.ok(queryResponse1.isSuccessful);

            done();
          });
        });
      });
    });

    it('GreaterThanNumberEntities', function (done) {
      tableService.createTable(tableName, function (createError, table, createResponse) {
        assert.equal(createError, null);
        assert.notEqual(table, null);
        assert.ok(createResponse.isSuccessful);

        var entities = generateEntities(5);
        var batch = new TableBatch();
        entities.forEach(function (entity) {
          batch.insertEntity(entity);
        });

        tableService.executeBatch(tableName, batch, function (batchError, performBatchOperationResponses, batchResponse) {
          assert.equal(batchError, null);
          assert.notEqual(performBatchOperationResponses, null);
          assert.notEqual(batchResponse, null);
          assert.ok(batchResponse.isSuccessful);

          var tableQuery = new TableQuery().top(10);

          tableService.queryEntities(tableName, tableQuery, null, function (queryError1, queryResult1, queryResponse1) {
            assert.equal(queryError1, null);
            assert.equal(queryResult1.continuationToken, null);
            
            assert.ok(queryResult1.entries, null);
            assert.equal(queryResult1.entries.length, 5);

            assert.notEqual(queryResponse1, null);
            assert.ok(queryResponse1.isSuccessful);

            done();
          });
        });
      });
    });

    it('WithContinuation', function (done) {
      tableService.createTable(tableName, function (createError, table, createResponse) {
        assert.equal(createError, null);
        assert.notEqual(table, null);
        assert.ok(createResponse.isSuccessful);

        var entities = generateEntities(20);
        var batch = new TableBatch();
        entities.forEach(function (entity) {
          batch.insertEntity(entity);
        });

        tableService.executeBatch(tableName, batch, function (batchError, performBatchOperationResponses, batchResponse) {
          assert.equal(batchError, null);
          assert.notEqual(performBatchOperationResponses, null);
          assert.notEqual(batchResponse, null);
          assert.ok(batchResponse.isSuccessful);

          var tableQuery = new TableQuery().top(9);

          tableService.queryEntities(tableName, tableQuery, null, function (queryError1, queryResult1, queryResponse1) {
            assert.equal(queryError1, null);
            assert.ok(queryResult1.continuationToken);
            
            assert.ok(queryResult1.entries, null);
            assert.equal(queryResult1.entries.length, 9);

            assert.notEqual(queryResponse1, null);
            assert.ok(queryResponse1.isSuccessful);

            tableService.queryEntities(tableName, tableQuery, queryResult1.continuationToken, function (queryError2, queryResult2, queryResponse2) {
              assert.equal(queryError2, null);
              assert.ok(queryResult1.continuationToken);

              assert.ok(queryResult2.entries, null);
              assert.equal(queryResult2.entries.length, 9);

              assert.notEqual(queryResponse2, null);
              assert.ok(queryResponse2.isSuccessful);

              tableService.queryEntities(tableName, tableQuery, queryResult2.continuationToken, function (queryError3, queryResult3, queryResponse3) {
                assert.equal(queryError3, null);
                assert.equal(queryResult3.continuationToken, null);

                assert.ok(queryResult3.entries, null);
                assert.equal(queryResult3.entries.length, 2);

                assert.notEqual(queryResponse3, null);
                assert.ok(queryResponse3.isSuccessful);

                done();
              });
            });
          });
        });
      });
    });
  });

  describe('Select', function () {
    it('Select', function (done) {
      var tableQuery = new TableQuery().select('field1', 'field2');
      assert.equal('field1,field2', tableQuery.toQueryObject()['$select']);
      done();
    });

    it('SystemPropertiesOnly', function (done) {
      tableService.createTable(tableName, function (createError, table, createResponse) {
        assert.equal(createError, null);
        assert.notEqual(table, null);
        assert.ok(createResponse.isSuccessful);

        var entities = generateEntities(20);
        var batch = new TableBatch();
        entities.forEach(function (entity) {
          batch.insertEntity(entity);
        });

        tableService.executeBatch(tableName, batch, function (batchError, performBatchOperationResponses, batchResponse) {
          assert.equal(batchError, null);
          assert.notEqual(performBatchOperationResponses, null);
          assert.notEqual(batchResponse, null);
          assert.ok(batchResponse.isSuccessful);

          var tableQuery = new TableQuery()
            .select('PartitionKey', 'RowKey', 'Timestamp');

          tableService.queryEntities(tableName, tableQuery, null, function (queryError, queryResult, queryResponse) {
            assert.equal(queryError, null);
            assert.ok(queryResponse.isSuccessful);
            assert.ok(queryResult.entries);

            assert.equal(queryResult.entries.length, 20);
            
            queryResult.entries.forEach(function (entity) {
              assert.equal(Object.keys(entity).length, 4);
              assert.ok(entity.PartitionKey);
              assert.ok(entity.RowKey);
              assert.ok(entity.Timestamp);
              assert.ok(entity['.metadata']);
            });

            done();
          });
        });
      });
    });

    it('SingleField', function (done) {
      tableService.createTable(tableName, function (createError, table, createResponse) {
        assert.equal(createError, null);
        assert.notEqual(table, null);
        assert.ok(createResponse.isSuccessful);

        var entities = generateEntities(20);
        var batch = new TableBatch();
        entities.forEach(function (entity) {
          batch.insertEntity(entity);
        });

        tableService.executeBatch(tableName, batch, function (batchError, performBatchOperationResponses, batchResponse) {
          assert.equal(batchError, null);
          assert.notEqual(performBatchOperationResponses, null);
          assert.notEqual(batchResponse, null);
          assert.ok(batchResponse.isSuccessful);

          var tableQuery = new TableQuery()
            .select('Address');

          tableService.queryEntities(tableName, tableQuery, null, function (queryError, queryResult, queryResponse) {
            assert.equal(queryError, null);
            assert.ok(queryResponse.isSuccessful);
            assert.ok(queryResult.entries);

            assert.equal(queryResult.entries.length, 20);
            
            queryResult.entries.forEach(function (entity) {
              assert.equal(Object.keys(entity).length, 2);
              assert.ok(entity.Address)
              assert.ok(entity['.metadata']);
            });

            done();
          });
        });
      });
    });
  });

  describe('Where', function () {
    it('RowKeyAndAddress', function (done) {
      tableService.createTable(tableName, function (createError, table, createResponse) {
        assert.equal(createError, null);
        assert.notEqual(table, null);
        assert.ok(createResponse.isSuccessful);

        var entities = generateEntities(20);
        var batch = new TableBatch();
        entities.forEach(function (entity) {
          batch.insertEntity(entity);
        });

        tableService.executeBatch(tableName, batch, function (batchError, performBatchOperationResponses, batchResponse) {
          assert.equal(batchError, null);
          assert.notEqual(performBatchOperationResponses, null);
          assert.notEqual(batchResponse, null);
          assert.ok(batchResponse.isSuccessful);

          var tableQuery = new TableQuery()
            .where('Address == ?', entities[0].Address._)
            .and('RowKey == ?', entities[0].RowKey._);

          tableService.queryEntities(tableName, tableQuery, null, function (queryError, queryResult, queryResponse) {
            assert.equal(queryError, null);
            assert.ok(queryResponse.isSuccessful);
            assert.ok(queryResult.entries);

            assert.equal(queryResult.entries.length, 1);
            assert.ok(queryResult.entries[0]);
            compareEntities(queryResult.entries[0], entities[0]);

            done();
          });
        });
      });
    });

    it('AddressAndPartitionKey', function (done) {
      tableService.createTable(tableName, function (createError, table, createResponse) {
        assert.equal(createError, null);
        assert.notEqual(table, null);
        assert.ok(createResponse.isSuccessful);

        var entities = generateEntities(20);
        entities[0].Address._ = "special address";
        var batch = new TableBatch();
        entities.forEach(function (entity) {
          batch.insertEntity(entity);
        });

        tableService.executeBatch(tableName, batch, function (batchError, performBatchOperationResponses, batchResponse) {
          assert.equal(batchError, null);
          assert.notEqual(performBatchOperationResponses, null);
          assert.notEqual(batchResponse, null);
          assert.ok(batchResponse.isSuccessful);

          var tableQuery = new TableQuery()
            .where('Address == ?', entities[0].Address._)
            .and('PartitionKey == ?', entities[0].PartitionKey._);

          tableService.queryEntities(tableName, tableQuery, null, function (queryError, queryResult, queryResponse) {
            assert.equal(queryError, null);
            assert.ok(queryResponse.isSuccessful);
            assert.ok(queryResult.entries);

            assert.equal(queryResult.entries.length, 1);
            assert.ok(queryResult.entries[0]);
            compareEntities(queryResult.entries[0], entities[0]);

            done();
          });
        });
      });
    });
  });

  describe('WhereWithMultipleParamters', function () {
    it('QueryWithParameterArray', function (done) {
      var tableQuery = new TableQuery().where('Name == ? or Name == ?', 'Person1', 'Person2');
      assert.equal('Name eq \'Person1\' or Name eq \'Person2\'', tableQuery.toQueryObject()['$filter']);
      done();
    });

    it('QueryWithParameterArrayMixedTyped', function (done) {
      var tableQuery = new TableQuery().where('Name == ? or Date == ?date?', 'Person1', new Date(Date.UTC(2001, 1, 3, 4, 5, 6)));
      assert.equal('Name eq \'Person1\' or Date eq datetime\'2001-02-03T04:05:06.000Z\'', tableQuery.toQueryObject()['$filter']);
      done();
    });

    it('QueryWithParameterArrayTyped', function (done) {
      var tableQuery = new TableQuery().where('Long == ?int64? or Date == ?date?', 4294967296, new Date(Date.UTC(2001, 1, 3, 4, 5, 6)));
      assert.equal('Long eq 4294967296L or Date eq datetime\'2001-02-03T04:05:06.000Z\'', tableQuery.toQueryObject()['$filter']);
      done();
    });
  }); 

  describe('CombineWhere', function () {
    it('QueryWithCombineFilter', function (done) {
      var tableQuery = new TableQuery()
        .where(TableQuery.combineFilters('Name == \'Person\'', 'and', 'Visible eq true'));
      assert.equal('Name eq \'Person\' and Visible eq true', tableQuery.toQueryObject()['$filter']);
      done();
    });

    it('QueryWithAnd', function (done) {
      var tableQuery = new TableQuery()
        .where('Name eq ?', 'Person')
        .and('Visible eq true');
      assert.equal('Name eq \'Person\' and Visible eq true', tableQuery.toQueryObject()['$filter']);
      done();
    });

    it('QueryWithOr', function (done) {
      var tableQuery = new TableQuery()
        .where('Name eq ?', 'Person')
        .or('Visible eq true');
      assert.equal('Name eq \'Person\' or Visible eq true', tableQuery.toQueryObject()['$filter']);
      done();
    });
  });

  describe('QueryWithWhereString', function () {
    it('QueryWithWhereSingleQuoteString', function (done) {
      var tableQuery = new TableQuery().where('Name == ?', 'o\'right');
      assert.equal('Name eq \'o\'\'right\'', tableQuery.toQueryObject()['$filter']);
      done();
    });

    it('ComplexPartitionKey', function (done) {
      var complexPartitionKey = 'aHR0cDovL2ZlZWRzLmZlZWRidXJuZXIuY29tL2ppbXdhbmdzYmxvZw==';
      var tableQuery = new TableQuery().where('PartitionKey == ?', complexPartitionKey);
      var queryObject = tableQuery.toQueryObject();
      assert.notEqual(queryObject[QueryStringConstants.FILTER].indexOf(complexPartitionKey), -1);

      tableQuery = new TableQuery().where("PartitionKey == '" + complexPartitionKey + "'");
      queryObject = tableQuery.toQueryObject();
      assert.notEqual(queryObject[QueryStringConstants.FILTER].indexOf(complexPartitionKey), -1);

      done();
    });
  });
});
