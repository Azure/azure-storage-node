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
var testutil = require('../framework/util');

var ServiceSettings = testutil.libRequire('common/services/servicesettings');

var azure = testutil.libRequire('azure-storage');
var Constants = azure.Constants;
var ConnectionStringKeys = Constants.ConnectionStringKeys;
var SR = azure.SR;

describe('ConnectionString', function () {

  var validKeys = [
    ConnectionStringKeys.USE_DEVELOPMENT_STORAGE_NAME,
    ConnectionStringKeys.DEVELOPMENT_STORAGE_PROXY_URI_NAME,
    ConnectionStringKeys.DEFAULT_ENDPOINTS_PROTOCOL_NAME,
    ConnectionStringKeys.ACCOUNT_NAME_NAME,
    ConnectionStringKeys.ACCOUNT_KEY_NAME,
    ConnectionStringKeys.BLOB_ENDPOINT_NAME,
    ConnectionStringKeys.QUEUE_ENDPOINT_NAME,
    ConnectionStringKeys.TABLE_ENDPOINT_NAME
  ];

  it('valid', function (done) {
    var defaultConnectionString = 'DefaultEndpointsProtocol=https;AccountName=storagesample;AccountKey=KWPLd0rpW2T0U7K2pVpF8rYr1BgYtR7wYQk33AYiXeUoquiaY6o0TWqduxmPHlqeCNZ3LU0DHptbeIHy5l/Yhg==;';
    var endpointsConnectionString = 'BlobEndpoint=myBlobEndpoint;QueueEndpoint=myQueueEndpoint;TableEndpoint=myTableEndpoint;'

    var parsedConnectionString = ServiceSettings.parseAndValidateKeys(defaultConnectionString, validKeys);
    assert.equal(parsedConnectionString['DefaultEndpointsProtocol'], 'https');
    assert.equal(parsedConnectionString['AccountName'], 'storagesample');
    assert.equal(parsedConnectionString['AccountKey'], 'KWPLd0rpW2T0U7K2pVpF8rYr1BgYtR7wYQk33AYiXeUoquiaY6o0TWqduxmPHlqeCNZ3LU0DHptbeIHy5l/Yhg==');

    var parsedConnectionString = ServiceSettings.parseAndValidateKeys(defaultConnectionString + endpointsConnectionString, validKeys);
    assert.equal(parsedConnectionString['DefaultEndpointsProtocol'], 'https');
    assert.equal(parsedConnectionString['AccountName'], 'storagesample');
    assert.equal(parsedConnectionString['AccountKey'], 'KWPLd0rpW2T0U7K2pVpF8rYr1BgYtR7wYQk33AYiXeUoquiaY6o0TWqduxmPHlqeCNZ3LU0DHptbeIHy5l/Yhg==');
    assert.equal(parsedConnectionString['BlobEndpoint'], 'myBlobEndpoint');
    assert.equal(parsedConnectionString['QueueEndpoint'], 'myQueueEndpoint');
    assert.equal(parsedConnectionString['TableEndpoint'], 'myTableEndpoint');

    done();
  });

  it('noEndColon', function (done) {
    var parsedConnectionString = ServiceSettings.parseAndValidateKeys('DefaultEndpointsProtocol=https;TableEndpoint=myTableEndpoint', validKeys);
    assert.equal(parsedConnectionString['DefaultEndpointsProtocol'], 'https');
    assert.equal(parsedConnectionString['TableEndpoint'], 'myTableEndpoint');

    done();
  });

  it('emptyOrWhitespace', function (done) {
    // actual empty
    var parsedConnectionString = ServiceSettings.parseAndValidateKeys('', validKeys);
    assert.equal(JSON.stringify(parsedConnectionString), '{}');

    // values empty or whitespace
    var parsedConnectionString = ServiceSettings.parseAndValidateKeys('DefaultEndpointsProtocol=\t;AccountName= ;AccountKey=;', validKeys);
    assert.equal(parsedConnectionString['DefaultEndpointsProtocol'], '\t');
    assert.equal(parsedConnectionString['AccountName'], ' ');
    assert.equal(parsedConnectionString['AccountKey'], '');

    done();
  });

  it('connectionStringWithSpecialCharacters', function (done) {
    var parsedConnectionString = ServiceSettings.parseAndValidateKeys('DefaultEndpointsProtocol=qwdwdqdw=@#!@;BlobEndpoint=value2', validKeys);
    assert.equal(parsedConnectionString['DefaultEndpointsProtocol'], 'qwdwdqdw=@#!@');
    assert.equal(parsedConnectionString['BlobEndpoint'], 'value2');

    done();
  });

  it('invalidPair', function (done) {
    // no assignment
    assert.throws(
      function() {
        var parsedConnectionString = ServiceSettings.parseAndValidateKeys('BlobEndpoint', validKeys);
      },
      function(err) {
        if ((err instanceof Error) && err.message === SR.INVALID_CONNECTION_STRING) {
          return true;
        }
      },
      "unexpected error"
    );

    done();
  });

  it('invalidKey', function (done) {
    assert.throws(
      function() {
        var parsedConnectionString = ServiceSettings.parseAndValidateKeys('=value', validKeys);
      },
      function(err) {
        if ((err instanceof Error) && err.message === SR.INVALID_CONNECTION_STRING_EMPTY_KEY) {
          return true;
        }
      },
      "unexpected error"
    );

    assert.throws(
      function() {
        var parsedConnectionString = ServiceSettings.parseAndValidateKeys('bla=value', validKeys);
      },
      function(err) {
        if ((err instanceof Error) && err.message === util.format(SR.INVALID_CONNECTION_STRING_BAD_KEY, 'bla')) {
          return true;
        }
      },
      "unexpected error"
    );

    assert.throws(
      function() {
        var parsedConnectionString = ServiceSettings.parseAndValidateKeys('AccountKey=value1;AccountKey=value2', validKeys);
      },
      function(err) {
        if ((err instanceof Error) && err.message === util.format(SR.INVALID_CONNECTION_STRING_DUPLICATE_KEY, 'AccountKey')) {
          return true;
        }
      },
      "unexpected error"
    );

    done();
  });
});