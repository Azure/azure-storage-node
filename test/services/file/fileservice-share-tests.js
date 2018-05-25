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
var url = require('url');

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
var FileUtilities = azure.FileUtilities;
var HttpConstants = Constants.HttpConstants;

var shareNamesPrefix = 'share-test-share-';

var fileService;
var shareName;

var suite = new TestSuite('fileservice-share-tests');
var runOrSkip = testutil.itSkipMock(suite.isMocked);
var skipBrowser = testutil.itSkipBrowser();
var skipMockAndBrowser = testutil.itSkipMockAndBrowser(suite.isMocked);
var timeout = (suite.isRecording || !suite.isMocked) ? 30000 : 10;

describe('FileShare', function () {
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
    shareName = suite.getName(shareNamesPrefix);
    suite.setupTest(done);
  });

  afterEach(function (done) {
    fileService.deleteShareIfExists(shareName, function (deleteError) {
      assert.equal(deleteError, null);
      suite.teardownTest(done);
    });
  });

  describe('doesShareExist', function () {
    it('should work', function (done) {
      fileService.doesShareExist(shareName, function (existsError, existsResult) {
        assert.equal(existsError, null);
        assert.strictEqual(existsResult.exists, false);

        fileService.createShare(shareName, function (createError, share1, createShareResponse) {
          assert.equal(createError, null);
          assert.notEqual(share1, null);
          assert.equal(createShareResponse.statusCode, HttpConstants.HttpResponseCodes.Created);

          fileService.doesShareExist(shareName, function (existsError, existsResult2) {
            assert.equal(existsError, null);
            assert.strictEqual(existsResult2.exists, true);
            assert.notEqual(existsResult2.name, null);
            assert.notEqual(existsResult2.etag, null);
            assert.notEqual(existsResult2.lastModified, null);
            done();
          });
        });
      });
    });
  });

  describe('createShare', function () {
    it('should detect incorrect share names', function (done) {
      assert.throws(function () { fileService.createShare(null, function () { }); },
        function(err) {
          return (typeof err.name === 'undefined' || err.name === 'ArgumentNullError') && err.message === 'Required argument share for function createShare is not defined'; 
        });

      assert.throws(function () { fileService.createShare('', function () { }); },
        function(err) {
          return (typeof err.name === 'undefined' || err.name === 'ArgumentNullError') && err.message === 'Required argument share for function createShare is not defined'; 
        });

      assert.throws(function () { fileService.createShare('as', function () { }); },
       function(err) {
        if ((typeof err.name === 'undefined' || err.name === 'ArgumentError') && err.message === 'Share name must be between 3 and 63 characters long.') {
          return true;
        }
      });

      assert.throws(function () { fileService.createShare('a--s', function () { }); },
        function(err){
          return (err instanceof SyntaxError) && err.message === 'Share name format is incorrect.'; 
        });

      assert.throws(function () { fileService.createShare('cont-', function () { }); },
        function(err){
          return (err instanceof SyntaxError) && err.message === 'Share name format is incorrect.'; 
        });

      assert.throws(function () { fileService.createShare('conTain', function () { }); },
        function(err){
          return (err instanceof SyntaxError) && err.message === 'Share name format is incorrect.'; 
        });

      done();
    });

    it('should work with options', function (done) {
      var quotaValue = 10;
      var options = { quota: quotaValue };
      fileService.createShare(shareName, options, function (createError, share1, createShareResponse) {
        assert.equal(createError, null);
        assert.notEqual(share1, null);
        if (share1) {
          assert.notEqual(share1.name, null);
          assert.notEqual(share1.etag, null);
          assert.notEqual(share1.lastModified, null);
        }

        assert.equal(createShareResponse.statusCode, HttpConstants.HttpResponseCodes.Created);

        // creating again will result in a duplicate error
        fileService.createShare(shareName, function (createError2, share2) {
          assert.equal(createError2.code, Constants.FileErrorCodeStrings.SHARE_ALREADY_EXISTS);
          assert.equal(share2, null);

          fileService.getShareProperties(shareName, function (getError, shareResult, getResponse) {
            assert.equal(getError, null);
            assert.notEqual(shareResult, null);
            assert.notEqual(shareResult.requestId, null);
            assert.equal(shareResult.quota, quotaValue);
            
            assert.notEqual(getResponse, null);
            assert.equal(getResponse.isSuccessful, true);
            
            fileService.deleteShare(shareName, function (deleteError) {
              assert.equal(deleteError, null);
              done();
            });
          });
        });
      });
    });
  });

  describe('createShareIfNotExists', function() {
    it('should create a share if not exists', function (done) {
      fileService.createShareIfNotExists(shareName, function (createError, createResult) {
        assert.equal(createError, null);
        assert.equal(createResult.created, true);

        fileService.doesShareExist(shareName, function (existsError, existsResult) {
          assert.equal(existsError, null);
          assert.equal(existsResult.exists, true);
          assert.notEqual(existsResult.etag, null);
          assert.notEqual(existsResult.lastModified, null);

          fileService.createShareIfNotExists(shareName, function (createError2, createdResult2) {
            assert.equal(createError2, null);
            assert.equal(createdResult2.created, false);
            assert.notEqual(createdResult2.name, null);
            assert.notEqual(createdResult2.etag, null);
            assert.notEqual(createdResult2.lastModified, null);

            fileService.deleteShare(shareName, function (deleteError) {
              assert.equal(deleteError, null);
              fileService.createShareIfNotExists(shareName, function (createError3) {
                assert.notEqual(createError3, null);
                assert.equal(createError3.code, 'ShareBeingDeleted');
                done();
              });
            });
          });
        });
      });
    });

    it('should throw if called without a callback', function (done) {
      assert.throws(function () { fileService.createShareIfNotExists('name'); },
        function (err) { return typeof err.name === 'undefined' || err.name === 'ArgumentNullError';}
      );

      done();
    });
  });

  describe('deleteShareIfExists', function() {
    it('should delete a share if exists', function (done) {
      fileService.doesShareExist(shareName, function(existsError, existsResult){
        assert.equal(existsError, null);
        assert.strictEqual(existsResult.exists, false);

        fileService.deleteShareIfExists(shareName, function (deleteError, deleted) {
          assert.equal(deleteError, null);
          assert.strictEqual(deleted, false);

          fileService.createShare(shareName, function (createError, share1, createShareResponse) {
            assert.equal(createError, null);
            assert.notEqual(share1, null);
            assert.notEqual(share1.name, null);
            assert.notEqual(share1.etag, null);
            assert.notEqual(share1.lastModified, null);

            assert.equal(createShareResponse.statusCode, HttpConstants.HttpResponseCodes.Created);

            // delete if exists should succeed
            fileService.deleteShareIfExists(shareName, function (deleteError2, deleted2) {
              assert.equal(deleteError2, null);
              assert.strictEqual(deleted2, true);

              fileService.doesShareExist(shareName, function(existsError, existsResult){
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
      assert.throws(function () { fileService.deleteShareIfExists('name'); },
        function (err) { return typeof err.name === 'undefined' || err.name === 'ArgumentNullError';}
      );
      done();
    });
  });
  
  describe('setShareProperties', function () {
    it('should work', function (done) {
      fileService.createShareIfNotExists(shareName, function (createError, createResult) {
        assert.equal(createError, null);
        assert.equal(createResult.created, true);
        
        var quotaValue = 30;
        var properties = { quota: quotaValue };
        fileService.setShareProperties(shareName, properties, function (setPropError, setPropResult, setPropResponse) {
          assert.equal(setPropError, null);
          assert.ok(setPropResponse.isSuccessful);
          
          fileService.getShareProperties(shareName, function (getError, share2, getResponse) {
            assert.equal(getError, null);
            assert.notEqual(share2, null);
            assert.notEqual(null, share2.requestId);
            assert.equal(share2.quota, quotaValue);
            
            assert.notEqual(getResponse, null);
            assert.equal(getResponse.isSuccessful, true);
            
            fileService.deleteShare(shareName, function (deleteError) {
              assert.equal(deleteError, null);
              done();
            });
          });
        });
      });
    });
  });

  describe('getShareProperties', function () {
    skipBrowser('should work', function (done) {
      fileService.createShareIfNotExists(shareName, function (createError, createResult) {
        assert.equal(createError, null);
        assert.equal(createResult.created, true);

        var metadata = { 'Color': 'Blue' };
        fileService.setShareMetadata(shareName, metadata, function (setMetadataError, setMetadataResult, setMetadataResponse) {
          assert.equal(setMetadataError, null);
          assert.ok(setMetadataResponse.isSuccessful);

          fileService.getShareProperties(shareName, function (getError, share2, getResponse) {
            assert.equal(getError, null);
            assert.notEqual(share2, null);
            assert.notEqual(null, share2.requestId);
            if (suite.metadataCaseSensitive) {
              assert.strictEqual(share2.metadata.Color, metadata.Color);
            } else {
              assert.strictEqual(share2.metadata.color, metadata.Color);
            }

            assert.notEqual(getResponse, null);
            assert.equal(getResponse.isSuccessful, true);

            fileService.deleteShare(shareName, function (deleteError) {
              assert.equal(deleteError, null);
              done();
            });
          });
        });
      });
    });
  });

  describe('setShareMetadata', function () {
    it('should work', function (done) {
      fileService.createShareIfNotExists(shareName, function (createError, createResult) {
        assert.equal(createError, null);
        assert.equal(createResult.created, true);

        var metadata = { 'class': 'test' };
        fileService.setShareMetadata(shareName, metadata, function (setMetadataError, setMetadataResult, setMetadataResponse) {
          assert.equal(setMetadataError, null);
          assert.ok(setMetadataResponse.isSuccessful);

          fileService.getShareMetadata(shareName, function (getMetadataError, shareMetadata, getMetadataResponse) {
            assert.equal(getMetadataError, null);
            assert.notEqual(shareMetadata, null);
            assert.notEqual(shareMetadata.metadata, null);
            assert.equal(shareMetadata.metadata.class, 'test');
            assert.ok(getMetadataResponse.isSuccessful);

            fileService.deleteShare(shareName, function (deleteError) {
              assert.equal(deleteError, null);
              done();
            });
          });
        });
      });
    });

    it('should merge the metadata', function (done) {
      fileService.createShareIfNotExists(shareName, function (createError, createResult) {
        assert.equal(createError, null);
        assert.equal(createResult.created, true);

        var metadata = { color: 'blue', Color: 'Orange', COLOR: 'Red' };
        fileService.setShareMetadata(shareName, metadata, function (setMetadataError, setMetadataResult, setMetadataResponse) {
          assert.equal(setMetadataError, null);
          assert.ok(setMetadataResponse.isSuccessful);

          fileService.getShareMetadata(shareName, function (getMetadataError, shareMetadata, getMetadataResponse) {
            assert.equal(getMetadataError, null);
            assert.notEqual(shareMetadata, null);
            assert.notEqual(shareMetadata.metadata, null);
            assert.equal(shareMetadata.metadata.color, 'blue,Orange,Red');
            assert.ok(getMetadataResponse.isSuccessful);

            fileService.deleteShare(shareName, function (deleteError) {
              assert.equal(deleteError, null);
              done();
            });
          });
        });
      });
    });

    it('should ignore the metadata in the options', function (done) {
      fileService.createShareIfNotExists(shareName, function (createError, createResult) {
        assert.equal(createError, null);
        assert.equal(createResult.created, true);

        var metadata = { color: 'blue', Color: 'Orange', COLOR: 'Red' };
        var options = { metadata: { color: 'White', Color: 'Black', COLOR: 'yellow' } };
        fileService.setShareMetadata(shareName, metadata, options, function (setMetadataError, setMetadataResult, setMetadataResponse) {
          assert.equal(setMetadataError, null);
          assert.ok(setMetadataResponse.isSuccessful);

          fileService.getShareMetadata(shareName, function (getMetadataError, shareMetadata, getMetadataResponse) {
            assert.equal(getMetadataError, null);
            assert.notEqual(shareMetadata, null);
            assert.notEqual(shareMetadata.metadata, null);
            assert.strictEqual(shareMetadata.metadata.color, 'blue,Orange,Red');
            assert.ok(getMetadataResponse.isSuccessful);

            fileService.deleteShare(shareName, function (deleteError) {
              assert.equal(deleteError, null);
              done();
            });
          });
        });
      });
    });
  });

  describe('setShareMetadataThrows', function () {
    it('should work', function (done) {
      function setShareMetadata(shareName, metadata) {
        fileService.setShareMetadata(shareName, metadata, function(){});
      }

      assert.throws( function() { setShareMetadata(shareName, {'' : 'value1'}); },
        function (err) {return (typeof err.name === 'undefined' || err.name === 'ArgumentError') && err.message === SR.METADATA_KEY_INVALID});
      assert.throws( function() { setShareMetadata(shareName, {' ' : 'value1'}); },
        function (err) {return (typeof err.name === 'undefined' || err.name === 'ArgumentError') && err.message === SR.METADATA_KEY_INVALID});
      assert.throws( function() { setShareMetadata(shareName, {'\n\t' : 'value1'}); },
        function (err) {return (typeof err.name === 'undefined' || err.name === 'ArgumentError') && err.message === SR.METADATA_KEY_INVALID});

      assert.throws( function() { setShareMetadata(shareName, {'key1' : null}); },
        function (err) {return (typeof err.name === 'undefined' || err.name === 'ArgumentError') && err.message === SR.METADATA_VALUE_INVALID});
      assert.throws( function() { setShareMetadata(shareName, {'key1' : ''}); },
        function (err) {return (typeof err.name === 'undefined' || err.name === 'ArgumentError') && err.message === SR.METADATA_VALUE_INVALID});
      assert.throws( function() { setShareMetadata(shareName, {'key1' : '\n\t'}); },
        function (err) {return (typeof err.name === 'undefined' || err.name === 'ArgumentError') && err.message === SR.METADATA_VALUE_INVALID});
      assert.throws( function() { setShareMetadata(shareName, {'key1' : ' '}); },
        function (err) {return (typeof err.name === 'undefined' || err.name === 'ArgumentError') && err.message === SR.METADATA_VALUE_INVALID});

      done();
    });
  });

  describe('listShares', function () {
    it('shouldWork', function (done) {
      var shareName1 = suite.getName(shareNamesPrefix);
      var metadata1 = {
        color: 'orange',
        sharenumber: '01',
        somemetadataname: 'SomeMetadataValue'
      };

      var shareName2 = suite.getName(shareNamesPrefix);
      var metadata2 = {
        color: 'pink',
        sharenumber: '02',
        somemetadataname: 'SomeMetadataValue'
      };

      var shareName3 = suite.getName(shareNamesPrefix);
      var metadata3 = {
        color: 'brown',
        sharenumber: '03',
        somemetadataname: 'SomeMetadataValue'
      };

      var shareName4 = suite.getName(shareNamesPrefix);
      var metadata4 = {
        color: 'blue',
        sharenumber: '04',
        somemetadataname: 'SomeMetadataValue'
      };

      var validateAndDeleteShares = function (shares, callback) {
        var entries = [];
        shares.forEach(function (share) {
          if (share.name == shareName1) {
            assert.equal(share.metadata.color, metadata1.color);
            assert.equal(share.metadata.sharenumber, metadata1.sharenumber);
            assert.equal(share.metadata.somemetadataname, metadata1.somemetadataname);
            entries.push(share.name);
          } else if (share.name == shareName2) {
            assert.equal(share.metadata.color, metadata2.color);
            assert.equal(share.metadata.sharenumber, metadata2.sharenumber);
            assert.equal(share.metadata.somemetadataname, metadata2.somemetadataname);
            entries.push(share.name);
          } else if (share.name == shareName3) {
            assert.equal(share.metadata.color, metadata3.color);
            assert.equal(share.metadata.sharenumber, metadata3.sharenumber);
            assert.equal(share.metadata.somemetadataname, metadata3.somemetadataname);
            entries.push(share.name);
          } else if (share.name == shareName4) {
            assert.equal(share.metadata.color, metadata4.color);
            assert.equal(share.metadata.sharenumber, metadata4.sharenumber);
            assert.equal(share.metadata.somemetadataname, metadata4.somemetadataname);
            entries.push(share.name);
          }
        });
        
        fileService.deleteShare(shareName1, function (err) {
          assert.equal(null, err);
          fileService.deleteShare(shareName2, function (err) {
            assert.equal(null, err);
            fileService.deleteShare(shareName3, function (err) {
              assert.equal(null, err);
              fileService.deleteShare(shareName4, function (err) {
                assert.equal(null, err);
                callback(entries);
              });
            });
          });
        });
      };

      fileService.createShare(shareName1, { metadata: metadata1 }, function (createError1, createShare1, createResponse1) {
        assert.equal(createError1, null);
        assert.notEqual(createShare1, null);
        assert.ok(createResponse1.isSuccessful);

        fileService.createShare(shareName2, { metadata: metadata2 }, function (createError2, createShare2, createResponse2) {
          assert.equal(createError2, null);
          assert.notEqual(createShare2, null);
          assert.ok(createResponse2.isSuccessful);

          fileService.createShare(shareName3, { metadata: metadata3 }, function (createError3, createShare3, createResponse3) {
            assert.equal(createError3, null);
            assert.notEqual(createShare3, null);
            assert.ok(createResponse3.isSuccessful);

            fileService.createShare(shareName4, { metadata: metadata4 }, function (createError4, createShare4, createResponse4) {
              assert.equal(createError4, null);
              assert.notEqual(createShare4, null);
              assert.ok(createResponse4.isSuccessful);

              var options = {
                'maxResults': 3,
                'include': 'metadata',
              };

              listShares(shareNamesPrefix, options, null, function (shares) {
                validateAndDeleteShares(shares, function(entries){
                  assert.equal(entries.length, 4);
                  done();
                });
              });
            });
          });
        });
      });
    });

    it('noPrefix', function (done) {
      var listSharesWithoutPrefix = function (options, token, callback) {
        fileService.listSharesSegmented(token, options, function(error, result) {
          assert.equal(error, null);
          var token = result.continuationToken;
          if(token) {
            listSharesWithoutPrefix(options, token, callback);
          } else {
            callback();
          }
        });
      };

      listSharesWithoutPrefix(null, null, function () {
        done();
      });
    });

    it('strangePrefix', function (done) {
      listShares('中文', null, null, function (shares) {
        assert.equal(shares.length, 0);
        done();
      });
    });
  });

  describe('shared access signature', function () {
    it('should work with shared access policy', function (done) {
      var share = 'testshare';
      var directoryName = "testdir";
      var fileName = "testfile";
      var fileServiceassert = azure.createFileService('storageAccount', 'storageAccessKey', 'host.com:80');
      var sharedAccessPolicy = {
        AccessPolicy: {
          Expiry: new Date('February 12, 2015 11:03:40 am GMT')
        }
      };
      
      var fileUrl = fileServiceassert.getUrl(share, directoryName, fileName, fileServiceassert.generateSharedAccessSignature(share, directoryName, fileName, sharedAccessPolicy));
      var parsedUrl = url.parse(fileUrl);
      assert.strictEqual(parsedUrl.protocol, 'https:');
      assert.strictEqual(parsedUrl.port, '80');
      assert.strictEqual(parsedUrl.hostname, 'host.com');
      assert.strictEqual(parsedUrl.pathname, '/' + share + '/' + directoryName + '/' + fileName);
      assert.strictEqual(parsedUrl.query, 'se=2015-02-12T11%3A03%3A40Z&sv=2017-11-09&sr=f&sig=ujwkkIKMGjOheGKFrqXBezbccfQ5L%2FOa0t7BP2ntM2E%3D');
      
      done();
    });

    // Skip this case in nock because the signing key is different between live run and mocked run
    runOrSkip('should work with share and file policies', function (done) {
      var readWriteSharePolicy = {
        AccessPolicy: {
          Permissions: 'rw',
          Expiry: new Date('2020-10-01')
        }
      };
      
      var readCreateSharePolicy = {
        AccessPolicy: {
          Permissions: 'rc',
          Expiry: new Date('2020-10-01')
        }
      };

      var filePolicy = {
        AccessPolicy: {
          Permissions: 'd',
          Expiry: new Date('2020-10-10')
        }
      };
      
      fileService.createShareIfNotExists(shareName, function (createError, share, createResponse) {
        var fileName = suite.getName("file-");
        var directoryName = '.';
        var shareSas = fileService.generateSharedAccessSignature(shareName, directoryName, null, readWriteSharePolicy);
        var fileServiceShareSas = azure.createFileServiceWithSas(fileService.host, shareSas);
        fileServiceShareSas.createFile(shareName, directoryName, fileName, 5, function (createError, file, createResponse) {
          assert.equal(createError, null);
          assert.strictEqual(file.share, shareName);
          assert.strictEqual(file.directory, directoryName);
          assert.strictEqual(file.name, fileName);
          var fileSas = fileService.generateSharedAccessSignature(shareName, directoryName, fileName, filePolicy);
          var fileServiceFileSas = azure.createFileServiceWithSas(fileService.host, fileSas);
          fileServiceFileSas.deleteFile(shareName, directoryName, fileName, function (deleteError) {
            assert.equal(deleteError, null);

            shareSas = fileService.generateSharedAccessSignature(shareName, directoryName, null, readCreateSharePolicy);
            fileServiceShareSas = azure.createFileServiceWithSas(fileService.host, shareSas);
            fileServiceShareSas.createFile(shareName, directoryName, fileName, 5, function (createError, file, createResponse) {
              assert.equal(createError, null);
              assert.strictEqual(file.share, shareName);
              assert.strictEqual(file.directory, directoryName);
              assert.strictEqual(file.name, fileName);

              fileServiceFileSas.deleteFile(shareName, directoryName, fileName, function (deleteError) {
                assert.equal(deleteError, null);

                done();
              });
            });
          });
        });
      });
    });
  });

  describe('getShareAcl', function () {
    it('should work', function (done) {
      fileService.createShareIfNotExists(shareName, function () {
        fileService.getShareAcl(shareName, function (shareAclError, shareResult, shareAclResponse) {
          assert.equal(shareAclError, null);
          assert.notEqual(shareResult, null);
          if (shareResult) {
            assert.equal(shareResult.publicAccessLevel, FileUtilities.SharePublicAccessType.OFF);
          }
          assert.equal(shareAclResponse.isSuccessful, true);
          done();
        });
      });
    });
  });
  
  describe('setShareAcl', function () {    
    it('should work with policies', function (done) {
      var readWriteStartDate = new Date(Date.UTC(2012, 10, 10));
      var readWriteExpiryDate = new Date(readWriteStartDate);
      readWriteExpiryDate.setMinutes(readWriteStartDate.getMinutes() + 10);
      readWriteExpiryDate.setMilliseconds(999);
      
      var signedIdentifiers = {
        readwrite: {
          Start: readWriteStartDate,
          Expiry: readWriteExpiryDate,
          Permissions: 'rw'
        },
        read: {
          Expiry: readWriteStartDate,
          Permissions: 'r'
        }
      };
      
      fileService.createShareIfNotExists(shareName, function () {
        var directoryName = suite.getName('dir-');
        
        fileService.createDirectoryIfNotExists(shareName, directoryName, function (directoryError, directoryResult, directoryResponse) {
          assert.equal(directoryError, null);
          assert.notEqual(directoryResult, null);
          
          fileService.setShareAcl(shareName, signedIdentifiers, function (setAclError, setAclShare1, setResponse1) {
            assert.equal(setAclError, null);
            assert.notEqual(setAclShare1, null);
            assert.ok(setResponse1.isSuccessful);
            
            setTimeout(function () {
              fileService.getShareAcl(shareName, function (getAclError, getAclShare1, getResponse1) {
                assert.equal(getAclError, null);
                assert.notEqual(getAclShare1, null);
                assert.equal(getAclShare1.publicAccessLevel, FileUtilities.SharePublicAccessType.OFF);
                assert.equal(getAclShare1.signedIdentifiers.readwrite.Expiry.getTime(), readWriteExpiryDate.getTime());
                assert.ok(getResponse1.isSuccessful);
                
                fileService.setShareAcl(shareName, {}, function (setAclError2, setAclShare2, setResponse2) {
                  assert.equal(setAclError2, null);
                  assert.notEqual(setAclShare2, null);
                  assert.ok(setResponse2.isSuccessful);
                  
                  setTimeout(function () {
                    fileService.getShareAcl(shareName, function (getAclError2, getAclShare2, getResponse3) {
                      assert.equal(getAclError2, null);
                      assert.notEqual(getAclShare2, null);
                      assert.equal(getAclShare2.publicAccessLevel, FileUtilities.SharePublicAccessType.OFF);
                      assert.ok(getResponse3.isSuccessful);
                      done();
                    });
                  }, timeout);
                });
              });
            }, timeout);
          });
        });
      });
    });
    
    it('should work with signed identifiers', function (done) {
      var signedIdentifiers = {
        id1: {
          Start: '2009-10-10T00:00:00.123Z',
          Expiry: '2009-10-11T00:00:00.456Z',
          Permissions: 'r'
        },
        id2: {
          Start: '2009-11-10T00:00:00.006Z',
          Expiry: '2009-11-11T00:00:00.4Z',
          Permissions: 'w'
        }
      };
      
      fileService.createShareIfNotExists(shareName, function () {
        var directoryName = suite.getName('dir-');
        var fileName = suite.getName('file-');
        var fileText = 'Hello World!';
        
        fileService.createDirectoryIfNotExists(shareName, directoryName, function (directoryError, directoryResult, directoryResponse) {
          assert.equal(directoryError, null);
          assert.notEqual(directoryResult, null);
          fileService.setShareAcl(shareName, signedIdentifiers, function (setAclError, setAclShare, setAclResponse) {
            assert.equal(setAclError, null);
            assert.notEqual(setAclShare, null);
            assert.ok(setAclResponse.isSuccessful);
            setTimeout(function () {
              fileService.getShareAcl(shareName, function (getAclError, shareAcl, getAclResponse) {
                assert.equal(getAclError, null);
                assert.notEqual(shareAcl, null);
                assert.notEqual(getAclResponse, null);
                
                if (getAclResponse) {
                  assert.equal(getAclResponse.isSuccessful, true);
                }
                
                assert.equal(shareAcl.signedIdentifiers.id1.Start.getTime(), new Date('2009-10-10T00:00:00.123Z').getTime());
                assert.equal(shareAcl.signedIdentifiers.id1.Expiry.getTime(), new Date('2009-10-11T00:00:00.456Z').getTime());
                assert.equal(shareAcl.signedIdentifiers.id1.Permissions, 'r');
                assert.equal(shareAcl.signedIdentifiers.id2.Start.getTime(), new Date('2009-11-10T00:00:00.006Z').getTime());
                assert.equal(shareAcl.signedIdentifiers.id2.Start.getMilliseconds(), 6);
                assert.equal(shareAcl.signedIdentifiers.id2.Expiry.getTime(), new Date('2009-11-11T00:00:00.4Z').getTime());
                assert.equal(shareAcl.signedIdentifiers.id2.Expiry.getMilliseconds(), 400);
                assert.equal(shareAcl.signedIdentifiers.id2.Permissions, 'w');
                
                done();
              });
            }, timeout);
          });
        });
      });
    });
  });
  
  describe('getShareStats', function () {
    it('should work', function (done) {
      fileService.createShareIfNotExists(shareName, function (createError, createResult) {
        assert.equal(createError, null);
        assert.equal(createResult.created, true);
        
        fileService.getShareStats(shareName, function (getError, stats, getResponse) {
          assert.equal(getError, null);
          assert.equal(stats.shareStats.shareUsage, 0);
          
          var fileText = 'hi there';
          var fileName = suite.getName("file-");
          fileService.createFileFromText(shareName, '', fileName, fileText, function (uploadErr) {
            assert.equal(uploadErr, null);
            
            fileService.getShareStats(shareName, function (getError, stats, getResponse) {
              assert.equal(getError, null);
              assert.equal(stats.shareStats.shareUsage, 1);

              fileService.deleteShare(shareName, function (deleteError) {
                assert.equal(deleteError, null);
                done();
              });
            });
          });
        });
      });
    });
  });

});

function listShares (prefix, options, token, callback) {
  var entries = [];
  // Helper function that allows us to do a full listing.
  var recursionHelper = function(err, result) {
    assert.equal(err, null);
    entries.push.apply(entries, result.entries);

    if (result.continuationToken) {
      // call list shares again with the new continuation token
      fileService.listSharesSegmentedWithPrefix(
        prefix,
        result.continuationToken,
        options,
        recursionHelper);
    } else {
      callback(entries);
    }
  };
  
  fileService.listSharesSegmentedWithPrefix(prefix, token, options, recursionHelper);
}