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
var SR = require('../../../lib/common/util/sr');
var TestSuite = require('../../framework/test-suite');

if (testutil.isBrowser()) {
  var azure = AzureStorage.File;
} else {
  var azure = require('../../../');
}

var Constants = azure.Constants;
var HttpConstants = Constants.HttpConstants;

var shareNamesPrefix = 'directory-test-share-';
var directoryNamesPrefix = 'dir-';
var fileNamesPrefix = 'file-';

var fileService;
var shareName;
var directoryName;

var suite = new TestSuite('fileservice-directory-tests');

describe('FileDirectory', function () {
  before(function (done) {
    if (suite.isMocked) {
      testutil.POLL_REQUEST_INTERVAL = 0;
    }
    suite.setupSuite(function () {
      fileService = azure.createFileService(process.env['AZURE_STORAGE_CONNECTION_STRING']).withFilter(new azure.ExponentialRetryPolicyFilter());
      done();
    });
  });

  after(function (done) {
    suite.teardownSuite(done);
  });

  beforeEach(function (done) {
    directoryName = suite.getName(directoryNamesPrefix);
    suite.setupTest(done);
  });

  afterEach(function (done) {
    suite.teardownTest(done);
  });

  describe('prepare file directory test', function () {
    it('should create the test share', function (done) {
      shareName = suite.getName(shareNamesPrefix);
      fileService.createShareIfNotExists(shareName, function (createError) {
        assert.equal(createError, null);
        done();
      });
    });
  });

  describe('doesDirectoryExist', function () {
    it('should work', function (done) {
      fileService.doesDirectoryExist(shareName, directoryName, function (existsError, existsResult) {
        assert.equal(existsError, null);
        assert.strictEqual(existsResult.exists, false);

        fileService.createDirectory(shareName, directoryName, function (createError, directory1, createDirectoryResponse) {
          assert.equal(createError, null);
          assert.notEqual(directory1, null);
          assert.equal(createDirectoryResponse.statusCode, HttpConstants.HttpResponseCodes.Created);

          fileService.doesDirectoryExist(shareName, directoryName, function (existsError, existsResult) {
            assert.equal(existsError, null);
            assert.strictEqual(existsResult.exists, true);
            assert.notEqual(existsResult.name, null);
            assert.notEqual(existsResult.etag, null);
            assert.notEqual(existsResult.lastModified, null);
            assert.notEqual(existsResult.requestId, null);
            done();
          });
        });
      });
    });

    it('base directory', function (done) {
      fileService.doesDirectoryExist(shareName, '', function (existsError, existsResult) {
        assert.equal(existsError, null);
        assert.strictEqual(existsResult.exists, true);
        assert.notEqual(existsResult.name, null);
        assert.notEqual(existsResult.etag, null);
        assert.notEqual(existsResult.lastModified, null);
        assert.notEqual(existsResult.requestId, null);
        done();
      });
    });
  });

  describe('createDirectory', function () {
    it('should detect incorrect directory names', function (done) {
      assert.throws(function () { fileService.createDirectory(shareName, null, function () { }); },
        function(err) {
          return (typeof err.name === 'undefined' || err.name === 'ArgumentNullError') && err.message === 'Required argument directory for function createDirectory is not defined'; 
        });
      assert.throws(function () { fileService.createDirectory(shareName, '', function () { }); },
        function(err) {
          return (typeof err.name === 'undefined' || err.name === 'ArgumentNullError') && err.message === 'Required argument directory for function createDirectory is not defined'; 
        });
      done();
    });

    it('should work', function (done) {
      fileService.createDirectory(shareName, directoryName, function (createError, directory1, createDirectoryResponse) {
        assert.equal(createError, null);
        assert.notEqual(directory1, null);
        if (directory1) {
          assert.notEqual(directory1.name, null);
          assert.notEqual(directory1.etag, null);
          assert.notEqual(directory1.lastModified, null);
        }

        assert.equal(createDirectoryResponse.statusCode, HttpConstants.HttpResponseCodes.Created);

        // creating again will result in a duplicate error
        fileService.createDirectory(shareName, directoryName, function (createError2, directory2) {
          assert.equal(createError2.code, Constants.StorageErrorCodeStrings.RESOURCE_ALREADY_EXISTS);
          assert.equal(directory2, null);

          fileService.deleteDirectory(shareName, directoryName, function (deleteError) {
              assert.equal(deleteError, null);
              done();
            });
        });
      });
    });

    it('should work when the directory name starts and ends with slash', function (done) {
      var directoryNameWithSlash = '/' + suite.getName(directoryNamesPrefix) + '/';
      fileService.createDirectory(shareName, directoryNameWithSlash, function (createError, directory1, createDirectoryResponse) {
        assert.equal(createError, null);
        assert.notEqual(directory1, null);
        if (directory1) {
          assert.notEqual(directory1.name, null);
          assert.notEqual(directory1.etag, null);
          assert.notEqual(directory1.lastModified, null);
        }

        assert.equal(createDirectoryResponse.statusCode, HttpConstants.HttpResponseCodes.Created);

        // creating again will result in a duplicate error
        fileService.createDirectory(shareName, directoryNameWithSlash, function (createError2, directory2) {
          assert.equal(createError2.code, Constants.StorageErrorCodeStrings.RESOURCE_ALREADY_EXISTS);
          assert.equal(directory2, null);

          fileService.deleteDirectory(shareName, directoryNameWithSlash, function (deleteError) {
              assert.equal(deleteError, null);
              done();
            });
        });
      });
    });
  }); 

  describe('createDirectoryIfNotExists', function() {
    it('should create a directory if not exists', function (done) {
      fileService.createDirectoryIfNotExists(shareName, directoryName, function (createError, createResult) {
        assert.equal(createError, null);
        assert.equal(createResult.created, true);
        assert.notEqual(createResult.name, null);
        assert.notEqual(createResult.etag, null);
        assert.notEqual(createResult.lastModified, null);
        assert.notEqual(createResult.requestId, null);

        fileService.doesDirectoryExist(shareName, directoryName, function (existsError, existsResult) {
          assert.equal(existsError, null);
          assert.equal(existsResult.exists, true);
          assert.notEqual(existsResult.name, null);
          assert.notEqual(existsResult.etag, null);
          assert.notEqual(existsResult.lastModified, null);
          assert.notEqual(existsResult.requestId, null);

          fileService.createDirectoryIfNotExists(shareName, directoryName, function (createError2, createdResult2) {
            assert.equal(createError2, null);
            assert.equal(createdResult2.created, false);
            assert.notEqual(createdResult2.name, null);
            assert.notEqual(createdResult2.etag, null);
            assert.notEqual(createdResult2.lastModified, null);
            assert.notEqual(createdResult2.requestId, null);

            fileService.deleteDirectory(shareName, directoryName, function (deleteError) {
              assert.equal(deleteError, null);

              fileService.doesDirectoryExist(shareName, directoryName, function (existsError, existsResult) {
                assert.equal(existsError, null);
                assert.strictEqual(existsResult.exists, false);
                done();
              });
            });
          });
        });
      });
    });

    it('should throw if called without a callback', function (done) {
      assert.throws(function () { fileService.createDirectoryIfNotExists('name'); },
        function (err) { return typeof err.name === 'undefined' || err.name === 'ArgumentNullError';}
      );

      done();
    });
  });

  describe('deleteDirectoryIfExists', function() {
    it('should delete a directory if exists', function (done) {
      fileService.doesDirectoryExist(shareName, directoryName, function(existsError, existsResult){
        assert.equal(existsError, null);
        assert.strictEqual(existsResult.exists, false);

        fileService.deleteDirectoryIfExists(shareName, directoryName, function (deleteError, deleted) {
          assert.equal(deleteError, null);
          assert.strictEqual(deleted, false);

          fileService.createDirectory(shareName, directoryName, function (createError, directory1, createDirectoryResponse) {
            assert.equal(createError, null);
            assert.notEqual(directory1, null);
            assert.notEqual(directory1.name, null);
            assert.notEqual(directory1.etag, null);
            assert.notEqual(directory1.lastModified, null);

            assert.equal(createDirectoryResponse.statusCode, HttpConstants.HttpResponseCodes.Created);

            // delete if exists should succeed
            fileService.deleteDirectoryIfExists(shareName, directoryName, function (deleteError2, deleted2) {
              assert.equal(deleteError2, null);
              assert.strictEqual(deleted2, true);

              fileService.doesDirectoryExist(shareName, directoryName, function(existsError, existsResult){
                assert.equal(existsError, null);
                assert.strictEqual(existsResult.exists, false);
                done();
              });
            });
          });
        });
      });
    });

    it('should throw if called without a callback', function (done) {
      assert.throws(function () { fileService.deleteDirectoryIfExists('name'); },
      function (err) { return typeof err.name === 'undefined' || err.name === 'ArgumentNullError';}
    );
      done();
    });
  });

  describe('getDirectoryProperties', function () {
    it('should work', function (done) {
      fileService.createDirectoryIfNotExists(shareName, directoryName, function (createError, createResult) {
        assert.equal(createError, null);
        assert.equal(createResult.created, true);
        assert.notEqual(createResult.name, null);
        assert.notEqual(createResult.etag, null);
        assert.notEqual(createResult.lastModified, null);
        assert.notEqual(createResult.requestId, null);

        fileService.getDirectoryProperties(shareName, directoryName, function (getError, directory2, getResponse) {
          assert.equal(getError, null);
          assert.notEqual(directory2, null);
          assert.notEqual(getResponse, null);
          assert.equal(getResponse.isSuccessful, true);

          assert.notEqual(directory2.name, null);
          assert.notEqual(directory2.etag, null);
          assert.notEqual(directory2.lastModified, null);
          assert.notEqual(directory2.requestId, null);

          fileService.deleteDirectory(shareName, directoryName, function (deleteError) {
            assert.equal(deleteError, null);
            done();
          });
        });
      });
    });

    it('base directory', function (done) {
      fileService.getDirectoryProperties(shareName, '', function (getError, directory2, getResponse) {
        assert.equal(getError, null);
        assert.notEqual(directory2, null);
        assert.notEqual(getResponse, null);
        assert.equal(getResponse.isSuccessful, true);

        assert.equal(directory2.name, '');
        assert.notEqual(directory2.etag, null);
        assert.notEqual(directory2.lastModified, null);
        assert.notEqual(directory2.requestId, null);

        done();
      });
    });
  });

  describe('listFilesAndDirectories', function () {
    var files;
    var directories;
    var directoryName1;
    var directoryName2;
    var fileName1;
    var fileName2;
    var fileText1;
    var fileText2;

    before (function (done) {
      directoryName1 = suite.getName(directoryNamesPrefix);
      directoryName2 = suite.getName(directoryNamesPrefix);
      fileName1 = suite.getName(fileNamesPrefix);
      fileName2 = suite.getName(fileNamesPrefix);
      fileText1 = 'hello1';
      fileText2 = 'hello2';
      done();
    });    

    var listFilesAndDirectories = function (shareName, directoryName, prefix, token, callback) {
      fileService.listFilesAndDirectoriesSegmentedWithPrefix(shareName, directoryName, prefix, token, function(error, result) {
        assert.equal(error, null);
        files.push.apply(files, result.entries.files);
        directories.push.apply(directories, result.entries.directories);
        var token = result.continuationToken;
        if(token) {
          listFilesAndDirectories(shareName, directoryName, prefix, token, callback);
        }
        else {
          callback();
        }
      });
    };

    beforeEach(function (done) {
      files = [];
      directories = [];

      fileService.createDirectoryIfNotExists(shareName, directoryName, function (createError, createResult) {
        assert.equal(createError, null);
        assert.equal(createResult.created, true);
        assert.notEqual(createResult.name, null);
        assert.notEqual(createResult.etag, null);
        assert.notEqual(createResult.lastModified, null);
        assert.notEqual(createResult.requestId, null);
        done();
      });
    });

    it('empty', function (done) {
      listFilesAndDirectories(shareName, directoryName, null, null, function() {
        assert.equal(files.length, 0);
        done();
      });
    });

    it('singleDirectory', function (done) {
      fileService.createDirectory(shareName, directoryName + '/' + directoryName1, function (dirErr1) {
        assert.equal(dirErr1, null);

        // Test listing 1 file
        listFilesAndDirectories(shareName, directoryName, null, null, function() {
          assert.equal(directories.length, 1);
          assert.equal(directories[0].name, directoryName1);
          done();
        });
      });
    });

    it('singleFile', function (done) {
      fileService.createFile(shareName, directoryName, fileName1, 0, function (fileErr1) {
        assert.equal(fileErr1, null);

        // Test listing 1 file
        listFilesAndDirectories(shareName, directoryName, null, null, function() {
          assert.equal(files.length, 1);
          assert.equal(files[0].name, fileName1);
          done();
        });
      });
    });

    it('multipleDirectoryAndFile', function (done) {
      fileService.createDirectory(shareName, directoryName + '/' + directoryName1, function (dirErr1) {
        assert.equal(dirErr1, null);

        fileService.createDirectory(shareName, directoryName + '/' + directoryName2, function (dirErr2) {
          assert.equal(dirErr2, null);

          fileService.createFile(shareName, directoryName, fileName1, 0, function (fileErr1) {
            assert.equal(fileErr1, null);

            fileService.createFile(shareName, directoryName, fileName2, 0, function (fileErr2) {
              assert.equal(fileErr2, null);

              // Test listing 1 file
              listFilesAndDirectories(shareName, directoryName, null, null, function() {
                assert.equal(directories.length, 2);
                assert.equal(directories[0].name, directoryName1);
                assert.equal(directories[1].name, directoryName2);
                assert.equal(files.length, 2);
                assert.equal(files[0].name, fileName1);
                assert.equal(files[1].name, fileName2);
                done();
              });
            });
          });
        });
      });
    });

    it('multipleLevelsDirectory', function (done) {
      fileService.createFile(shareName, directoryName, fileName1, 0, function (fileErr1) {
        assert.equal(fileErr1, null);

        var nextDirectory = directoryName + "/next";
        var dotdotDirectory = nextDirectory + "/..";

        listFilesAndDirectories(shareName, dotdotDirectory, null, null, function() {
          assert.equal(directories.length, 0);
          assert.equal(files.length, 1);
          assert.equal(files[0].name, fileName1);

          files = [];
          directories = [];

          fileService.createDirectory(shareName, nextDirectory, function(dirErr2) {
            assert.equal(dirErr2, null);

            listFilesAndDirectories(shareName, dotdotDirectory, null, null, function() {
              assert.equal(directories.length, 1);
              assert.equal(directories[0].name, "next");
              assert.equal(files.length, 1);
              assert.equal(files[0].name, fileName1);
              done();
            });
          });
        });
      });
    });

    it('list with prefix should work', function (done) {
      var prefixTest = 'prefixtest-';
      var prefixTestDirectoryName1 = suite.getName(prefixTest);
      var prefixTestDirectoryName2 = suite.getName(prefixTest);
      var prefixTestFileName1 = suite.getName(prefixTest);
      var prefixTestFileName2 = suite.getName(prefixTest);

      fileService.createDirectory(shareName, prefixTestDirectoryName1, function(err){
        assert.equal(err, null);
        
        fileService.createDirectory(shareName, prefixTestDirectoryName2, function(err){
          assert.equal(err, null);

          fileService.createFile(shareName, '', prefixTestFileName1, 0, function (fileErr1) {
            assert.equal(fileErr1, null);

            fileService.createFile(shareName, '', prefixTestFileName2, 0, function (fileErr1) {
              assert.equal(fileErr1, null);

              files = [];
              directories = [];
              
              listFilesAndDirectories(shareName, '', prefixTest, null, function() {
                assert.equal(files.length, 2);
                assert.equal(directories.length, 2);
                done();
              });
            });
          });
        });
      });
    });
  });
  
  describe('directoryMetadata', function () {
    it('should work', function (done) {
      fileService.createDirectory(shareName, directoryName, function (createError) {
        assert.equal(createError, null);
        
        var metadata = { 'Class': 'Test' };
        fileService.setDirectoryMetadata(shareName, directoryName, metadata, function (setMetadataError, setMetadataResult, setMetadataResponse) {
          assert.equal(setMetadataError, null);
          assert.ok(setMetadataResponse.isSuccessful);
          
          fileService.getDirectoryMetadata(shareName, directoryName, function (getMetadataError, file, getMetadataResponse) {
            assert.equal(getMetadataError, null);
            assert.notEqual(file, null);
            assert.notEqual(file.metadata, null);
            if (suite.metadataCaseSensitive) {
              assert.equal(file.metadata.Class, 'Test');
            } else {
              assert.equal(file.metadata.class, 'Test');
            }
            assert.ok(getMetadataResponse.isSuccessful);
            
            done();
          });
        });
      });
    });
    
    it('withCreate', function (done) {
      var metadata = { 'Class': 'Test' };
      fileService.createDirectory(shareName, directoryName, { metadata: metadata }, function (createError) {
        assert.equal(createError, null);
        
        fileService.getDirectoryMetadata(shareName, directoryName, function (getMetadataError, file, getMetadataResponse) {
          assert.equal(getMetadataError, null);
          assert.notEqual(file, null);
          assert.notEqual(file.metadata, null);
          if (suite.metadataCaseSensitive) {
            assert.equal(file.metadata.Class, 'Test');
          } else {
            assert.equal(file.metadata.class, 'Test');
          }
          assert.ok(getMetadataResponse.isSuccessful);
          
          done();
        });
      });
    });
    
    it('withGetProperties', function (done) {
      fileService.createDirectory(shareName, directoryName, function (createError) {
        assert.equal(createError, null);
        
        var metadata = { 'Color': 'Blue' };
        fileService.setDirectoryMetadata(shareName, directoryName, metadata, function (setMetadataError, setMetadataResult, setMetadataResponse) {
          assert.equal(setMetadataError, null);
          assert.ok(setMetadataResponse.isSuccessful);
          
          fileService.getDirectoryProperties(shareName, directoryName, function (getError, directory, getResponse) {
            assert.equal(getError, null);
            assert.notEqual(directory, null);
            assert.notEqual(directory.requestId, null);
            if (suite.metadataCaseSensitive) {
            assert.strictEqual(directory.metadata.Color, metadata.Color);
            } else {
            assert.strictEqual(directory.metadata.color, metadata.Color);
            }
            
            assert.notEqual(getResponse, null);
            assert.equal(getResponse.isSuccessful, true);
            
            done();
          });
        });
      });
    });

    it('should ignore the metadata in the options', function (done) {
      fileService.createDirectory(shareName, directoryName, function (createError) {
        assert.equal(createError, null);
        
        var metadata = { 'Class': 'Test' };
        var options = { metadata: { color: 'White', Color: 'Black', COLOR: 'yellow' } }; 
        fileService.setDirectoryMetadata(shareName, directoryName, metadata, options, function (setMetadataError, setMetadataResult, setMetadataResponse) {
          assert.equal(setMetadataError, null);
          assert.ok(setMetadataResponse.isSuccessful);
          
          fileService.getDirectoryMetadata(shareName, directoryName, function (getMetadataError, file, getMetadataResponse) {
            assert.equal(getMetadataError, null);
            assert.notEqual(file, null);
            assert.notEqual(file.metadata, null);
            if (suite.metadataCaseSensitive) {
              assert.equal(file.metadata.Class, 'Test');
            } else {
              assert.equal(file.metadata.class, 'Test');
            }
            assert.ok(getMetadataResponse.isSuccessful);
            
            done();
          });
        });
      });
    });

    it('should merge or replace the metadata', function (done) {
      fileService.createDirectory(shareName, directoryName, function (createError) {
        assert.equal(createError, null);
        
        var metadata = { color: 'blue', Color: 'Orange', COLOR: 'Red' };
        fileService.setDirectoryMetadata(shareName, directoryName, metadata, function (setMetadataError, setMetadataResult, setMetadataResponse) {
          assert.equal(setMetadataError, null);
          assert.ok(setMetadataResponse.isSuccessful);
          
          fileService.getDirectoryProperties(shareName, directoryName, function (getError, directory, getResponse) {
            assert.equal(getError, null);
            assert.notEqual(directory, null);
            assert.notEqual(directory.requestId, null);
            assert.strictEqual(directory.metadata.color, 'blue,Orange,Red');
            
            assert.notEqual(getResponse, null);
            assert.equal(getResponse.isSuccessful, true);
            
            metadata = { color: 'white', Color: 'BLACK' };
            fileService.setDirectoryMetadata(shareName, directoryName, metadata, function (setMetadataError, setMetadataResult, setMetadataResponse) {
              assert.equal(setMetadataError, null);
              assert.ok(setMetadataResponse.isSuccessful);

              fileService.getDirectoryProperties(shareName, directoryName, function (getError, directory, getResponse) {
                assert.equal(getError, null);
                assert.notEqual(directory, null);
                assert.notEqual(directory.requestId, null);
                assert.strictEqual(directory.metadata.color, 'white,BLACK');
                
                assert.notEqual(getResponse, null);
                assert.equal(getResponse.isSuccessful, true);

                done();
              });
            });
          });
        });
      });
    });
  });

  describe('cleanup file directory test', function () {
    it('should delete the test share', function (done) {
      fileService.deleteShareIfExists(shareName, function (deleteError) {
        assert.equal(deleteError, null);
        done();
      });
    });
  });
});