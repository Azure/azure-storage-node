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
// Module Includes
var assert = require('assert');
var guid = require('node-uuid');

// Test includes
var testutil = require('../../framework/util');
var tabletestutil = require('./table-test-utils');

// Lib includes
var azure = testutil.libRequire('azure-storage');
var azureutil = testutil.libRequire('common/util/util');
var SR = azure.SR;
var TableBatch = azure.TableBatch;
var TableQuery = azure.TableQuery;
var eg = azure.TableUtilities.entityGenerator;
var HttpConstants = azure.Constants.HttpConstants;

var tableService;
var tablePrefix = 'batchtests';
var tableNamePrefix;

var tables = [];
var tableName1;
var tableName2;

function listTables (prefix, options, token, callback) {
  tableService.listTablesSegmentedWithPrefix(prefix, token, options, function(error, result) {
    assert.equal(error, null);
    tables.push.apply(tables, result.entries);
    var token = result.continuationToken;
    if(token) {
      listTables(prefix, options, token, callback);
    }
    else {
      callback();
    }
  });
}

function generateEntities(count) {
  var entities = [];
  
  for(var i = 0 ; i < count ; i++) {
    var entity = {
      PartitionKey: eg.String('partition1'),
      RowKey: eg.String('row' + (i + 1).toString()),
      StringProperty: eg.String('stringSample'),
      BooleanProperty: eg.Boolean(true),
      BinaryProperty: eg.Binary(new Buffer('SampleStringInBuffer!')),
      Int32Property: eg.Int32(42),
      Int64Property: eg.Int64('5432873627392'),
      DoubleProperty: eg.Double(4.81516),
      DateTimeProperty: eg.DateTime(new Date(2014, 04, 07, 08, 20, 53)),
    };

    entities.push(entity);
  }

  return entities;
};

function insertEntities (tableService, table, entities, callback) {
  var batch = new TableBatch();
  var returnEntities = [];

  for(var i = 0; i < entities.length; i++) {
    batch.insertEntity(entities[i], {echoContent: true});
  }

  tableService.executeBatch(table, batch, function (error, insertEntities, response) {
    assert.equal(error, null);
    assert.notEqual(insertEntities, null);
    assert.equal(response.statusCode, HttpConstants.HttpResponseCodes.Accepted);

    for(var i = 0; i < insertEntities.length; i++) {
      returnEntities.push(insertEntities[i].entity);
    }

    callback(returnEntities);
  });
}

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

describe('batchserviceclient-tests', function () {
  before(function (done) {
    tableService = azure.createTableService()
      .withFilter(new azure.ExponentialRetryPolicyFilter());

    done();
  });

  beforeEach(function (done) {
    tableNamePrefix = (tablePrefix + guid.v1()).replace(/-/g,'');
    tableName1 = tableNamePrefix + '1';
    tableName2 = tableNamePrefix + '2';
    done();
  });

  afterEach(function (done) {
    listTables(tablePrefix, null, null, function() {
      var deleteTables = function(tablesToDelete) {
        if (tablesToDelete.length === 0) {
          done();
        } else {
          tableService.deleteTable(tablesToDelete[0], function (createError, table, createResponse) {
            deleteTables(tablesToDelete.slice(1));
          });
        }
      };

      deleteTables(tables.slice(0));
    });
  });

  describe('BatchUtilities', function () {
    it('remove', function (done) {

        var batch = new TableBatch();
        var entities = generateEntities(3);
        batch.insertEntity(entities[0]);
        batch.insertEntity(entities[1]);
        batch.insertEntity(entities[2]);

        assert.ok(batch.hasOperations());
        assert.equal(batch.operations.length, 3);

        var removed = batch.removeOperation(1);
        assert.ok(batch.hasOperations());
        assert.equal(batch.operations.length, 2);
        assert.equal(removed.entity.RowKey._, 'row2');

        removed = batch.removeOperation(3);
        assert.equal(removed, null);
        assert.equal(batch.operations.length, 2);

        done();
    });

    it('add', function (done) {
      var batch = new TableBatch();
      var entities = generateEntities(2);
      batch.addOperation('INSERT', entities[0], {echoContent: true});
      batch.addOperation('INSERT_OR_REPLACE', entities[1]);

      assert.ok(batch.hasOperations());
      assert.equal(batch.operations.length, 2);

      assert.equal(batch.operations[0].options.echoContent, true)
      assert.equal(batch.operations[0].type, 'INSERT')

      assert.ok(batch.operations[1].options)
      assert.equal(batch.operations[1].type, 'INSERT_OR_REPLACE')

      done();
    });

    it('get', function (done) {
        var batch = new TableBatch();
        var entities = generateEntities(3);
        batch.insertEntity(entities[0]);
        batch.insertEntity(entities[1]);
        batch.insertEntity(entities[2]);

        assert.ok(batch.hasOperations());
        assert.equal(batch.operations.length, 3);

        var retrieved = batch.getOperation(0);
        assert.ok(retrieved);

        retrieved = batch.getOperation(3);
        assert.equal(retrieved, null);

        done();
    });

    it('retrieveLock', function (done) {
      var batch = new TableBatch();
      var entities = generateEntities(2);
      batch.retrieveEntity(entities[0].PartitionKey._, entities[0].RowKey._);
      assert.ok(batch.hasOperations());

      assert.throws(function () { batch.insertEntity(entities[1]); }, 
        function (err) {return (err instanceof Error) && err.message === SR.BATCH_ONE_RETRIEVE});

      batch.removeOperation(0);
      assert.equal(batch.hasOperations(), false);

      batch.insertEntity(entities[1]);

      done();
    });

    it('partitionKeyLock', function (done) {
      var batch = new TableBatch();
      var entities = generateEntities(2);
      batch.insertEntity(entities[0]);
      assert.ok(batch.hasOperations());
      assert.ok(batch.pk);

      entities[1].PartitionKey._ = 'foo';
      assert.throws(function () { batch.insertEntity(entities[1]); }, 
        function (err) {return (err instanceof Error) && err.message === SR.BATCH_ONE_PARTITION_KEY});

      batch.removeOperation(0);
      assert.equal(batch.hasOperations(), false);
      assert.equal(batch.pk, null);

      batch.insertEntity(entities[1]);

      done();
    });

  });

  describe('Insert', function () {
    it('shouldWork', function (done) {
      tableService.createTable(tableName1, function (createError, table, createResponse) {
        assert.equal(createError, null);
        assert.notEqual(table, null);
        assert.ok(createResponse.isSuccessful);
        assert.equal(createResponse.statusCode, HttpConstants.HttpResponseCodes.NoContent);
        assert.strictEqual(table.TableName, tableName1);

        // check that the table exists
        var batch = new TableBatch();
        var entity = generateEntities(1)[0];

        assert.notEqual(batch.hasOperations(), true);
        batch.insertEntity(entity);
        assert.ok(batch.hasOperations());

        tableService.executeBatch(tableName1, batch, function (error, operationResponses, response) {
          assert.equal(error, null);
          assert.notEqual(operationResponses, null);
          assert.ok(response.isSuccessful);
          assert.equal(response.statusCode, HttpConstants.HttpResponseCodes.Accepted);

          assert.ok(batch.hasOperations());

          tableService.retrieveEntity(tableName1, entity.PartitionKey['_'], entity.RowKey['_'], function (error4, entityResult) {
            assert.equal(error4, null);

            assert.notEqual(entityResult, null);
            compareEntities(entityResult, entity);

            done();
          });
        });
      });
    });

    it('conflict', function (done) {
      tableService.createTable(tableName1, function (createError, table, createResponse) {
        assert.equal(createError, null);
        assert.notEqual(table, null);
        assert.ok(createResponse.isSuccessful);
        assert.equal(createResponse.statusCode, HttpConstants.HttpResponseCodes.NoContent);
        assert.strictEqual(table.TableName, tableName1);

        var entities = generateEntities(1);

        insertEntities(tableService, tableName1, entities, function (entities) {
          var batch = new TableBatch();
          var insertEntity = entities[0];

          batch.insertEntity(insertEntity);
          assert.ok(batch.hasOperations());

          tableService.executeBatch(tableName1, batch, function (error, operationResponses, response) {
            assert.notEqual(error, null);
            assert.equal(error.code, 'EntityAlreadyExists');
            assert.equal(operationResponses, null);
            assert.equal(response.isSuccessful, false);
            assert.equal(response.statusCode, HttpConstants.HttpResponseCodes.Conflict);
            done();
          });
        });
      });
    });
  });

  describe('Retrieve', function () {
    it('shouldWork', function (done) {
      tableService.createTable(tableName1, function (createError, table, createResponse) {
        assert.equal(createError, null);
        assert.notEqual(table, null);
        assert.ok(createResponse.isSuccessful);
        assert.equal(createResponse.statusCode, HttpConstants.HttpResponseCodes.NoContent);
        assert.strictEqual(table.TableName, tableName1);

        var entity = generateEntities(1)[0];

        tableService.insertEntity(tableName1, entity, function (insertError, insertEntity, insertResponse) {
          assert.equal(insertError, null);
          assert.notEqual(insertEntity, null);
          assert.ok(insertResponse.isSuccessful);
          assert.equal(insertResponse.statusCode, HttpConstants.HttpResponseCodes.NoContent);
          
          var batch = new TableBatch();
          assert.notEqual(batch.hasOperations(), true);
          batch.retrieveEntity(entity.PartitionKey._, entity.RowKey._);
          assert.ok(batch.hasOperations());

          tableService.executeBatch(tableName1, batch, function (error, operationResponses, response) {
            assert.equal(error, null);
            assert.notEqual(operationResponses, null);
            assert.ok(response.isSuccessful);
            assert.equal(response.statusCode, HttpConstants.HttpResponseCodes.Accepted);

            assert.equal(operationResponses.length, 1);
            compareEntities(operationResponses[0].entity, entity)

            done();
          });
        });
      });
    });

    it('resourceNotFound', function (done) {
      tableService.createTable(tableName1, function (createError, table, createResponse) {
        assert.equal(createError, null);
        assert.notEqual(table, null);
        assert.ok(createResponse.isSuccessful);
        assert.equal(createResponse.statusCode, HttpConstants.HttpResponseCodes.NoContent);
        assert.strictEqual(table.TableName, tableName1);

        var entity = generateEntities(1)[0];
          
        var batch = new TableBatch();
        assert.notEqual(batch.hasOperations(), true);
        batch.retrieveEntity(entity.PartitionKey._, entity.RowKey._);
        assert.ok(batch.hasOperations());

        tableService.executeBatch(tableName1, batch, function (error, operationResponses, response) {
          assert.notEqual(error, null);
          assert.equal(error.code, 'ResourceNotFound');
          assert.equal(operationResponses, null);
          assert.equal(response.isSuccessful, false);
          assert.equal(response.statusCode, HttpConstants.HttpResponseCodes.NotFound);

          done();
        });
      });
    });
  });

  describe('BadBatches', function () {
    it('Empty', function (done) {
      tableService.createTable(tableName1, function (createError, table, createResponse) {
        assert.equal(createError, null);
        assert.notEqual(table, null);
        assert.ok(createResponse.isSuccessful);
        assert.equal(createResponse.statusCode, HttpConstants.HttpResponseCodes.NoContent);
        assert.strictEqual(table.TableName, tableName1);

        var batch = new TableBatch();

        assert.throws(function () { tableService.executeBatch(tableName1, batch, function () {}); }, 
          function (err) {return (err instanceof Error) && err.message === SR.EMPTY_BATCH});

        done();
      });
    });

    it('TooManyOperations', function (done) {
      tableService.createTable(tableName1, function (createError, table, createResponse) {
        assert.equal(createError, null);
        assert.notEqual(table, null);
        assert.ok(createResponse.isSuccessful);
        assert.equal(createResponse.statusCode, HttpConstants.HttpResponseCodes.NoContent);
        assert.strictEqual(table.TableName, tableName1);

        var entities = generateEntities(101);

        var batch = new TableBatch();
        for (var i = 0; i < 100; i++) {
          batch.insertEntity(entities[i]);
        }
       
        assert.throws(function () { batch.insertEntity(entities[100]); }, 
          function (err) {return (err instanceof Error) && err.message === SR.BATCH_TOO_LARGE});
        done();
      });
    });

    it('BadOperations', function (done) {
      tableService.createTable(tableName1, function (createError, table, createResponse) {
        assert.equal(createError, null);
        assert.notEqual(table, null);
        assert.ok(createResponse.isSuccessful);
        assert.equal(createResponse.statusCode, HttpConstants.HttpResponseCodes.NoContent);
        assert.strictEqual(table.TableName, tableName1);

        var batch = new TableBatch();

        assert.throws(function () { batch.insertEntity(null); }, 
          /Required argument entity for function addOperation is not defined/);
        assert.throws(function () { batch.insertEntity('foo'); }, 
          /Parameter entity for function addOperation should be an object/);
        
        assert.throws(function () { batch.insertEntity({}); }, 
          /Required argument entity.PartitionKey for function addOperation is not defined/);
        assert.throws(function () { batch.insertEntity({PartitionKey: 'foo'}); }, 
          /Parameter entity.PartitionKey for function addOperation should be an object/);
        assert.throws(function () { batch.insertEntity({PartitionKey: eg.String('foo')}); }, 
          /Required argument entity.RowKey for function addOperation is not defined/);
        assert.throws(function () { batch.insertEntity({PartitionKey:  eg.String('foo'), RowKey: 'foo'}); }, 
          /Parameter entity.RowKey for function addOperation should be an object/);
        
        done();
      });
    });

    it('SameEntity', function (done) {
      tableService.createTable(tableName1, function (createError, table, createResponse) {
        assert.equal(createError, null);
        assert.notEqual(table, null);
        assert.ok(createResponse.isSuccessful);
        assert.equal(createResponse.statusCode, HttpConstants.HttpResponseCodes.NoContent);
        assert.strictEqual(table.TableName, tableName1);

        var entity = generateEntities(1)[0];
        var batch = new TableBatch();

        batch.insertEntity(entity);

        // Doing an update on the same entity within the same batch should make the batch fail
        entity.MyField = eg.String('othervalue');
        batch.updateEntity(entity);

        tableService.executeBatch(tableName1, batch, function (error, operationResponses, response) {
          assert.notEqual(error, null);
          assert.equal(error.code, 'InvalidInput');
          assert.equal(operationResponses, null);
          assert.equal(response.isSuccessful, false);
          assert.equal(response.statusCode, HttpConstants.HttpResponseCodes.BadRequest);

          done();
        });
      });
    });
  });

  it('MaxOperations', function (done) {
    tableService.createTable(tableName1, function (createError, table, createResponse) {
      assert.equal(createError, null);
      assert.notEqual(table, null);
      assert.ok(createResponse.isSuccessful);
      assert.equal(createResponse.statusCode, HttpConstants.HttpResponseCodes.NoContent);
      assert.strictEqual(table.TableName, tableName1);

      var entities = generateEntities(100);

      var batch = new TableBatch();
      for (var i = 0; i < 100; i++) {
        batch.insertEntity(entities[i]);
      }
      assert.ok(batch.hasOperations());

      tableService.executeBatch(tableName1, batch, function (error, operationResponses, response) {
        assert.equal(error, null);
        assert.notEqual(operationResponses, null);
        assert.ok(response.isSuccessful);
        assert.equal(response.statusCode, HttpConstants.HttpResponseCodes.Accepted);

        assert.ok(batch.hasOperations());

        tableService.queryEntities(tableName1, null, null, function (error4, entities1) {
          assert.equal(error4, null);
          assert.notEqual(entities1, null);

          assert.notEqual(entities1.entries, null);
          assert.equal(entities1.entries.length, 100);

          for (var i = 0; i < 100; i++) {
            // ignore row key to make comparison easier
            delete entities1.entries[i].RowKey;
            delete entities[i].RowKey;
            compareEntities(entities1.entries[i], entities[i]);
          } 

          done();
        });
      });
    });
  });

  it('AllOperations', function (done) {
    tableService.createTable(tableName1, function (createError, table, createResponse) {
      assert.equal(createError, null);
      assert.notEqual(table, null);
      assert.ok(createResponse.isSuccessful);
      assert.equal(createResponse.statusCode, HttpConstants.HttpResponseCodes.NoContent);
      assert.strictEqual(table.TableName, tableName1);

      var entities = generateEntities(6);

      var insertEntity = entities[0];
      var insertOrMergeEntity = entities[1];
      var insertOrReplaceEntity = entities[2];

      insertEntities(tableService, tableName1, entities.slice(3), function (entities) {
        var mergeEntity = entities[0];
        mergeEntity.StringProperty._ = 'newProperty';
        
        var updateEntity = entities[1];
        delete updateEntity.BooleanProperty;

        var deleteEntity = entities[2];

        var batch = new TableBatch();
        assert.notEqual(batch.hasOperations(), true);

        batch.insertEntity(insertEntity);
        batch.deleteEntity(deleteEntity);
        batch.mergeEntity(mergeEntity);
        batch.updateEntity(updateEntity);
        batch.insertOrMergeEntity(insertOrMergeEntity);
        batch.insertOrReplaceEntity(insertOrReplaceEntity);

        assert.ok(batch.hasOperations());

        tableService.executeBatch(tableName1, batch, function (error, operationResponses, response) {
          assert.equal(error, null);
          assert.notEqual(operationResponses, null);
          assert.ok(response.isSuccessful);
          assert.equal(response.statusCode, HttpConstants.HttpResponseCodes.Accepted);

          assert.ok(batch.hasOperations());

          tableService.queryEntities(tableName1, null, null, function (error4, entities1) {
            assert.equal(error4, null);
            assert.notEqual(entities1, null);

            assert.notEqual(entities1.entries, null);
            assert.equal(entities1.entries.length, 5);

            compareEntities(entities1.entries[0], insertEntity);
            compareEntities(entities1.entries[1], insertOrMergeEntity);
            compareEntities(entities1.entries[2], insertOrReplaceEntity);
            compareEntities(entities1.entries[3], mergeEntity);
            compareEntities(entities1.entries[4], updateEntity);    

            done();
          });
        });
      });
    });
  });
});
