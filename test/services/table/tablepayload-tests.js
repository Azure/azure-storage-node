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
var guid = require('node-uuid');
var extend = require('extend');
var _ = require('underscore');

// Test includes
var testutil = require('../../framework/util');

// Lib includes
var azure = testutil.libRequire('azure-storage');
var azureutil = testutil.libRequire('common/util/util');

var TableQuery = azure.TableQuery;
var TableUtilities = azure.TableUtilities;
var eg = TableUtilities.entityGenerator;

var shouldTypeExistIfMinimalMetadata = function (edmType) {
    if (name.indexOf('Binary') !== -1) {
    return true;
  } else if (name.indexOf('Guid') !== -1) {
    return true;
  } else if (name.indexOf('Date') !== -1) {
    return true;
  } else if (name.indexOf('Int64') !== -1) {
    return true;
  } 
  return false;
}

var propertyResolver = function (pk, rk, name, value) {
  if (name.indexOf('Binary') !== -1) {
    return 'Edm.Binary';
  } else if (name.indexOf('Guid') !== -1) {
    return 'Edm.Guid';
  } else if (name.indexOf('Date') !== -1) {
    return 'Edm.DateTime';
  } else if (name.indexOf('Double') !== -1) {
    return 'Edm.Double';
  } else if (name.indexOf('Int64') !== -1) {
    return 'Edm.Int64';
  } else if (name.indexOf('Int32') !== -1) {
    return 'Edm.Int32';
  } else if (name.indexOf('Boolean') !== -1) {
    return 'Edm.Boolean';
  }
  return 'Edm.String';
}

var getNewEntityToTest = function () {
  return {
    PartitionKey: eg.String('partition1'),
    RowKey: eg.String('row1'),
    StringProperty: eg.String('stringSample'),
    BooleanProperty: eg.Boolean(true, 'Edm.Boolean'),
    BinaryProperty: eg.Binary(new Buffer('SampleStringInBuffer!')),
    Int32Property: eg.Int32(42),
    Int64Property: eg.Int64('5432873627392'),
    DoubleProperty: eg.Double(4.81516),
    GuidProperty: eg.Guid(guid.v1()),
    DateTimeProperty: eg.DateTime(new Date(2014, 04, 07, 08, 20, 53)),
  };
}

var tableService;
var tableNamePrefix = 'tablequerytests';
var tableName;
var tableNameInit;

describe('tableservice-tablequery-tests', function () {
  before(function (done) {
    tableService = azure.createTableService()
      .withFilter(new azure.ExponentialRetryPolicyFilter());
    done();
  });

  beforeEach(function (done) {
    tableNameInit = tableNamePrefix + guid.v1().replace(/-/g,'');
    done();
  });

  afterEach(function (done) {
    tableService.deleteTableIfExists(tableNameInit + "1", function() {
      tableService.deleteTableIfExists(tableNameInit + "2", function() {
        tableService.deleteTableIfExists(tableNameInit + "3", function() {
          tableService.deleteTableIfExists(tableNameInit + "4", done);
        });
      });
    });
  });

  var fnHelper = function(fn, options, callback) {
    options.autoResolveProperties = true;
    tableName = tableNameInit + "1";
    fn(options, function() {

      options.propertyResolver = propertyResolver;
      tableName = tableNameInit + "2";
      fn(options, function() {

        delete options.propertyResolver;
        options.autoResolveProperties = false;
        tableName = tableNameInit + "3";
        fn(options, function() {

          options.propertyResolver = propertyResolver;
          tableName = tableNameInit + "4";
          fn(options, callback);
        });
      });
    });
  }

  describe('SelectBaseCase', function () {   
    it('FullMetadata', function (done) {
      var options = {};
      options.payloadFormat = TableUtilities.PayloadFormat.FULL_METADATA;
      fnHelper(selectBaseCaseTest, options, done);
    });

    it('MinimalMetadata', function (done) {
      var options = {};
      options.payloadFormat = TableUtilities.PayloadFormat.MINIMAL_METADATA;
      fnHelper(selectBaseCaseTest, options, done);
    });

    it('NoMetadata', function (done) {
      var options = {};

      options.payloadFormat = TableUtilities.PayloadFormat.NO_METADATA;
      fnHelper(selectBaseCaseTest, options, done);
    });
  });

  describe('SelectBaseCaseTwoEntities', function () {   
    it('FullMetadata', function (done) {
      var options = {};
      options.payloadFormat = TableUtilities.PayloadFormat.FULL_METADATA;
      fnHelper(selectBaseCaseTwoEntitiesTest, options, done);
    });

    it('MinimalMetadata', function (done) {
      var options = {};
      options.payloadFormat = TableUtilities.PayloadFormat.MINIMAL_METADATA;
      fnHelper(selectBaseCaseTwoEntitiesTest, options, done);
    });

    it('NoMetadata', function (done) {
      var options = {};
      options.payloadFormat = TableUtilities.PayloadFormat.NO_METADATA;
      fnHelper(selectBaseCaseTwoEntitiesTest, options, done);
    });
  });

  describe('SpecialNumbers', function () {   
    it('FullMetadata', function (done) {
      var options = {};
      options.payloadFormat = TableUtilities.PayloadFormat.FULL_METADATA;
      fnHelper(specialNumbersTest, options, done);
    });

    it('MinimalMetadata', function (done) {
      var options = {};
      options.payloadFormat = TableUtilities.PayloadFormat.MINIMAL_METADATA;
      fnHelper(specialNumbersTest, options, done);
    });

    it('NoMetadata', function (done) {
      var options = {};
      options.payloadFormat = TableUtilities.PayloadFormat.NO_METADATA;
      fnHelper(specialNumbersTest, options, done);
    });
  });

  describe('EntityResolver', function () {   
    it('FullMetadata', function (done) {
      var options = {};
      options.payloadFormat = TableUtilities.PayloadFormat.FULL_METADATA;
      fnHelper(entityResolverTest, options, done);
    });

    it('MinimalMetadata', function (done) {
      var options = {};
      options.payloadFormat = TableUtilities.PayloadFormat.MINIMAL_METADATA;
      fnHelper(entityResolverTest, options, done);
    });

    it('NoMetadata', function (done) {
      var options = {};
      options.payloadFormat = TableUtilities.PayloadFormat.NO_METADATA;
      fnHelper(entityResolverTest, options, done);
    });
  });

  describe('PartialResolver', function() {
    it('NoMetadata', function (done) {
      var options = {};
      options.payloadFormat = TableUtilities.PayloadFormat.NO_METADATA;
      options.autoResolveProperties = true;
      options.propertyResolver = function (pk, rk, name, value) {
        if (name.indexOf('Binary') !== -1) {
          return 'Edm.Binary';
        } else if (name.indexOf('Guid') !== -1) {
          return 'Edm.Guid';
        } else if (name.indexOf('Date') !== -1) {
          return 'Edm.DateTime';
        } else if (name.indexOf('Double') !== -1) {
          return 'Edm.Double';
        } else if (name.indexOf('Int64') !== -1) {
          return 'Edm.Int64';
        } else if (name.indexOf('Int32') !== -1) {
          return 'Edm.Int32';
        } else if (name.indexOf('Boolean') !== -1) {
          return null;
        }
        return 'Edm.String';
      };

      tableName = tableNameInit + "1";

      tableService.createTable(tableName, function (error1) {
        assert.equal(error1, null);

        var entityToTest = getNewEntityToTest();
        tableService.insertEntity(tableName, entityToTest, function (error2) {
          assert.equal(error2, null);

          tableService.retrieveEntity(tableName, entityToTest.PartitionKey['_'], entityToTest.RowKey['_'], options, function (error3, entity) {
            assert.equal(error3, null);
            assert.notEqual(entity, null);

            assert.ok(entity['BooleanProperty']['_']);
            assert.equal(entity['BooleanProperty']['$'], 'Edm.Boolean');
            done();
          });
        });
      });
    });
  });

  // TODO:
  // Future tests around queries:
  // Select with multiple entities
  // Select amont multiple entties with row filter
  // Select among multiple entities with column filter 
});

function compareProperties (propFromService, prop, expectTypeOnService) {
  // check type
  if (expectTypeOnService.val) {
    if (expectTypeOnService.stringOverride) {
      assert.strictEqual(propFromService['$'], 'Edm.String');
    } else {
      assert.strictEqual(propFromService['$'], prop['$']);
    }
  } else {
    assert.ok(!propFromService.hasOwnProperty('$'))
  }

  // check value, make sure typeof is equal as Number.NaN should not equal 'Nan'
  if (propFromService.hasOwnProperty('$') && !expectTypeOnService.stringOverride) {
    assert.strictEqual(typeof propFromService['_'], typeof prop['_']);
  }
  if (prop['$'] === 'Edm.Binary' && (!propFromService.hasOwnProperty('$') || propFromService['$'] === 'Edm.String')) {
    assert.strictEqual(new Buffer(propFromService['_'], 'base64').toString(), prop['_'].toString());
  } else if (prop['$'] === 'Edm.DateTime' && (!propFromService.hasOwnProperty('$') || propFromService['$'] === 'Edm.String')){
    assert.strictEqual((new Date(propFromService['_'])).toString(), prop['_'].toString());
  } else {
    assert.strictEqual(propFromService['_'].toString(), prop['_'].toString());
  }
}

var expectPKRKType = function (options) {
  return {
    val: true,//((options.payloadFormat === TableUtilities.PayloadFormat.FULL_METADATA) || options.autoResolve || options.propertyResolver),
    stringOverride: false
  };
}

var expectPropType = function (options, property) {
  if (options.propertyResolver) {
    return {val: true, stringOverride: false};
  }

  if (property['$'] === 'Edm.Int32' || property['$'] === 'Edm.Double') {
    if ((Number.isNaN(property['_']) || property['_'] === Number.POSITIVE_INFINITY || property['_'] === Number.NEGATIVE_INFINITY) && (options.payloadFormat !== TableUtilities.PayloadFormat.NO_METADATA || options.autoResolveProperties)) {
      return {val: true, stringOverride: (options.autoResolveProperties && options.payloadFormat === TableUtilities.PayloadFormat.NO_METADATA)};
    } else {
      return {val: false};
    }
  }

  if (options.autoResolveProperties) {
    if ((options.payloadFormat === TableUtilities.PayloadFormat.NO_METADATA) &&
        (property['$'] === 'Edm.Binary' || property['$'] === 'Edm.DateTime' || property['$'] === 'Edm.Int64'|| property['$'] === 'Edm.Guid')) {
      return {val: true, stringOverride: true};
    }
    return {val: true, stringOverride: false};
  }

  if (options.payloadFormat === TableUtilities.PayloadFormat.NO_METADATA) {
    return {val: false};
  }

  if (property['$'] === 'Edm.Boolean' || property['$'] === 'Edm.String') {
    return {val: false};
  }

  return {val: true, stringOverride: false};
}

// The order of inputs here matters, entities from the service will have TimeStamps that we don't expect in the source.
function compareEntities (entityFromService, entity, options) {

  // Start with PK and RK
  compareProperties(entityFromService["PartitionKey"], entity["PartitionKey"], expectPKRKType(options));
  delete entityFromService["PartitionKey"];
  compareProperties(entityFromService["RowKey"], entity["RowKey"], expectPKRKType(options));
  delete entityFromService["RowKey"];

  // Standard entities
  for (var propName in entity) {
    if (!(propName === 'PartitionKey' || propName === 'RowKey')) {
      if (entity.hasOwnProperty(propName)) {
        compareProperties(entityFromService[propName], entity[propName], expectPropType(options, entity[propName]));
        delete entityFromService[propName];
      }
    }
  }

  // make sure the service entity has a timestamp
  assert.notEqual(entityFromService.Timestamp, null);
  delete entityFromService.Timestamp;

  // make sure the service entity has metadata and etag
  assert.notEqual(entityFromService['.metadata'], null);
  assert.notEqual(entityFromService['.metadata'].etag, null);
  delete entityFromService['.metadata'];

  // make sure the service entity doesn't have properties the insert entity does
  assert.strictEqual(Object.keys(entityFromService).length, 0);
};

function selectBaseCaseTest (options, done) {
  tableService.createTable(tableName, function (error1) {
    assert.equal(error1, null);

    var entityToTest = getNewEntityToTest();
    tableService.insertEntity(tableName, entityToTest, function (error2) {
      assert.equal(error2, null);

      tableService.retrieveEntity(tableName, entityToTest.PartitionKey['_'], entityToTest.RowKey['_'], options, function (error3, entity) {
        assert.equal(error3, null);
        assert.notEqual(entity, null);

        compareEntities(entity, entityToTest, options);

        done();
      });
    });
  });
}

function selectBaseCaseTwoEntitiesTest (options, done) {
  tableService.createTable(tableName, function (error1) {
    assert.equal(error1, null);

    var entityToTest1 = getNewEntityToTest();
    var entityToTest2 = getNewEntityToTest();
    entityToTest2.RowKey['_'] = 'row2';

    tableService.insertEntity(tableName, entityToTest1, function (error2) {
      assert.equal(error2, null);

      tableService.insertEntity(tableName, entityToTest2, function (error3) {
        assert.equal(error3, null);

        tableService.queryEntities(tableName, null, null, options, function (error4, entities1) {
          assert.equal(error4, null);
          assert.notEqual(entities1, null);
          assert.notEqual(entities1.entries, null);
          assert.equal(entities1.entries.length, 2);
          compareEntities(entities1.entries[0], entityToTest1, options);
          compareEntities(entities1.entries[1], entityToTest2, options);

          done();
        });
      });
    });
  });
}

function specialNumbersTest (options, done) {
  tableService.createTable(tableName, function (error1) {
    assert.equal(error1, null);

    var entityToTest = {
      PartitionKey: eg.String('partition1'),
      RowKey: eg.String('row1'),
      RegularDouble: eg.Double(4.81516),
      NanDouble: eg.Double(Number.NaN),
      PositiveInfinityDouble: eg.Double(Number.POSITIVE_INFINITY),
      NegativeInfinityDouble: eg.Double(Number.NEGATIVE_INFINITY),
      MinDouble: eg.Double(Number.MIN_VALUE),
      MaxDouble: eg.Double(Number.MAX_VALUE),
      MaxInt64: eg.Int64('9223372036854775807'),
    };

    tableService.insertEntity(tableName, entityToTest, function (error2) {
      assert.equal(error2, null);

      tableService.retrieveEntity(tableName, entityToTest.PartitionKey['_'], entityToTest.RowKey['_'], options, function (error3, entity) {
        assert.equal(error3, null);
        assert.notEqual(entity, null);

        compareEntities(entity, entityToTest, options);

        done();
      });
    });
  });
}

function entityResolverTest (options, done) {
  tableService.createTable(tableName, function (error1) {
    assert.equal(error1, null);

    var entityToTest = {
      PartitionKey: eg.String('partition1'),
      RowKey: eg.String('row1'),
      BooleanProperty: eg.Boolean(true),
      BinaryProperty: eg.Binary(new Buffer('SampleStringInBuffer!')),
      Int32Property: eg.Int32(42)
    };

    tableService.insertEntity(tableName, entityToTest, function (error2) {
      assert.equal(error2, null);

      options.entityResolver = function(entity) {
        for (var property in entity) {
          if (property !== '.metadata') {
            entity[property]['_'] = 'newValue';
            entity[property]['$'] = 'Edm.String';
          }
        }
        return entity;
      }

      tableService.retrieveEntity(tableName, entityToTest.PartitionKey['_'], entityToTest.RowKey['_'], options, function (error3, entity) {
        assert.equal(error3, null);
        assert.notEqual(entity, null);
        assert.equal(Object.keys(entity).length, 7); // 5 properties + timestamp + metadata

        for (var property in entity) {
          if (property !== '.metadata') {
            assert.strictEqual(entity[property]['_'], 'newValue');
            assert.strictEqual(entity[property]['$'], 'Edm.String');
          } else {
            assert.ok(entity[property].etag);
          }
        }

        done();
      });
    });
  });
}
