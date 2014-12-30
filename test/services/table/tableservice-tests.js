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
var util = require('util');

// Test includes
var testutil = require('../../framework/util');
var tabletestutil = require('./table-test-utils');
var TestSuite = require('../../framework/test-suite');

// Lib includes
var azure = testutil.libRequire('azure-storage');
var azureutil = testutil.libRequire('common/util/util');

var TableQuery = azure.TableQuery;
var Constants = azure.Constants;
var TableUtilities = azure.TableUtilities;
var HttpConstants = Constants.HttpConstants;
var StorageErrorCodeStrings = Constants.StorageErrorCodeStrings;

var eg = TableUtilities.entityGenerator;

var entity1 = { PartitionKey: eg.String('part1'),
  RowKey: eg.String('row1'),
  field: eg.String('my field'),
  otherfield: eg.String('my other field'),
  otherprops: eg.String('my properties')
};

var entity2 = { PartitionKey: eg.String('part2'),
  RowKey: eg.String('row1'),
  boolValueTrue: eg.Boolean(true),
  boolValueFalse: eg.Boolean(false),
  intValue: eg.Int32(42),
  dateValue: eg.DateTime(new Date(Date.UTC(2011, 10, 25))),
  complexDateValue: eg.DateTime(new Date(Date.UTC(2013, 02, 16, 01, 46, 20)))
};

var tableService;

var tablePrefix = 'tableservice';

var suite = new TestSuite('tableservice-tests');
var runOrSkip = suite.isMocked ? it.skip : it;
var timeout = (suite.isRecording || !suite.isMocked) ? 30000 : 10;

var tables = [];
var tableName1;
var tableName2;

var compareProperties = function(prop1, prop2) {
  assert.strictEqual(JSON.stringify(prop1), JSON.stringify(prop2));
};

// The order of inputs here matters, entities from the service will have TimeStamps that we don't expect in the source.
var compareEntities = function (entity, entityFromService) {
  for (var propName in entity) {
    if (entity.hasOwnProperty(propName)) {
      var a = entity[propName];
      var b = entityFromService[propName];
      compareProperties(entity[propName], entityFromService[propName]);
    }
  }
};

describe('tableservice-tests', function () {
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
    tableName1 = suite.getName(tablePrefix).replace(/-/g,'');
    tableName2 = suite.getName(tablePrefix).replace(/-/g,'');
    suite.setupTest(done);
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

  it('SetDefaultPortProperly', function (done) {
    var storageAccount = 'account';
    var storageAccountKey = new Buffer('key').toString('base64');

    var service = azure.createTableService(storageAccount, storageAccountKey, 'https://account.table.core.windows.net');
    assert.equal(service.host.primaryHost, 'https://account.table.core.windows.net:443/');

    var service = azure.createTableService(storageAccount, storageAccountKey, 'https://account.table.core.windows.net:21');
    assert.equal(service.host.primaryHost, 'https://account.table.core.windows.net:21/');

    service = azure.createTableService(storageAccount, storageAccountKey, 'http://account.table.core.windows.net');
    assert.equal(service.host.primaryHost, 'http://account.table.core.windows.net:80/');

    service = azure.createTableService(storageAccount, storageAccountKey, 'http://account.table.core.windows.net:81');
    assert.equal(service.host.primaryHost, 'http://account.table.core.windows.net:81/');

    done();
  });

  describe('doesTableExist', function () {
    it('should work', function (done) {
      assert.doesNotThrow(function () { 
        tableService.doesTableExist('$MetricsMinutePrimaryTransactionsBlob', function () { 
          assert.doesNotThrow(function () { 
            tableService.doesTableExist('$MetricsTransactionsTable', function () { 
              done();
            }); 
          });     
        }); 
      });      
    });
  });

  describe('CreateTable', function () {
    it('should detect incorrect table names', function (done) {
      assert.throws(function () { tableService.createTable(null, function () { }); },
        /Required argument table for function createTable is not defined/);

      assert.throws(function () { tableService.createTable('', function () { }); },
        /Required argument table for function createTable is not defined/);

      assert.throws(function () { tableService.createTable('as', function () { }); },
        /Table name must be between 3 and 63 characters long./);

      assert.throws(function () { tableService.createTable('Tables', function () { }); },
        /Table name cannot be \'Tables\'./);

      assert.throws(function () { tableService.createTable('a--s', function () { }); },
        /Table name format is incorrect./);

      assert.throws(function () { tableService.createTable('1table', function () { }); },
        /Table name format is incorrect./);

      assert.throws(function () { tableService.createTable('$Metrics', function () { }); },
        /Table name format is incorrect./);
      
      done();
    });

    it('CreateTable', function (done) {
      tableService.createTable(tableName1, function (createError, table, createResponse) {
        assert.equal(createError, null);
        assert.notEqual(table, null);
        assert.ok(createResponse.isSuccessful);
        assert.equal(createResponse.statusCode, HttpConstants.HttpResponseCodes.NoContent);
        assert.strictEqual(table.TableName, tableName1);

        // check that the table exists
        tableService.doesTableExist(tableName1, function (existsError, tableResponse, existsResponse) {
          assert.equal(existsError, null);
          assert.notEqual(tableResponse, null);
          assert.ok(existsResponse.isSuccessful);
          assert.equal(existsResponse.statusCode, HttpConstants.HttpResponseCodes.Ok);
          done();
        });
      });
    });
  });

  it('DeleteTable', function (done) {
    tableService.createTable(tableName1, function (createError, table, createResponse) {
      assert.equal(createError, null);
      assert.notEqual(table, null);
      assert.ok(createResponse.isSuccessful);
      assert.equal(createResponse.statusCode, HttpConstants.HttpResponseCodes.NoContent);

      tableService.deleteTable(tableName1, function (deleteError, deleteResponse) {
        assert.equal(deleteError, null);
        assert.ok(deleteResponse.isSuccessful);
        assert.equal(deleteResponse.statusCode, HttpConstants.HttpResponseCodes.NoContent);
        done();
      });
    });
  });

  it('CreateTableIfNotExists', function (done) {
    tableService.createTable(tableName1, function (createError, table, createResponse) {
      assert.equal(createError, null);
      assert.notEqual(table, null);
      assert.ok(createResponse.isSuccessful);
      assert.equal(createResponse.statusCode, HttpConstants.HttpResponseCodes.NoContent);
    assert.strictEqual(table.TableName, tableName1);

      // trying to create again with if not exists should be fine
      tableService.createTableIfNotExists(tableName1, function (createError2, created2) {
        assert.equal(createError2, null);
        assert.equal(created2, false);

        done();
      });
    });
  });

  describe('listTables', function () {
    it('listTables', function (done) {
      var tables = [];
      tabletestutil.listTables(tableService, tablePrefix, tables, null, null, function() {
        assert.equal(tables.length, 0);

        tableService.createTable(tableName1, function (createError, table1, createResponse) {
          assert.equal(createError, null);
          assert.notEqual(table1, null);
          assert.equal(createResponse.statusCode, HttpConstants.HttpResponseCodes.NoContent);

          tableService.createTable(tableName2, function (createError2, table2, createResponse2) {
            assert.equal(createError2, null);
            assert.notEqual(table2, null);
            assert.equal(createResponse2.statusCode, HttpConstants.HttpResponseCodes.NoContent);

            tabletestutil.listTables(tableService, tablePrefix, tables, null, null, function() {
          
              var entries = 0;
              tables.forEach(function (currentTable) {
                if (currentTable === tableName1) {
                  entries += 1;
                }
                else if (currentTable === tableName2) {
                  entries += 2;
                }
              });

              assert.equal(entries, 3);

              done();
            });
          });
        });
      });
    });

    it('listTablesWithPrefix', function (done) {
      var includedTables = [];
      var excludedTables = [];
      var i;

      for(i = 0; i < 3; ++i) {
        includedTables.push(tableName1 + i);
        excludedTables.push(tableName2 + i);
      }

      var tables = [];
      tabletestutil.listTables(tableService, tablePrefix, tables, null, null, function() {

        var tablesToCreate = includedTables.concat(excludedTables);

        function makeTables(tablesToCreate, callback) {
          if (tablesToCreate.length === 0) {
            callback();
          } else {
            tableService.createTable(tablesToCreate[0], function (createError, table, createResponse) {
              assert.equal(createError, null);
              assert.notEqual(table, null);
              assert.equal(createResponse.statusCode, HttpConstants.HttpResponseCodes.NoContent);
              makeTables(tablesToCreate.slice(1), callback);
            });
          }
        }

        tables.length = 0;
        makeTables(tablesToCreate, function () {
          tabletestutil.listTables(tableService, tableName1, tables, null, null, function() {
            assert.notEqual(tables, null);

            var entries = includedTables.length;
            tables.forEach(function (currentTable) {
                assert.strictEqual(excludedTables.indexOf(currentTable), -1);
                assert.notEqual(includedTables.indexOf(currentTable), -1);
              --entries;
            });

            assert.equal(entries, 0);

            done();
          });
        });
      });
    });
  });

  describe('InsertEntity', function () {
    it('ShouldWork', function (done) {
      tableService.createTable(tableName1, function (createError, table, createResponse) {
        assert.equal(createError, null);
        assert.notEqual(table, null);
        assert.equal(createResponse.statusCode, HttpConstants.HttpResponseCodes.NoContent);

        tableService.insertEntity(tableName1, entity1, {echoContent: true}, function (insertError, insertEntity, insertResponse) {
          assert.equal(insertError, null);
          assert.notEqual(insertEntity, null);
          assert.ok(insertEntity['.metadata']['etag']);
          assert.equal(insertEntity['field']['_'], entity1['field']['_']);
          assert.equal(insertEntity['otherfield']['_'], entity1['otherfield']['_']);
          assert.equal(insertEntity['otherprops']['_'], entity1['otherprops']['_']);
          assert.equal(insertResponse.statusCode, HttpConstants.HttpResponseCodes.Created);

          tableService.insertEntity(tableName1, entity2, function (insertError2, insertEntity2, insertResponse2) {
            assert.equal(insertError2, null);
            assert.notEqual(insertEntity2, null);
            assert.equal(insertResponse2.statusCode, HttpConstants.HttpResponseCodes.NoContent);

            tableService.queryEntities(tableName1, null, null, function (queryError, queryResult, queryResponse) {
              assert.equal(queryError, null);
              assert.notEqual(queryResult.entries, null);
              assert.ok(queryResponse.isSuccessful);
              assert.equal(queryResponse.statusCode, HttpConstants.HttpResponseCodes.Ok);

              var entities = 0;
              var entries = queryResult.entries;
              entries.forEach(function (currentEntry) {
                if (currentEntry['PartitionKey']['_'] === entity1['PartitionKey']['_'] && currentEntry['RowKey']['_'] === entity1['RowKey']['_']) {
                  entities += 1;

                  assert.ok(currentEntry['.metadata']['etag']);
                  assert.equal(currentEntry['field']['_'], entity1['field']['_']);
                  assert.equal(currentEntry['otherfield']['_'], entity1['otherfield']['_']);
                  assert.equal(currentEntry['otherprops']['_'], entity1['otherprops']['_']);
                }
                else if (currentEntry['PartitionKey']['_'] === entity2['PartitionKey']['_'] && currentEntry['RowKey']['_'] === entity2['RowKey']['_']) {
                  entities += 2;

                  assert.ok(currentEntry['.metadata']['etag']);
                  assert.equal(currentEntry['boolValueTrue']['_'], entity2['boolValueTrue']['_']);
                  assert.equal(currentEntry['boolValueFalse']['_'], entity2['boolValueFalse']['_']);
                  assert.equal(currentEntry['intValue']['_'], entity2['intValue']['_']);

                  var date1 = currentEntry['dateValue']['_'];
                  var date2 = entity2['dateValue']['_'];
                  assert.equal(date1.getTime(), date2.getTime());

                  var date3 = currentEntry['complexDateValue']['_'];
                  var date4 = entity2['complexDateValue']['_'];
                  assert.equal(date3.getTime(), date4.getTime());
                }
              });

              assert.equal(entities, 3);

              tableService.retrieveEntity(tableName1, entity1.PartitionKey['_'], entity1.RowKey['_'], function (retrieveError, retrieveResult, retrieveResponse) {
                assert.equal(retrieveError, null);
                assert.ok(retrieveResponse.isSuccessful);
                assert.equal(retrieveResponse.statusCode, HttpConstants.HttpResponseCodes.Ok);

                assert.ok(retrieveResult['.metadata']['etag']);
                assert.equal(retrieveResult['field']['_'], entity1['field']['_']);
                assert.equal(retrieveResult['otherfield']['_'], entity1['otherfield']['_']);
                assert.equal(retrieveResult['otherprops']['_'], entity1['otherprops']['_']);

                done();
              });
            });
          });
        });
      });
    });

    it('WithHtmlSpecialChars', function (done) {
      tableService.createTable(tableName1, function (createError, table, createResponse) {
        assert.equal(createError, null);
        assert.notEqual(table, null);
        assert.equal(createResponse.statusCode, HttpConstants.HttpResponseCodes.NoContent);

        var newEntity = entity1;
        newEntity['field'] = eg.String('JSON <test> {} :{ !@#$%^&*()'); // this should work without breaking the JSON

        tableService.insertEntity(tableName1, newEntity, function (insertError, insertEntity, insertResponse) {
          assert.equal(insertError, null);
          assert.notEqual(insertEntity, null);
          assert.ok(insertResponse.isSuccessful);
          assert.equal(insertResponse.statusCode, HttpConstants.HttpResponseCodes.NoContent);

          tableService.retrieveEntity(tableName1, newEntity.PartitionKey['_'], newEntity.RowKey['_'], function (retrieveError, retrieveResult, retrieveResponse) {
            assert.equal(retrieveError, null);
            assert.notEqual(retrieveResult, null);
            assert.ok(retrieveResponse.isSuccessful);
            assert.ok(retrieveResponse.statusCode, HttpConstants.HttpResponseCodes.Ok);

            assert.equal(retrieveResult['field']['_'], newEntity['field']['_']);
            done();
          });
        });
      });
    });

    it('InsertPartitionKeyOnly', function (done) {
      tableService.createTable(tableName1, function (error1) {
        assert.equal(error1, null);

        var entity1 = {
          PartitionKey: eg.String('1'),
          RowKey: eg.String('1st'),
          field1: eg.String('value')
        };

        // entity in the same partition
        var entity2 = {
          PartitionKey: eg.String('1'),
          RowKey: eg.String('2st'),
          field1: eg.String('value')
        };

        // entity in another partition
        var entity3 = {
          PartitionKey: eg.String('2'),
          RowKey: eg.String('2st'),
          field1: eg.String('value')
        };

        // Should perform an insert
        tableService.insertEntity(tableName1, entity1, function (error2) {
          assert.equal(error2, null);

          tableService.insertEntity(tableName1, entity2, function (error3) {
            assert.equal(error3, null);

            tableService.insertEntity(tableName1, entity3, function (error4) {
              assert.equal(error4, null);

              // Create table query with passing partition key only
              var tableQuery = new TableQuery()
                .where('PartitionKey == ?', entity1.PartitionKey['_']);

              tableService.queryEntities(tableName1, tableQuery, null, function (error5, queryResult) {
                assert.equal(error5, null);

                assert.notEqual(queryResult.entries, null);
                assert.equal(queryResult.entries.length, 2);

                done();
              });
            });
          });
        });
      });
    });
  });

  describe('DeleteEntity', function () {
    it('WithoutEtag', function (done) {
      tableService.createTable(tableName1, function (createError, table, createResponse) {
        assert.equal(createError, null);
        assert.notEqual(table, null);
        assert.ok(createResponse.isSuccessful);
        assert.equal(createResponse.statusCode, HttpConstants.HttpResponseCodes.NoContent);

        tableService.insertEntity(tableName1, entity1, function (insertError, insertEntity, insertResponse) {
          assert.equal(insertError, null);
          assert.notEqual(insertEntity, null);
          assert.ok(insertResponse.isSuccessful);
          assert.equal(insertResponse.statusCode, HttpConstants.HttpResponseCodes.NoContent);

          tableService.deleteEntity(tableName1, entity1, function (deleteError, deleteResponse) {
            assert.equal(deleteError, null);
            assert.ok(deleteResponse.isSuccessful);
            assert.equal(deleteResponse.statusCode, HttpConstants.HttpResponseCodes.NoContent);

            done();
          });
        });
      });
    });

    it('WithEtag', function (done) {
      tableService.createTable(tableName1, function (createError, table, createResponse) {
        assert.equal(createError, null);
        assert.notEqual(table, null);
        assert.ok(createResponse.isSuccessful);
        assert.equal(createResponse.statusCode, HttpConstants.HttpResponseCodes.NoContent);

        tableService.insertEntity(tableName1, entity1, {echoContent: true}, function (insertError, insertEntity, insertResponse) {
          assert.equal(insertError, null);
          assert.notEqual(insertEntity, null);
          assert.ok(insertResponse.isSuccessful);
          assert.equal(insertResponse.statusCode, HttpConstants.HttpResponseCodes.Created);

          // Set a fake old etag
          entity1['.metadata']  = { etag: 'W/"datetime\'2009-05-27T12%3A15%3A15.3321531Z\'"' };

          // Delete forcing etag to be verified
          tableService.deleteEntity(tableName1, entity1, function (deleteError, deleteResponse) {
            assert.equal(deleteError.code, StorageErrorCodeStrings.UPDATE_CONDITION_NOT_SATISFIED);
            assert.equal(deleteResponse.isSuccessful, false);
            assert.equal(deleteResponse.statusCode, HttpConstants.HttpResponseCodes.PreconditionFailed);

            done();
          });
        });
      });
    });
  });

  describe('UpdateEntity', function () {
    it('WithoutEtag', function (done) {
      var newField = eg.String('value');
      tableService.createTable(tableName1, function (createError, table, createResponse) {
        assert.equal(createError, null);
        assert.notEqual(table, null);
        assert.ok(createResponse.isSuccessful);
        assert.equal(createResponse.statusCode, HttpConstants.HttpResponseCodes.NoContent);

        tableService.insertEntity(tableName1, entity1, {echoContent: true}, function (insertError, insertEntity, insertResponse) {
          assert.equal(insertError, null);
          assert.notEqual(insertEntity, null);
          assert.ok(insertResponse.isSuccessful);
          assert.equal(insertResponse.statusCode, HttpConstants.HttpResponseCodes.Created);
          
          var originalEtag = insertEntity['.metadata'].etag;
          insertEntity['.metadata'] = undefined;
          insertEntity['otherfield'] = newField;

          tableService.updateEntity(tableName1, insertEntity, function (updateError2, updateEntity2, updateResponse2) {
            assert.equal(updateError2, null);
            assert.notEqual(updateEntity2, null);
            assert.ok(updateResponse2.isSuccessful);
            assert.equal(updateResponse2.statusCode, HttpConstants.HttpResponseCodes.NoContent);
            assert.notEqual(updateEntity2['.metadata'].etag, originalEtag);

            done();
          });
        });
      });
    });

    it('WithEtag', function (done) {
      var newField = eg.String('value');
      tableService.createTable(tableName1, function (createError, table, createResponse) {
        assert.equal(createError, null);
        assert.notEqual(table, null);
        assert.ok(createResponse.isSuccessful);
        assert.equal(createResponse.statusCode, HttpConstants.HttpResponseCodes.NoContent);

        tableService.insertEntity(tableName1, entity1, {echoContent: true}, function (insertError, insertEntity, insertResponse) {
          assert.equal(insertError, null);
          assert.notEqual(insertEntity, null);
          assert.ok(insertResponse.isSuccessful);
          assert.equal(insertResponse.statusCode, HttpConstants.HttpResponseCodes.Created);

          insertEntity['otherfield'] = newField;

          // Set a fake old etag
          insertEntity['.metadata'] = { etag: 'W/"datetime\'2009-05-27T12%3A15%3A15.3321531Z\'"' };

          tableService.updateEntity(tableName1, insertEntity, function (updateError, updateEntity, updateResponse) {
            assert.equal(updateError.code, StorageErrorCodeStrings.UPDATE_CONDITION_NOT_SATISFIED);
            assert.equal(updateEntity, null);
            assert.equal(updateResponse.isSuccessful, false);
            assert.equal(updateResponse.statusCode, HttpConstants.HttpResponseCodes.PreconditionFailed);

            done();
          });
        });
      });
    });
  });

  describe('MergeEntity', function () {
    it('WithoutEtag', function (done) {
      var newField = eg.String('value');
      tableService.createTable(tableName1, function (createError, table, createResponse) {
        assert.equal(createError, null);
        assert.notEqual(table, null);
        assert.ok(createResponse.isSuccessful);
        assert.equal(createResponse.statusCode, HttpConstants.HttpResponseCodes.NoContent);

        tableService.insertEntity(tableName1, entity1, {echoContent: true}, function (insertError, insertEntity, insertResponse) {
          assert.equal(insertError, null);
          assert.notEqual(insertEntity, null);
          assert.ok(insertResponse.isSuccessful);
          assert.equal(insertResponse.statusCode, HttpConstants.HttpResponseCodes.Created);

          var originalEtag = insertEntity['.metadata'].etag;
          insertEntity['.metadata'] = undefined;
          insertEntity['otherfield'] = newField;

          tableService.mergeEntity(tableName1, insertEntity, function (mergeError, mergeEntity, mergeResponse) {
            assert.equal(mergeError, null);
            assert.notEqual(mergeEntity, null);
            assert.ok(mergeResponse.isSuccessful);
            assert.equal(mergeResponse.statusCode, HttpConstants.HttpResponseCodes.NoContent);
            assert.notEqual(mergeEntity['.metadata'].etag, originalEtag);

            done();
          });
        });
      });
    });

    it('WithEtag', function (done) {
      var newField = eg.String('value');
      tableService.createTable(tableName1, function (createError, table, createResponse) {
        assert.equal(createError, null);
        assert.notEqual(table, null);
        assert.ok(createResponse.isSuccessful);
        assert.equal(createResponse.statusCode, HttpConstants.HttpResponseCodes.NoContent);

        tableService.insertEntity(tableName1, entity1, {echoContent: true}, function (insertError, insertEntity, insertResponse) {
          assert.equal(insertError, null);
          assert.notEqual(insertEntity, null);
          assert.ok(insertResponse.isSuccessful);
          assert.equal(insertResponse.statusCode, HttpConstants.HttpResponseCodes.Created);

          insertEntity['otherfield'] = newField;

          tableService.mergeEntity(tableName1, insertEntity, function (mergeError, mergeEntity, mergeResponse) {
            assert.equal(mergeError, null);
            assert.notEqual(mergeEntity, null);
            assert.equal(mergeResponse.isSuccessful, true);
            assert.equal(mergeResponse.statusCode, HttpConstants.HttpResponseCodes.NoContent);

            // Set a fake old etag
            insertEntity['.metadata'] = { etag: 'W/"datetime\'2009-05-27T12%3A15%3A15.3321531Z\'"' };

            tableService.mergeEntity(tableName1, insertEntity, function (mergeError1, mergeEntity1, mergeResponse1) {
              assert.equal(mergeError1.code, StorageErrorCodeStrings.UPDATE_CONDITION_NOT_SATISFIED);
              assert.equal(mergeEntity1, null);
              assert.equal(mergeResponse1.isSuccessful, false);
              assert.equal(mergeResponse1.statusCode, HttpConstants.HttpResponseCodes.PreconditionFailed);
              done();
            });
          });
        });
      });
    });
  });

  describe('InsertOrReplaceEntity', function () {
    it('ShouldWork', function (done) {
      tableService.createTable(tableName1, function (error) {
        assert.equal(error, null);

        var entity = {
          PartitionKey: eg.String('1'),
          RowKey: eg.String('1'),
          field1: eg.String('value'),
          field2: eg.Int32(1)
        };

        // Should perform an insert
        tableService.insertOrReplaceEntity(tableName1, entity, function (error2) {
          assert.equal(error2, null);

          // change value of field2
          entity.field2 = eg.String(2);

          // should perform an update
          tableService.insertOrReplaceEntity(tableName1, entity, function (error3) {
            assert.equal(error3, null);

            tableService.retrieveEntity(tableName1, entity.PartitionKey['_'], entity.RowKey['_'], function (error4, entityResult) {
              assert.equal(error4, null);

              assert.notEqual(entityResult, null);
              if (entityResult) {
                assert.equal(entityResult.PartitionKey['_'], entity.PartitionKey['_']);
                assert.equal(entityResult.RowKey['_'], entity.RowKey['_']);
                assert.equal(entityResult.field1['_'], entity.field1['_']);
                assert.equal(entityResult.field2['_'], entity.field2['_']);
              }

              done();
            });
          });
        });
      });
    });
  });

  describe('InsertOrMerge', function () {
    it('ShouldWork', function (done) {
      tableService.createTable(tableName1, function (error) {
        assert.equal(error, null);

        var entity = {
          PartitionKey: eg.String('1'),
          RowKey: eg.String('1'),
          field1: eg.String('value'),
          field2: eg.Int32(1)
        };

        // Should perform an insert
        tableService.insertOrMergeEntity(tableName1, entity, function (error2) {
          assert.equal(error2, null);

          // Add a new field
          entity.field3 = eg.Int32(2);

          // should perform a merge
          tableService.insertOrMergeEntity(tableName1, entity, function (error3) {
            assert.equal(error3, null);

            tableService.retrieveEntity(tableName1, entity.PartitionKey['_'], entity.RowKey['_'], function (error4, entityResult) {
              assert.equal(error4, null);

              assert.notEqual(entityResult, null);
              if (entityResult) {
                assert.equal(entityResult.PartitionKey['_'], entity.PartitionKey['_']);
                assert.equal(entityResult.RowKey['_'], entity.RowKey['_']);
                assert.equal(entityResult.field1['_'], entity.field1['_']);
                assert.equal(entityResult.field2['_'], entity.field2['_']);
                assert.equal(entityResult.field3['_'], entity.field3['_']);
              }

              done();
            });
          });
        });
      });
    });

    it('EmptyField', function (done) {
      tableService.createTable(tableName1, function (error) {
        assert.equal(error, null);

        var entity = {
          PartitionKey: eg.String('1'),
          RowKey: eg.String('1abc'),
          field1: eg.String('value'),
          emptyField1: eg.String(''),
          emptyField2: eg.String(null),
          nonEmptyField3: eg.Int32(0)
        };

        // Should perform an insert
        tableService.insertOrMergeEntity(tableName1, entity, function (error2) {
          assert.equal(error2, null);

          tableService.retrieveEntity(tableName1, entity.PartitionKey['_'], entity.RowKey['_'], function (error4, entityResult) {
            assert.equal(error4, null);

            assert.notEqual(entityResult, null);
            if (entityResult) {
              assert.equal(entityResult.PartitionKey['_'], entity.PartitionKey['_']);
              assert.equal(entityResult.RowKey['_'], entity.RowKey['_']);
              assert.equal(entityResult.field1['_'], entity.field1['_']);
              assert.strictEqual(entityResult.emptyField1['_'], '');
              assert.strictEqual(entityResult.emptyField2, undefined);
              assert.equal(entityResult.nonEmptyField3['_'], entity.nonEmptyField3['_']);
            }

            done();
          });
        });
      });
    });

    it('NewLines', function (done) {
      tableService.createTable(tableName1, function (error) {
        assert.equal(error, null);

        var entity = {
          PartitionKey: eg.String('1'),
          RowKey: eg.String('1abc'),
          content: eg.String('\n\nhi\n\nthere\n\n')
        };

        // Should perform an insert
        tableService.insertOrMergeEntity(tableName1, entity, function (error2) {
          assert.equal(error2, null);

          tableService.retrieveEntity(tableName1, entity.PartitionKey['_'], entity.RowKey['_'], function (error4, entityResult) {
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

  describe('SAS', function () {
    runOrSkip('SASNoPolicy', function (done) {
      tableService.createTable(tableName1, function (error1) {
        assert.equal(error1, null);
        insertManyEntities(function () {  

          var startDate = new Date();
          var expiryDate = new Date(startDate);
          expiryDate.setMinutes(startDate.getMinutes() + 100);
          startDate.setMinutes(startDate.getMinutes() - 100);

          var sharedAccessPolicy = {
            AccessPolicy: {
              Permissions: TableUtilities.SharedAccessPermissions.QUERY,
              Start: startDate,
              Expiry: expiryDate,
              StartPk: '1',
              EndPk: '3',
              StartRk: '1',
              EndRk: '3'
            },
          };

          var tableSAS = tableService.generateSharedAccessSignature(tableName1, sharedAccessPolicy);
          var sharedTableService = azure.createTableServiceWithSas(tableService.host, tableSAS);

          runTableTests(sharedTableService, done);
        });
      });
    });

    // Skip this case in nock because the signing key is different between live run and mocked run
    runOrSkip('SASWithPolicy', function(done) {
      tableService.createTable(tableName1, function (error1) {
        assert.equal(error1, null);
        insertManyEntities(function () {

          var id = '011ec48e-81e1-4dc8-a6ac-e246bc547bad';
          var startDate = new Date();
          var expiryDate = new Date(startDate);
          expiryDate.setMinutes(startDate.getMinutes() + 100);
          startDate.setMinutes(startDate.getMinutes() - 100);

          var sharedAccessPolicy = {
            AccessPolicy: {
              Permissions: TableUtilities.SharedAccessPermissions.QUERY,
              Start: startDate,
              Expiry: expiryDate,
            },
            Id: id
          };

          var sharedAccessPolicyJustIdPkRkRange = {
            AccessPolicy: {
              StartPk: '1',
              EndPk: '3',
              StartRk: '1',
              EndRk: '3'
            },
            Id: id,
          };

          tableService.getTableAcl(tableName1, function(error, result, response) {
            result.signedIdentifiers.push(sharedAccessPolicy);

            tableService.setTableAcl(tableName1, result, function() {

              // Need a 30 second delay for the policy to take affect on the service.
              setTimeout(function() {
                var tableSAS = tableService.generateSharedAccessSignature(tableName1, sharedAccessPolicyJustIdPkRkRange); //sharedAccessPolicyJustId);
                var sharedTableService = azure.createTableServiceWithSas(tableService.host, tableSAS);

                runTableTests(sharedTableService, done);
              }, timeout);
            });
          });
        });
      });
    });
  });

  describe('NagleAlgorithm', function () {
    it('should work when Nagle is enabled', function (done) {
      tableService.createTable(tableName1, function (error1) {
        assert.equal(error1, null);
        var callback = function () {
          tableService.queryEntities(tableName1, null, null, function (queryError, queryResult, queryResponse) {
            assert.equal(queryError, null);
            assert.ok(queryResponse.isSuccessful);
            assert.ok(queryResult.entries);

            done();
          });
        };

        insertManyEntities(callback, {useNagleAlgorithm : true});
      });
    });
  });
});

function runTableTests(sharedTableService, done) {
  // Point query, in the valid range, should succeed.
  sharedTableService.retrieveEntity(tableName1, '2', '2', function (error, entities) {
    assert.equal(error, null);
    
    // Point query, PK out of range, should fail.
    sharedTableService.retrieveEntity(tableName1, '0', '3', function (error, entities) {
      assert.notEqual(error, null);

      // Point query, RK out of range, should fail.
      sharedTableService.retrieveEntity(tableName1, '3', '4', function(error, entities) {
        assert.notEqual(error, null);

        // Whole table query, should return only elements to which we have access
        sharedTableService.queryEntities(tableName1, null, null, function(error, queryResult) {

          var entityResult1 = [];
          var entities = queryResult.entries;
          for (var i = 0; i < entities.length; i++) {
            entityResult1.push("PK = " + entities[i]["PartitionKey"]['_'] + ", RK = " + entities[i]["RowKey"]['_']);
          }

          assert.equal(error, null);
          assert.equal(13, entities.length);

          // Complex query, should succeed
          tableQuery = new TableQuery()
          .where('PartitionKey gt ?', '1')
          .and('PartitionKey le ?', '4')
          .and('RowKey gt ?', '1')
          .and('RowKey le ?', '4');

          sharedTableService.queryEntities(tableName1, tableQuery, null, function(error, queryResult) {
            var entities = queryResult.entries;
            assert.equal(error, null);
            var entityResult2 = [];
            for (var i = 0; i < entities.length; i++) {
              entityResult2.push("PK = " + entities[i]["PartitionKey"]['_'] + ", RK = " + entities[i]["RowKey"]['_']);
            }

            assert.equal(5, entities.length);
            done();
          });
        });
      });
    });
  });
}

function insertManyEntities (callback, options) {
  var insertEntity = function(pk, rk, pkMax, rkMax, callback) {
    var entity = {
      PartitionKey: eg.String(pk + ''),
      RowKey: eg.String(rk + ''),
      field1: eg.String('pk' + pk + 'rk' + rk)
    };

    tableService.insertEntity(tableName1, entity, options, function (error) {
      assert.equal(error, null);

      if ((pk === pkMax) && (rk === rkMax)) {
        callback();
      } else if ((rk === rkMax)) {
        insertEntity(pk + 1, 0, pkMax, rkMax, callback);
      } else {
        insertEntity(pk, rk + 1, pkMax, rkMax, callback);
      }
    });
  };

  insertEntity(0, 0, 4, 4, callback);
}
