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
var guid = require('node-uuid');

var testutil = require('../../framework/util');
var azure = testutil.libRequire('azure-storage');

var shareNamesPrefix = 'share-';
var directoryNamesPrefix = 'dir-';

var fileService;
var shareName;
var directoryName;
var fileName;

describe('FileUploadDownloadScale', function () {
  before(function (done) {
    fileService = azure.createFileService()
      .withFilter(new azure.ExponentialRetryPolicyFilter());

    shareName = getName(shareNamesPrefix);
    fileService.createShareIfNotExists(shareName, function (createError) {
      assert.equal(createError, null);

      directoryName = getName(directoryNamesPrefix);
      fileService.createDirectoryIfNotExists(shareName, directoryName, function (createError) {
        assert.equal(createError, null);
        done();
      });
    });
  });

  after(function (done) {
    fileService.deleteShareIfExists(shareName, function (deleteError) {
      assert.equal(deleteError, null);
      done();
    });
  });

  var apis = ['createFileFromLocalFile'];
  var sizes = [0, 1024, 1024 * 1024, 4 * 1024 * 1024, 32 * 1024 * 1024, 64 * 1024 * 1024, 148 * 1024 * 1024];
  for(var i = 0; i < apis.length; i++) {
    for(var j = 0; j < sizes.length; j++) {
      it(util.format('%s should work %s bytes file', apis[i], sizes[j]), getTestFunction(apis[i], sizes[j])); 
    }
  }

  function getTestFunction(api, size) {
    return function(done) {
      var name = api + 'scale' + size + '.tmp';
      var uploadFunc = fileService[api];
      generateTempFile(name, size, function(error, fileInfo) {
        assert.equal(error, null);
        var fileName = api + size;
        var uploadOptions = {storeFileContentMD5: true};
        uploadFunc.call(fileService, shareName, directoryName, fileName, fileInfo.name, uploadOptions, function(error) {
          assert.equal(error, null);
          fileService.getFileProperties(shareName, directoryName, fileName, function(error, file) {
            assert.equal(file.contentMD5, fileInfo.contentMD5);
            assert.equal(file.contentLength, fileInfo.size);
            var downloadFileName = fileName + '_download.tmp';
            var downloadOptions = {validateContentMD5: true};
            fileService.getFileToLocalFile(shareName, directoryName, fileName, downloadFileName, downloadOptions, function(error, file) {
              assert.equal(error, null);
              assert.equal(file.contentMD5, fileInfo.contentMD5);
              fs.stat(downloadFileName, function(error, stat) {
                assert.equal(error, null);
                assert.equal(stat.size, fileInfo.size);
                try { fs.unlinkSync(name); } catch (e) {}
                try { fs.unlinkSync(downloadFileName); } catch (e) {}
                done();
              });
            });
          });
        });
      });
    }
  }

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

function getName (prefix) {
  return prefix + guid.v1().toLowerCase();
}