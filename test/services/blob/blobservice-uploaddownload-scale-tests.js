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
var fs = require('fs');
var crypto = require('crypto');
var util = require('util');

var testutil = require('../../framework/util');
var TestSuite = require('../../framework/test-suite');
var azure = testutil.libRequire('azure-storage');

var suite = new TestSuite('blobservice-uploaddownload-scale-tests');
var runOrSkip = suite.isMocked ? it.skip : it;

var blobService = null;
var containerName = 'blobservicescaletest';

describe('BlobServiceUploadDownloadScale', function () {
  before(function (done) {
    if (suite.isMocked) {
      testutil.POLL_REQUEST_INTERVAL = 0;
    }
    suite.setupSuite(function () {
      blobService = azure.createBlobService().withFilter(new azure.ExponentialRetryPolicyFilter());
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

  describe('prepare blob scale test', function () {
    runOrSkip('should create the test container', function (done) {
      blobService.createContainer(containerName, function(error) {
        done();
      });
    });
  });

  describe('file scale test', function () {
    var apis = ['createBlockBlobFromLocalFile', 'createPageBlobFromLocalFile'];
    var sizes = [0, 1024, 1024 * 1024, 4 * 1024 * 1024, 32 * 1024 * 1024, 64 * 1024 * 1024, 148 * 1024 * 1024 - 512, 148 * 1024 * 1024, 148 * 1024 * 1024 + 512];
    for(var i = 0; i < apis.length; i++) {
      for(var j = 0; j < sizes.length; j++) {
        runOrSkip(util.format('%s should work %s bytes file', apis[i], sizes[j]), getTestFunction(apis[i], sizes[j])); 
      }
    }

    function getTestFunction(api, size) {
      return function(done) {
        var name = api + 'scale' + size + '.tmp';
        var uploadFunc = blobService[api];
        generateTempFile(name, size, function(error, fileInfo) {
          assert.equal(error, null);
          var blobName = api + size;
          var uploadOptions = {storeBlobContentMD5: true, parallelOperationThreadCount: 5};
          uploadFunc.call(blobService, containerName, blobName, fileInfo.name, uploadOptions, function(error) {
            if(api === 'createPageBlobFromLocalFile' && size !== 0 && size % 512 !== 0) {
              assert.equal(error.message, util.format('The page blob size must be aligned to a 512-byte boundary. The current stream length is %s', size));
              done();
            } else {
              assert.equal(error, null);
              blobService.getBlobProperties(containerName, blobName, function (error, blob) {
                assert.equal(blob.contentMD5, fileInfo.contentMD5);
                assert.equal(blob.contentLength, fileInfo.size);
                var downloadFileName = blobName + '_download.tmp';
                var downloadOptions = {validateContentMD5: true, parallelOperationThreadCount: 5};
                blobService.getBlobToLocalFile(containerName, blobName, downloadFileName, downloadOptions, function(error, blob) {
                  assert.equal(error, null);
                  assert.equal(blob.contentMD5, fileInfo.contentMD5);
                  fs.stat(downloadFileName, function(error, stat) {
                    assert.equal(error, null);
                    assert.equal(stat.size, fileInfo.size);
                    try { fs.unlinkSync(name); } catch (e) {}
                    try { fs.unlinkSync(downloadFileName); } catch (e) {}
                    done();
                  });
                });
              });
            }
          });
        });
      }
    }
  });

  describe('cleanup blob scale test', function () {
    runOrSkip('should delete the test container', function (done) {
      blobService.deleteContainer(containerName, function(error) {
        done();
      });
    });
  });

  var internalBuffer = null;
  function generateTempFile(fileName, size, callback) {
    var blockSize = 4 * 1024 * 1024;
    if(!internalBuffer) {
      internalBuffer = new Buffer(blockSize);
    }
    var md5hash = crypto.createHash('md5');
    var fileInfo = {name: fileName, contentMD5: '', size: size};
    var offset = 0;
    var fd = fs.openSync(fileName, 'w');
    var count = 1;
    do {
      var content = null;
      if (size >= blockSize) {
        content = internalBuffer;
        size -= blockSize;
      } else {
        content = new Buffer(size);
        size = 0;
      }
      if (content.length) {
        if(count % 2 === 0) {
          content[0] = 0;
        } else {
          content[0] = count; //Buffer should not be all zero
        }
        count++;
      }
      fs.writeSync(fd, content, 0, content.length, offset);
      offset += content.length;
      md5hash.update(content);
    } while(size);
    
    fileInfo.contentMD5 = md5hash.digest('base64');
    callback(null, fileInfo);
  }
});
