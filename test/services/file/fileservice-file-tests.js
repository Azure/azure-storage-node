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

var shareNamesPrefix = 'file-test-share-';
var directoryNamesPrefix = 'dir-';
var fileNamesPrefix = 'file-';

var fileService;
var shareName;
var directoryName;
var fileName;

var properties = {
  contentType: 'text/html',
  contentEncoding: 'gzip',
  contentLanguage: 'tr,en',
  contentMD5: 'MDAwMDAwMDA=',
  cacheControl: 'no-transform',
  contentDisposition: 'attachment',
  contentLength: '5'
}

var suite = new TestSuite('fileservice-file-tests');

describe('File', function () {
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
    fileName = suite.getName(fileNamesPrefix);
    suite.setupTest(done);
  });

  afterEach(function (done) {
    suite.teardownTest(done);
  });

  describe('prepare file test', function () {
    it('should create the test share', function (done) {
      shareName = suite.getName(shareNamesPrefix);
      fileService.createShareIfNotExists(shareName, function (createError) {
        assert.equal(createError, null);
        
        directoryName = suite.getName(directoryNamesPrefix);
        fileService.createDirectoryIfNotExists(shareName, directoryName, function (createError) {
          assert.equal(createError, null);
          done();
        });
      });
    });
  });

  describe('getUrl', function() {
    var share = 'share';
    var directory = 'directory';
    var file = 'file'
    var fileServiceForUrl = azure.createFileService('storageAccount', 'storageAccessKey');
    var url;

    it('Directory and file', function (done) {
      fileServiceForUrl.setHost({ primaryHost: 'host.com' });
      url = fileServiceForUrl.getUrl(share, directory, file, true);
      assert.strictEqual(url, 'https://host.com/' + share + '/' + directory + '/' + file);
      
      fileServiceForUrl.setHost({ primaryHost: 'http://host.com:80' });
      url = fileServiceForUrl.getUrl(share, directory, file, true);
      assert.strictEqual(url, 'http://host.com/' + share + '/' + directory + '/' + file);
      
      fileServiceForUrl.setHost({ primaryHost: 'https://host.com:443' });
      url = fileServiceForUrl.getUrl(share, directory, file, true);
      assert.strictEqual(url, 'https://host.com/' + share + '/' + directory + '/' + file);
      
      fileServiceForUrl.setHost({ primaryHost: 'http://host.com:88' });
      url = fileServiceForUrl.getUrl(share, directory, file, true);
      assert.strictEqual(url, 'http://host.com:88/' + share + '/' + directory + '/' + file);
      
      fileServiceForUrl.setHost({ primaryHost: 'https://host.com:88' });
      url = fileServiceForUrl.getUrl(share, directory, file, true);
      assert.strictEqual(url, 'https://host.com:88/' + share + '/' + directory + '/' + file);
      
      fileServiceForUrl.setHost({ secondaryHost: 'host-secondary.com' });
      url = fileServiceForUrl.getUrl(share, directory, file, false);
      assert.strictEqual(url, 'https://host-secondary.com/' + share + '/' + directory + '/' + file);
      
      fileServiceForUrl.setHost({ secondaryHost: 'http://host-secondary.com:80' });
      url = fileServiceForUrl.getUrl(share, directory, file, false);
      assert.strictEqual(url, 'http://host-secondary.com/' + share + '/' + directory + '/' + file);
      
      fileServiceForUrl.setHost({ secondaryHost: 'https://host-secondary.com:88' });
      url = fileServiceForUrl.getUrl(share, directory, file, false);
      assert.strictEqual(url, 'https://host-secondary.com:88/' + share + '/' + directory + '/' + file);

      done();
    });

    it('No file', function (done) {
      fileServiceForUrl.setHost({ primaryHost: 'host.com' });
      url = fileServiceForUrl.getUrl(share, directory, null, true);
      assert.strictEqual(url, 'https://host.com/' + share + '/' + directory);
      url = fileServiceForUrl.getUrl(share, directory, '', true);
      assert.strictEqual(url, 'https://host.com/' + share + '/' + directory);
      
      fileServiceForUrl.setHost({ primaryHost: 'http://host.com:80' });
      url = fileServiceForUrl.getUrl(share, directory, null, true);
      assert.strictEqual(url, 'http://host.com/' + share + '/' + directory);
      url = fileServiceForUrl.getUrl(share, directory, '', true);
      assert.strictEqual(url, 'http://host.com/' + share + '/' + directory);
      
      fileServiceForUrl.setHost({ primaryHost: 'https://host.com:443' });
      url = fileServiceForUrl.getUrl(share, directory, null, true);
      assert.strictEqual(url, 'https://host.com/' + share + '/' + directory);
      url = fileServiceForUrl.getUrl(share, directory, '', true);
      assert.strictEqual(url, 'https://host.com/' + share + '/' + directory);
      
      fileServiceForUrl.setHost({ primaryHost: 'http://host.com:88' });
      url = fileServiceForUrl.getUrl(share, directory, null, true);
      assert.strictEqual(url, 'http://host.com:88/' + share + '/' + directory);
      url = fileServiceForUrl.getUrl(share, directory, '', true);
      assert.strictEqual(url, 'http://host.com:88/' + share + '/' + directory);
      
      fileServiceForUrl.setHost({ primaryHost: 'https://host.com:88' });
      url = fileServiceForUrl.getUrl(share, directory, null, true);
      assert.strictEqual(url, 'https://host.com:88/' + share + '/' + directory);
      url = fileServiceForUrl.getUrl(share, directory, '', true);
      assert.strictEqual(url, 'https://host.com:88/' + share + '/' + directory);

      done();
    });

    it('No directory', function (done) {
      fileServiceForUrl.setHost({ primaryHost: 'host.com' });
      url = fileServiceForUrl.getUrl(share, '', null, true);
      assert.strictEqual(url, 'https://host.com/' + share);
      url = fileServiceForUrl.getUrl(share, '', file, true);
      assert.strictEqual(url, 'https://host.com/' + share + '/' + file);
      
      fileServiceForUrl.setHost({ primaryHost: 'http://host.com:80' });
      url = fileServiceForUrl.getUrl(share, '', null, true);
      assert.strictEqual(url, 'http://host.com/' + share);
      url = fileServiceForUrl.getUrl(share, '', file, true);
      assert.strictEqual(url, 'http://host.com/' + share + '/' + file);
      
      fileServiceForUrl.setHost({ primaryHost: 'https://host.com:443' });
      url = fileServiceForUrl.getUrl(share, '', null, true);
      assert.strictEqual(url, 'https://host.com/' + share);
      url = fileServiceForUrl.getUrl(share, '', file, true);
      assert.strictEqual(url, 'https://host.com/' + share + '/' + file);
      
      fileServiceForUrl.setHost({ primaryHost: 'http://host.com:88' });
      url = fileServiceForUrl.getUrl(share, '', null, true);
      assert.strictEqual(url, 'http://host.com:88/' + share);
      url = fileServiceForUrl.getUrl(share, '', file, true);
      assert.strictEqual(url, 'http://host.com:88/' + share + '/' + file);
      
      fileServiceForUrl.setHost({ primaryHost: 'https://host.com:88' });
      url = fileServiceForUrl.getUrl(share, '', null, true);
      assert.strictEqual(url, 'https://host.com:88/' + share);
      url = fileServiceForUrl.getUrl(share, '', file, true);
      assert.strictEqual(url, 'https://host.com:88/' + share + '/' + file);

      done();
    });
  });

  describe('doesFileExist', function () {
    it('should work', function (done) {
      fileService.doesFileExist(shareName, directoryName, fileName, function (existsError, exists) {
        assert.equal(existsError, null);
        assert.strictEqual(exists, false);

        fileService.createFile(shareName, directoryName, fileName, 0, function (createError, file, createDirectoryResponse) {
          assert.equal(createError, null);
          assert.notEqual(file, null);
          assert.equal(createDirectoryResponse.statusCode, HttpConstants.HttpResponseCodes.Created);

          fileService.doesFileExist(shareName, directoryName, fileName, function (existsError, exists) {
            assert.equal(existsError, null);
            assert.strictEqual(exists, true);
            done();
          });
        });
      });
    });
  });

  describe('createFile', function () {
    it('should detect incorrect directory names', function (done) {
      assert.throws(function () { fileService.createFile(shareName, directoryName, null, function () { }); },
        /Required argument file for function createFile is not defined/);

      assert.throws(function () { fileService.createFile(shareName, directoryName, '', function () { }); },
        /Required argument file for function createFile is not defined/);

      done();
    });

    it('should work', function (done) {
      fileService.createFile(shareName, directoryName, fileName, 0, function (createError1, file1, createResponse1) {
        assert.equal(createError1, null);
        assert.notEqual(file1, null);
        assert.equal(createResponse1.statusCode, HttpConstants.HttpResponseCodes.Created);

        assert.equal(file1.name, fileName);
        assert.notEqual(file1.etag, null);
        assert.notEqual(file1.lastModified, null);

        // creating again is fine
        fileService.createFile(shareName, directoryName, fileName, 5, function (createError2, file2, createResponse2) {
          assert.equal(createError2, null);
          assert.notEqual(file2, null);
          assert.equal(createResponse2.statusCode, HttpConstants.HttpResponseCodes.Created);

          assert.notEqual(file2.name, null);
          assert.notEqual(file2.etag, null);
          assert.notEqual(file2.lastModified, null);

          fileService.deleteFile(shareName, directoryName, fileName, function (deleteError) {
            assert.equal(deleteError, null);
            done();
          });
        });
      });
    });

    it('metadata', function (done) {
      fileService.createFile(shareName, directoryName, fileName, 0, function (createError1, file1, createResponse1) {
        assert.equal(createError1, null);
        assert.notEqual(file1, null);
        assert.equal(createResponse1.statusCode, HttpConstants.HttpResponseCodes.Created);

        assert.equal(file1.name, fileName);
        assert.notEqual(file1.etag, null);
        assert.notEqual(file1.lastModified, null);

        // creating again is fine
        fileService.createFile(shareName, directoryName, fileName, 5, properties, function (createError2, file2, createResponse2) {
          assert.equal(createError2, null);
          assert.notEqual(file2, null);
          assert.equal(createResponse2.statusCode, HttpConstants.HttpResponseCodes.Created);

          assert.equal(file2.name, fileName);
          assert.notEqual(file2.etag, null);
          assert.notEqual(file2.lastModified, null);
          assert.notEqual(file2.requestId, null);

          fileService.getFileProperties(shareName, directoryName, fileName, function (getError, file3, getResponse) {
            assert.equal(getError, null);
            assert.notEqual(file3, null);
            assert.notEqual(getResponse, null);
            assert.equal(getResponse.isSuccessful, true);

            assert.equal(file3.name, fileName);
            assert.equal(file3.contentLength , '5');
            assert.notEqual(file3.etag, null);
            assert.notEqual(file3.lastModified, null);
            assert.notEqual(file3.requestId, null);

            assert.equal(file3.contentType, 'text/html');
            assert.equal(file3.contentEncoding, 'gzip');
            assert.equal(file3.contentLanguage, 'tr,en');
            assert.equal(file3.contentDisposition , 'attachment');
            assert.equal(file3.contentMD5, 'MDAwMDAwMDA=');
            assert.equal(file3.cacheControl, 'no-transform');

            done();
          });
        });
      });
    });
  });

  describe('deleteFileIfExists', function() {
    it('should delete a file if exists', function (done) {
      fileService.doesFileExist(shareName, directoryName, fileName, function(existsError, exists){
        assert.equal(existsError, null);
        assert.strictEqual(exists, false);

        fileService.deleteFileIfExists(shareName, directoryName, fileName, function (deleteError, deleted) {
          assert.equal(deleteError, null);
          assert.strictEqual(deleted, false);

          fileService.createFile(shareName, directoryName, fileName, 0, function (createError, directory1, createFileResponse) {
            assert.equal(createError, null);
            assert.notEqual(directory1, null);
            assert.equal(createFileResponse.statusCode, HttpConstants.HttpResponseCodes.Created);

            // delete if exists should succeed
            fileService.deleteFileIfExists(shareName, directoryName, fileName, function (deleteError2, deleted2) {
              assert.equal(deleteError2, null);
              assert.strictEqual(deleted2, true);

              fileService.doesFileExist(shareName, directoryName, fileName, function(existsError, exists){
                assert.equal(existsError, null);
                assert.strictEqual(exists, false);
                done();
              });
            });
          });
        });
      });
    });

    it('should throw if called without a callback', function (done) {
      assert.throws(function () { fileService.deleteFileIfExists(shareName, directoryName, fileName); },
        Error
      );
      done();
    });
  });

  describe('deleteFile', function() {
    it('should delete a file', function (done) {
      fileService.doesFileExist(shareName, directoryName, fileName, function(existsError, exists){
        assert.equal(existsError, null);
        assert.strictEqual(exists, false);

        fileService.deleteFile(shareName, directoryName, fileName, function (deleteError) {
          assert.notEqual(deleteError, null);

          fileService.createFile(shareName, directoryName, fileName, 0, function (createError, directory1, createFileResponse) {
            assert.equal(createError, null);
            assert.notEqual(directory1, null);
            assert.equal(createFileResponse.statusCode, HttpConstants.HttpResponseCodes.Created);

            // delete should succeed
            fileService.deleteFile(shareName, directoryName, fileName, function (deleteError2, deleted2) {
              assert.equal(deleteError2, null);

              fileService.doesFileExist(shareName, directoryName, fileName, function(existsError, exists){
                assert.equal(existsError, null);
                assert.strictEqual(exists, false);
                done();
              });
            });
          });
        });
      });
    });

    it('should throw if called without a callback', function (done) {
      assert.throws(function () { fileService.deleteFile(shareName, directoryName, fileName); },
        Error
      );
      done();
    });
  });

  describe('fileProperties', function () {
    it('should work', function (done) {
      fileService.createFile(shareName, directoryName, fileName, 0, function (createError) {
        assert.equal(createError, null);
        
        fileService.getFileProperties(shareName, directoryName, fileName, function (getError, file, getResponse) {
          assert.equal(getError, null);
          assert.notEqual(file, null);
          assert.notEqual(getResponse, null);
          assert.equal(getResponse.isSuccessful, true);

          assert.equal(file.name, fileName);
          assert.equal(file.contentLength, '0');
          assert.notEqual(file.etag, null);
          assert.notEqual(file.lastModified, null);
          assert.notEqual(file.requestId, null);

          done();
        });
      });
    });

    it('setAndGetAll', function (done) {
      fileService.createFile(shareName, directoryName, fileName, 0, function (createError) {
        assert.equal(createError, null);

        fileService.setFileProperties(shareName, directoryName, fileName, properties, function (setError, file, setResponse) {
          assert.equal(setError, null);
          assert.notEqual(file, null);
          assert.notEqual(setResponse, null);
          assert.equal(setResponse.isSuccessful, true);

          assert.equal(file.name, fileName);
          assert.notEqual(file.contentLength, '5');
          assert.notEqual(file.etag, null);
          assert.notEqual(file.lastModified, null);
          assert.notEqual(file.requestId, null);

          fileService.getFileProperties(shareName, directoryName, fileName, function (getError, file, getResponse) {
            assert.equal(getError, null);
            assert.notEqual(file, null);
            assert.notEqual(getResponse, null);
            assert.equal(getResponse.isSuccessful, true);

            assert.equal(file.name, fileName);
            assert.equal(file.contentLength , '5');
            assert.notEqual(file.etag, null);
            assert.notEqual(file.lastModified, null);
            assert.notEqual(file.requestId, null);

            assert.equal(file.contentType, 'text/html');
            assert.equal(file.contentEncoding, 'gzip');
            assert.equal(file.contentLanguage, 'tr,en');
            assert.equal(file.contentDisposition , 'attachment');
            assert.equal(file.contentMD5, 'MDAwMDAwMDA=');
            assert.equal(file.cacheControl, 'no-transform');

            done();
          });
        });
      });
    });

    it('setAndGetAllOnCreate', function (done) {
      fileService.createFile(shareName, directoryName, fileName, 0, properties, function (createError) {
        assert.equal(createError, null);

        fileService.getFileProperties(shareName, directoryName, fileName, function (getError, file, getResponse) {
          assert.equal(getError, null);
          assert.notEqual(file, null);
          assert.notEqual(getResponse, null);
          assert.equal(getResponse.isSuccessful, true);

          assert.equal(file.name, fileName);
          assert.equal(file.contentLength , '5');
          assert.notEqual(file.etag, null);
          assert.notEqual(file.lastModified, null);
          assert.notEqual(file.requestId, null);

          assert.equal(file.contentType, 'text/html');
          assert.equal(file.contentEncoding, 'gzip');
          assert.equal(file.contentLanguage, 'tr,en');
          assert.equal(file.contentDisposition , 'attachment');
          assert.equal(file.contentMD5, 'MDAwMDAwMDA=');
          assert.equal(file.cacheControl, 'no-transform');

          done();
        });
      });
    });

    it('resizeFile', function (done) {
      fileService.createFile(shareName, directoryName, fileName, 0, function (createError) {
        assert.equal(createError, null);

        fileService.resizeFile(shareName, directoryName, fileName, 5, function (getError, file, getResponse) {
          assert.equal(getError, null);
          assert.notEqual(file, null);
          assert.notEqual(getResponse, null);
          assert.equal(getResponse.isSuccessful, true);

          fileService.getFileProperties(shareName, directoryName, fileName, function (getError, file, getResponse) {
            assert.equal(getError, null);
            assert.notEqual(file, null);
            assert.notEqual(getResponse, null);
            assert.equal(getResponse.isSuccessful, true);

            assert.equal(file.name, fileName);
            assert.equal(file.contentLength, '5');
            assert.notEqual(file.etag, null);
            assert.notEqual(file.lastModified, null);
            assert.notEqual(file.requestId, null);

            done();
          });
        });
      });
    });
  });

  describe('fileMetadata', function () {
    it('should work', function (done) {
      fileService.createFile(shareName, directoryName, fileName, 0, function (createError) {
        assert.equal(createError, null);

        var metadata = { 'Class': 'Test' };
        fileService.setFileMetadata(shareName, directoryName, fileName, metadata, function (setMetadataError, setMetadataResult, setMetadataResponse) {
          assert.equal(setMetadataError, null);
          assert.ok(setMetadataResponse.isSuccessful);

          fileService.getFileMetadata(shareName, directoryName, fileName, function (getMetadataError, file, getMetadataResponse) {
            assert.equal(getMetadataError, null);
            assert.notEqual(file, null);
            assert.notEqual(file.metadata, null);
            assert.equal(file.metadata.class, 'Test');
            assert.ok(getMetadataResponse.isSuccessful);

            done();
          });
        });
      });
    });

    it('withCreate', function (done) {
      var metadata = { 'Class': 'Test' };
      fileService.createFile(shareName, directoryName, fileName, 0, {metadata: metadata}, function (createError) {
        assert.equal(createError, null);

        fileService.getFileMetadata(shareName, directoryName, fileName, function (getMetadataError, file, getMetadataResponse) {
          assert.equal(getMetadataError, null);
          assert.notEqual(file, null);
          assert.notEqual(file.metadata, null);
          assert.equal(file.metadata.class, 'Test');
          assert.ok(getMetadataResponse.isSuccessful);

          done();
        });
      });
    });

    it('withGetProperties', function (done) {
      fileService.createFile(shareName, directoryName, fileName, 0, function (createError) {
        assert.equal(createError, null);

        var metadata = { 'Color': 'Blue' };
        fileService.setFileMetadata(shareName, directoryName, fileName, metadata, function (setMetadataError, setMetadataResult, setMetadataResponse) {
          assert.equal(setMetadataError, null);
          assert.ok(setMetadataResponse.isSuccessful);

          fileService.getFileProperties(shareName, directoryName, fileName, function (getError, file, getResponse) {
            assert.equal(getError, null);
            assert.notEqual(file, null);
            assert.notEqual(null, file.requestId);
            assert.strictEqual(file.metadata.color, metadata.Color);

            assert.notEqual(getResponse, null);
            assert.equal(getResponse.isSuccessful, true);

            done();
          });
        });
      });
    });

    it('should merge the metadata', function (done) {
      fileService.createFile(shareName, directoryName, fileName, 0, function (createError) {
        assert.equal(createError, null);

        var metadata = { color: 'blue', Color: 'Orange', COLOR: 'Red' };
        fileService.setFileMetadata(shareName, directoryName, fileName, metadata, function (setMetadataError, setMetadataResult, setMetadataResponse) {
          assert.equal(setMetadataError, null);
          assert.ok(setMetadataResponse.isSuccessful);

          fileService.getFileProperties(shareName, directoryName, fileName, function (getError, file, getResponse) {
            assert.equal(getError, null);
            assert.notEqual(file, null);
            assert.notEqual(null, file.requestId);
            assert.strictEqual(file.metadata.color, 'blue,Orange,Red');

            assert.notEqual(getResponse, null);
            assert.equal(getResponse.isSuccessful, true);

            done();
          });
        });
      });
    });
  });

  describe('base directory', function () {
    it('create/delete', function (done) {
      fileService.createFile(shareName, '', fileName, 0, function (createError1, file1, createResponse1) {
        assert.equal(createError1, null);
        assert.notEqual(file1, null);
        assert.equal(createResponse1.statusCode, HttpConstants.HttpResponseCodes.Created);

        assert.equal(file1.name, fileName);
        assert.notEqual(file1.etag, null);
        assert.notEqual(file1.lastModified, null);

        fileService.deleteFile(shareName, '', fileName, function (deleteError) {
          assert.equal(deleteError, null);

          fileService.deleteFileIfExists(shareName, '', fileName, function (deleteError) {
            assert.equal(deleteError, null);
            done();
          });
        });
      });
    });

    it('set/get properties', function (done) {
      fileService.createFile(shareName, '', fileName, 0, function (createError) {
        assert.equal(createError, null);

        fileService.setFileProperties(shareName, '', fileName, properties, function (setError, file, setResponse) {
          assert.equal(setError, null);
          assert.notEqual(file, null);
          assert.notEqual(setResponse, null);
          assert.equal(setResponse.isSuccessful, true);

          assert.equal(file.name, fileName);
          assert.notEqual(file.contentLength, '5');
          assert.notEqual(file.etag, null);
          assert.notEqual(file.lastModified, null);
          assert.notEqual(file.requestId, null);

          fileService.getFileProperties(shareName, '', fileName, function (getError, file, getResponse) {
            assert.equal(getError, null);
            assert.notEqual(file, null);
            assert.notEqual(getResponse, null);
            assert.equal(getResponse.isSuccessful, true);

            assert.equal(file.name, fileName);
            assert.equal(file.contentLength , '5');
            assert.notEqual(file.etag, null);
            assert.notEqual(file.lastModified, null);
            assert.notEqual(file.requestId, null);

            assert.equal(file.contentType, 'text/html');
            assert.equal(file.contentEncoding, 'gzip');
            assert.equal(file.contentLanguage, 'tr,en');
            assert.equal(file.contentDisposition , 'attachment');
            assert.equal(file.contentMD5, 'MDAwMDAwMDA=');
            assert.equal(file.cacheControl, 'no-transform');

            done();
          });
        });
      });
    });

    it('set/get metadata', function (done) {
      fileService.createFile(shareName, '', fileName, 0, function (createError) {
        assert.equal(createError, null);

        var metadata = { color: 'blue', Color: 'Orange', COLOR: 'Red' };
        fileService.setFileMetadata(shareName, '', fileName, metadata, function (setMetadataError, setMetadataResult, setMetadataResponse) {
          assert.equal(setMetadataError, null);
          assert.ok(setMetadataResponse.isSuccessful);

          fileService.getFileMetadata(shareName, '', fileName, function (getMetadataError, file, getMetadataResponse) {
            assert.equal(getMetadataError, null);
            assert.notEqual(file, null);
            assert.notEqual(file.metadata, null);
            assert.equal(file.metadata.color, 'blue,Orange,Red');
            assert.ok(getMetadataResponse.isSuccessful);

            done();
          });
        });
      });
    });
  });

  describe('cleanup file test', function () {
    it('should delete the test share', function (done) {
      fileService.deleteShareIfExists(shareName, function (deleteError) {
        assert.equal(deleteError, null);
        done();
      });
    });
  });
});
