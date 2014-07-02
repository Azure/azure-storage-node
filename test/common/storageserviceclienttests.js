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
var assert = require('assert');

var testutil = require('../framework/util');
var HmacSha256Sign = testutil.libRequire('common/signing/hmacsha256sign');
var azure = testutil.libRequire('azure-storage');
var StorageServiceClient = azure.StorageServiceClient;

var Constants = azure.Constants;
var StorageServiceClientConstants = Constants.StorageServiceClientConstants;

describe('StorageServiceClientTests', function () {

  it('devStore', function (done) {
    var devStoreCreds = azure.generateDevelopmentStorageCredendentials();
    var devStoreBlobService = azure.createBlobService(devStoreCreds);

    assert.strictEqual(devStoreBlobService.storageAccount, StorageServiceClientConstants.DEVSTORE_STORAGE_ACCOUNT);
    assert.strictEqual(devStoreBlobService.storageAccessKey, StorageServiceClientConstants.DEVSTORE_STORAGE_ACCESS_KEY);
    assert.strictEqual(devStoreBlobService.host.primaryHost, 'http://127.0.0.1:10000/devstoreaccount1');
    assert.strictEqual(devStoreBlobService.host.secondaryHost, 'http://127.0.0.1:10000/devstoreaccount1-secondary');

    devStoreCreds = azure.generateDevelopmentStorageCredendentials('http://ipv4.fiddler');
    devStoreBlobService = azure.createBlobService(devStoreCreds);

    assert.strictEqual(devStoreBlobService.storageAccount, StorageServiceClientConstants.DEVSTORE_STORAGE_ACCOUNT);
    assert.strictEqual(devStoreBlobService.storageAccessKey, StorageServiceClientConstants.DEVSTORE_STORAGE_ACCESS_KEY);
    assert.strictEqual(devStoreBlobService.host.primaryHost, 'http://ipv4.fiddler:10000/devstoreaccount1');
    assert.strictEqual(devStoreBlobService.host.secondaryHost, 'http://ipv4.fiddler:10000/devstoreaccount1-secondary');

    done();
  });

  it('hmacsha256sign', function (done) {
    var hmacSha256Sign = new HmacSha256Sign('Buggy');

    var result = hmacSha256Sign.sign('DELETE\n\n0\n\n\n\n\n\n\n\n\nx-ms-date:Thu, 01 Aug 2013 13:49:05 GMTx-ms-version:2012-02-12\n/ciserversdk/cont1\nrestype:container');
    result.should.equal('VLZVbt3Tqfq2DxbJEoTng5JEemEDq+a9JtPXy9G0f84=');

    done();
  });

  describe('_parseResponse', function () {
    it('should work for XML replies with headers mixed casing', function (done) {
      var response = {
        body: '<?xml version=\"1.0\" encoding=\"utf-8\" standalone=\"yes\"?>\r\n<error xmlns=\"http://schemas.microsoft.com/ado/2007/08/dataservices/metadata\">\r\n  <code>TableAlreadyExists</code>\r\n  <message xml:lang=\"en-US\">The table specified already exists.\nRequestId:ebcc9f6b-c774-4f22-b4a9-078a393394eb\nTime:2013-05-30T20:57:11.1474844Z</message>\r\n</error>',
        headers: {
          'content-type': 'application/XML'
        }
      };

      var obj = { xml2jsSettings: StorageServiceClient._getDefaultXml2jsSettings() };
      var parsedResponse = StorageServiceClient._parseResponse.call(obj, response, obj.xml2jsSettings);
      should.exist(parsedResponse);
      should.exist(parsedResponse.body.error);
      parsedResponse.body.error.code.should.equal('TableAlreadyExists');

      done();
    });

    it('should work for JSON replies', function (done) {
      var response = {
        body: '{ "hithere": "Something" }',
        headers: {
          'content-type': 'application/json'
        }
      };

      var obj = { xml2jsSettings: StorageServiceClient._getDefaultXml2jsSettings() };
      var parsedResponse = StorageServiceClient._parseResponse.call(obj, response, obj.xml2jsSettings);
      should.exist(parsedResponse);
      parsedResponse.body.hithere.should.equal('Something');

      done();
    });
  });

  describe('NormalizedErrorsAreErrors', function () {
    it('should work', function (done) {
      var error = {
        Error: {
          'detail': 'this is an error message',
          'ResultCode': 500,
          'somethingElse': 'goes here'
        }
      };

      var normalizedError = StorageServiceClient._normalizeError(error);
      normalizedError.should.be.an.instanceOf(Error);
      normalizedError.should.have.keys('detail', 'resultcode', 'somethingelse');

      done();
    });
  });
});

