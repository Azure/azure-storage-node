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

// Lib includes
var testutil = require('../../framework/util');
var SR = testutil.libRequire('common/util/sr');
var TestSuite = require('../../framework/test-suite');

var azure = testutil.libRequire('azure-storage');

var Constants = azure.Constants;
var HttpConstants = Constants.HttpConstants;

var suite = new TestSuite('fileservice-tests');

describe('FileService', function () {
  before(function (done) {
    if (suite.isMocked) {
      testutil.POLL_REQUEST_INTERVAL = 0;
    }
    suite.setupSuite(function () {
      fileService = azure.createFileService().withFilter(new azure.ExponentialRetryPolicyFilter());
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
  
  describe('serverTimeout', function () {
    it('should work', function (done) {
      var timeout = null;
      var callback = function (webresource) {
        if (webresource.queryString['timeout']) {
          timeout = webresource.queryString['timeout'];
        } else {
          timeout = null;
        }
      };
      
      fileService.on('sendingRequestEvent', callback);
      
      fileService.getServiceProperties(function (error1) {
        assert.equal(error1, null);
        assert.equal(timeout, null);
        fileService.getServiceProperties({ timeoutIntervalInMs: 10000 }, function (error2) {
          assert.equal(error2, null);
          assert.equal(timeout, 10000);
          fileService.defaultTimeoutIntervalInMs = 9000;
          fileService.getServiceProperties(function (error3) {
            assert.equal(error3, null);
            assert.equal(timeout, 9000);
            fileService.getServiceProperties({ timeoutIntervalInMs: 10000 }, function (error4) {
              assert.equal(error4, null);
              assert.equal(timeout, 10000);
              fileService.getServiceProperties({ timeoutIntervalInMs: null }, function (error5) {
                assert.equal(error5, null);
                assert.equal(timeout, 9000);
                fileService.getServiceProperties({ timeoutIntervalInMs: 0 }, function (error6) {
                  assert.equal(error6, null);
                  assert.equal(timeout, null);
                  fileService.defaultTimeoutIntervalInMs = null;
                  fileService.getServiceProperties(function (error7) {
                    assert.equal(error7, null);
                    assert.equal(timeout, null);
                    fileService.removeAllListeners();
                    done();
                  });
                });
              });
            });
          });
        });
      });
    });
  });
});