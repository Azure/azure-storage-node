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
var guid = require('uuid');

// Lib includes
var testutil = require('../../framework/util');
var SR = require('../../../lib/common/util/sr');
var TestSuite = require('../../framework/test-suite');

if (testutil.isBrowser()) {
  var azure = AzureStorage.Blob;
} else {
  var azure = require('../../../');
}
var Constants = azure.Constants;
var BlobUtilities = azure.BlobUtilities;
var HttpConstants = Constants.HttpConstants;

var containerNamesPrefix = 'cont-';
var blobNamesPrefix = 'blob-';

var suite = new TestSuite('blobservice-container-tests');
var skipBrowser = testutil.itSkipBrowser();
var timeout = (suite.isRecording || !suite.isMocked) ? 30000 : 10;

var blobService;
var containerName;

var blobs = [];

describe('BlobContainer', function () {
  before(function (done) {    
    if (suite.isMocked) {
      testutil.POLL_REQUEST_INTERVAL = 0;
    }
    suite.setupSuite(function () {
      blobService = azure.createBlobService(process.env['AZURE_STORAGE_CONNECTION_STRING']).withFilter(new azure.ExponentialRetryPolicyFilter());
      done();
    }); 
  });

  after(function (done) {
    suite.teardownSuite(done);
  });

  beforeEach(function (done) {
    containerName = suite.getName(containerNamesPrefix);
    suite.setupTest(function () {
      blobService.createContainerIfNotExists(containerName, function (createError, container) {
        assert.equal(createError, null);
        assert.notEqual(container, null);
        done();
      });
    });
  });

  afterEach(function (done) {
    blobService.deleteContainerIfExists(containerName, function (deleteError) {
      assert.equal(deleteError, null);
      suite.teardownTest(done);
    });
  });

  describe('doesContainerExist', function () {
    it('should work', function (done) {
      containerName = suite.getName(containerNamesPrefix);

      assert.doesNotThrow(function () { blobService.doesContainerExist('$root', function () { }); });
      
      assert.doesNotThrow(function () { blobService.doesContainerExist('$logs', function () { }); });
      
      blobService.doesContainerExist(containerName, function (existsError, existResult1) {
        assert.equal(existsError, null);
        assert.strictEqual(existResult1.exists, false);

        blobService.createContainer(containerName, function (createError, container1, createContainerResponse) {
          assert.equal(createError, null);
          assert.notEqual(container1, null);
          assert.equal(createContainerResponse.statusCode, HttpConstants.HttpResponseCodes.Created);

          blobService.doesContainerExist(containerName, function (existsError, existResult2) {
            assert.equal(existsError, null);
            assert.strictEqual(existResult2.exists, true);
            assert.notEqual(existResult2.name, null);
            done();
          });
        });
      });
    });
  });

  describe('createContainer', function () {
    it('should detect incorrect container names', function (done) {
      assert.throws(function () { blobService.createContainer(null, function () { }); },
        function(err){
          return (typeof err.name === 'undefined' || err.name === 'ArgumentNullError') && err.message === 'Required argument container for function createContainer is not defined';
        });
        
      assert.throws(function () { blobService.createContainer('$root1', function () { }); },
        function(err){
          return (err instanceof SyntaxError) && err.message === 'Container name format is incorrect.'; 
        });
      
      assert.throws(function () { blobService.createContainer('$root$logs', function () { }); },function(err){
          return (err instanceof SyntaxError) && err.message === 'Container name format is incorrect.'; 
        });

      assert.throws(function () { blobService.createContainer('', function () { }); },
        function(err){
          return (typeof err.name === 'undefined' || err.name === 'ArgumentNullError') && err.message === 'Required argument container for function createContainer is not defined';
        });

      assert.throws(function () { blobService.createContainer('as', function () { }); },
       function(err) {
          return (typeof err.name === 'undefined' || err.name === 'ArgumentError') && err.message === 'Container name must be between 3 and 63 characters long.';
      });

      assert.throws(function () { blobService.createContainer('a--s', function () { }); },
        function(err){
          return (err instanceof SyntaxError) && err.message === 'Container name format is incorrect.'; 
        });

      assert.throws(function () { blobService.createContainer('cont-', function () { }); },
        function(err){
          return (err instanceof SyntaxError) && err.message === 'Container name format is incorrect.'; 
        });

      assert.throws(function () { blobService.createContainer('conTain', function () { }); },
        function(err){
          return (err instanceof SyntaxError) && err.message === 'Container name format is incorrect.'; 
        });

      done();
    });

    it('should work', function (done) {
      var containerName = suite.getName(containerNamesPrefix);

      blobService.createContainer(containerName, function (createError, container1, createContainerResponse) {
        assert.equal(createError, null);
        assert.notEqual(container1, null);
        if (container1) {
          assert.notEqual(container1.name, null);
          assert.notEqual(container1.etag, null);
          assert.notEqual(container1.lastModified, null);
        }

        assert.equal(createContainerResponse.statusCode, HttpConstants.HttpResponseCodes.Created);

        // creating again will result in a duplicate error
        blobService.createContainer(containerName, function (createError2, container2) {
          assert.equal(createError2.code, Constants.BlobErrorCodeStrings.CONTAINER_ALREADY_EXISTS);
          assert.equal(container2, null);

          blobService.deleteContainer(containerName, function (deleteError) {
            assert.equal(deleteError, null);
            done();
          });
        });
      });
    });
    
    it('should work when the headers are set to string type', function (done) {
      var containerName = suite.getName(containerNamesPrefix);

      blobService.createContainer(containerName, function (createError, container1, createContainerResponse) {
        assert.equal(createError, null);
        assert.notEqual(container1, null);
        if (container1) {
          assert.notEqual(container1.name, null);
          assert.notEqual(container1.etag, null);
          assert.notEqual(container1.lastModified, null);
        }

        assert.equal(createContainerResponse.statusCode, HttpConstants.HttpResponseCodes.Created);
        
        var callback = function(webresource) {
          for (var headerName in webresource.headers) {
            webresource.headers[headerName] = webresource.headers[headerName].toString();
          }
        };
  
        blobService.on('sendingRequestEvent', callback);

        // creating again will result in a duplicate error
        blobService.createContainer(containerName, function (createError2, container2) {
          assert.equal(createError2.code, Constants.BlobErrorCodeStrings.CONTAINER_ALREADY_EXISTS);
          assert.equal(container2, null);
          blobService.removeAllListeners('sendingRequestEvent');

          blobService.deleteContainer(containerName, function (deleteError) {
            assert.equal(deleteError, null);
            done();
          });
        });
      });
    });
  });

  describe('createContainerIfNotExists', function() {
    it('should create a container if not exists', function (done) {
      var containerName = suite.getName(containerNamesPrefix);

      blobService.createContainerIfNotExists(containerName, function (createError, createResult1, response) {
        assert.equal(createError, null);
        assert.equal(createResult1.created, true);
        assert.notEqual(createResult1.name, null);

        blobService.doesContainerExist(containerName, function (existsError, existResult) {
          assert.equal(existsError, null);          
          assert.equal(existResult.exists, true);
          assert.notEqual(existResult.name, null);

          blobService.createContainerIfNotExists(containerName, function (createError2, createResult2) {
            assert.equal(createError2, null);
            assert.equal(createResult2.created, false);
            assert.notEqual(createResult2.name, null);

            blobService.deleteContainer(containerName, function (deleteError) {
              assert.equal(deleteError, null);
              blobService.createContainerIfNotExists(containerName, function (createError3) {
                assert.notEqual(createError3, null);
                assert.equal(createError3.code, 'ContainerBeingDeleted');
                done();
              });
            });
          });
        });
      });
    });

    it('should throw if called without a callback', function (done) {
      assert.throws(function () { blobService.createContainerIfNotExists('name'); },
        function (err) { return typeof err.name === 'undefined' || err.name === 'ArgumentNullError';}
      );

      done();
    });
  });

  describe('deleteContainerIfExists', function() {
    it('should delete a container if exists', function (done) {
      var containerName = suite.getName(containerNamesPrefix);

      blobService.doesContainerExist(containerName, function(existsError, existResult){
        assert.equal(existsError, null);
        assert.strictEqual(existResult.exists, false);

        blobService.deleteContainerIfExists(containerName, function (deleteError, deleted) {
          assert.equal(deleteError, null);
          assert.strictEqual(deleted, false);

          blobService.createContainer(containerName, function (createError, container1, createContainerResponse) {
            assert.equal(createError, null);
            assert.notEqual(container1, null);
            if (container1) {
              assert.notEqual(container1.name, null);
              assert.notEqual(container1.etag, null);
              assert.notEqual(container1.lastModified, null);
            }

            assert.equal(createContainerResponse.statusCode, HttpConstants.HttpResponseCodes.Created);

            // delete if exists should succeed
            blobService.deleteContainerIfExists(containerName, function (deleteError2, deleted2) {
              assert.equal(deleteError2, null);
              assert.strictEqual(deleted2, true);

              blobService.doesContainerExist(containerName, function(existsError, existResult2){
                assert.equal(existsError, null);
                assert.strictEqual(existResult2.exists, false);
                done();
              });
            });
          });
        });
      });
    });

    it('should throw if called without a callback', function (done) {
      assert.throws(function () { blobService.deleteContainerIfExists('name'); },
        function (err) { return typeof err.name === 'undefined' || err.name === 'ArgumentNullError';}
      );
      done();
    });
  });

  describe('getContainerProperties', function () {
    skipBrowser('should work', function (done) {
      var metadata = { 'Color': 'Blue' };
      blobService.setContainerMetadata(containerName, metadata, function (setMetadataError, setMetadataResult, setMetadataResponse) {
        assert.equal(setMetadataError, null);
        assert.ok(setMetadataResponse.isSuccessful);

        blobService.getContainerProperties(containerName, function (getError, container2, getResponse) {
          assert.equal(getError, null);
          assert.notEqual(container2, null);
          if (container2) {
            assert.equal('unlocked', container2.lease.status);
            assert.equal('available', container2.lease.state);
            assert.equal(null, container2.lease.duration);
            assert.notEqual(null, container2.requestId);
            assert.notEqual(container2.hasImmutabilityPolicy, null);
            assert.deepStrictEqual(typeof container2.hasImmutabilityPolicy, 'boolean');
            assert.notEqual(container2.hasLegalHold, null);
            assert.deepStrictEqual(typeof container2.hasLegalHold, 'boolean');

            if(suite.metadataCaseSensitive) {
              assert.strictEqual(container2.metadata.Color, metadata.Color);
            } else {
              assert.strictEqual(container2.metadata.color, metadata.Color);
            }
          }

          assert.notEqual(getResponse, null);
          assert.equal(getResponse.isSuccessful, true);

          blobService.deleteContainer(containerName, function (deleteError) {
            assert.equal(deleteError, null);
            done();
          });
        });
      });
    });
  });

  describe('setContainerMetadata', function () {
    skipBrowser('should work', function (done) {
      var metadata = { 'Class': 'Test' };
      blobService.setContainerMetadata(containerName, metadata, function (setMetadataError, setMetadataResult, setMetadataResponse) {
        assert.equal(setMetadataError, null);
        assert.ok(setMetadataResponse.isSuccessful);

        blobService.getContainerMetadata(containerName, function (getMetadataError, containerMetadata, getMetadataResponse) {
          assert.equal(getMetadataError, null);
          assert.notEqual(containerMetadata, null);
          assert.notEqual(containerMetadata.metadata, null);
          if (containerMetadata.metadata) {
            
            if(suite.metadataCaseSensitive) {
              assert.equal(containerMetadata.metadata.Class, 'Test');
            } else {
              assert.equal(containerMetadata.metadata.class, 'Test');
            }
          }

          assert.ok(getMetadataResponse.isSuccessful);

          blobService.deleteContainer(containerName, function (deleteError) {
            assert.equal(deleteError, null);
            done();
          });
        });
      });
    });

    it('should merge the metadata', function (done) {
      var metadata = { color: 'blue', Color: 'Orange', COLOR: 'Red' };
      blobService.setContainerMetadata(containerName, metadata, function (setMetadataError, setMetadataResult, setMetadataResponse) {
        assert.equal(setMetadataError, null);
        assert.ok(setMetadataResponse.isSuccessful);

        blobService.getContainerMetadata(containerName, function (getMetadataError, containerMetadata, getMetadataResponse) {
          assert.equal(getMetadataError, null);
          assert.notEqual(containerMetadata, null);
          assert.notEqual(containerMetadata.metadata, null);
          if (containerMetadata.metadata) {
            assert.equal(containerMetadata.metadata.color, 'blue,Orange,Red');
          }

          assert.ok(getMetadataResponse.isSuccessful);

          blobService.deleteContainer(containerName, function (deleteError) {
            assert.equal(deleteError, null);
            done();
          });
        });
      });
    });

    it('should work with a lease', function (done) {
      blobService.acquireLease(containerName, null, function (leaseError, lease, leaseResponse) {
        assert.equal(leaseError, null);
        assert.notEqual(lease, null);
        assert.ok(lease.id);
        assert.notEqual(lease.etag, null);
        assert.notEqual(lease.lastModified, null);

        assert.notEqual(leaseResponse, null);
        assert.ok(leaseResponse.isSuccessful);

        var metadata = { 'class': 'test' };
        var options = { 'leaseId' : lease.id};

        blobService.setContainerMetadata(containerName, metadata, options, function (setMetadataError, setMetadataResult, setMetadataResponse) {
          assert.equal(setMetadataError, null);
          assert.notEqual(setMetadataResult.etag, null);
          assert.ok(setMetadataResponse.isSuccessful);

          blobService.getContainerMetadata(containerName, options, function (getMetadataError, containerMetadata, getMetadataResponse) {
            assert.equal(getMetadataError, null);
            assert.notEqual(containerMetadata, null);
            assert.notEqual(containerMetadata.metadata, null);
            if (containerMetadata.metadata) {
              assert.equal(containerMetadata.metadata['class'], 'test');
            }

            assert.ok(getMetadataResponse.isSuccessful);

            blobService.breakLease(containerName, null, {leaseBreakPeriod: 0}, function(leaseError){
              assert.equal(leaseError, null);
              
              blobService.deleteContainer(containerName, function (deleteError) {
                assert.equal(deleteError, null);
                done();
              });
            });
          });
        });
      });
    });
  });

  describe('setContainerMetadataThrows', function () {
    it('should work', function (done) {
      function setContainerMetadata(containerName, metadata) {
        blobService.setContainerMetadata(containerName, metadata, function(){});
      }

      assert.throws( function() { setContainerMetadata(containerName, {'' : 'value1'}); },
        function (err) {return (typeof err.name === 'undefined' || err.name === 'ArgumentError') && err.message === SR.METADATA_KEY_INVALID});
      assert.throws( function() { setContainerMetadata(containerName, {' ' : 'value1'}); },
        function (err) {return (typeof err.name === 'undefined' || err.name === 'ArgumentError') && err.message === SR.METADATA_KEY_INVALID});
      assert.throws( function() { setContainerMetadata(containerName, {'\n\t' : 'value1'}); },
        function (err) {return (typeof err.name === 'undefined' || err.name === 'ArgumentError') && err.message === SR.METADATA_KEY_INVALID});

      assert.throws( function() { setContainerMetadata(containerName, {'key1' : null}); },
        function (err) {return (typeof err.name === 'undefined' || err.name === 'ArgumentError') && err.message === SR.METADATA_VALUE_INVALID});
      assert.throws( function() { setContainerMetadata(containerName, {'key1' : ''}); },
        function (err) {return (typeof err.name === 'undefined' || err.name === 'ArgumentError') && err.message === SR.METADATA_VALUE_INVALID});
      assert.throws( function() { setContainerMetadata(containerName, {'key1' : '\n\t'}); },
        function (err) {return (typeof err.name === 'undefined' || err.name === 'ArgumentError') && err.message === SR.METADATA_VALUE_INVALID});
      assert.throws( function() { setContainerMetadata(containerName, {'key1' : ' '}); },
        function (err) {return (typeof err.name === 'undefined' || err.name === 'ArgumentError') && err.message === SR.METADATA_VALUE_INVALID});
      // test that empty headers can be got.
      var callback = function(webresource) {
        webresource.headers['x-ms-meta-key1'] = '';
      };

      blobService.on('sendingRequestEvent', callback);

      blobService.setContainerMetadata(containerName, {}, function(setMetadataError) {
        // IE11 cannot set 'x-ms-meta-key1' with empty value
        if (testutil.isBrowser()) {
          blobService.removeListener('sendingRequestEvent', callback);
          done();
          return;
        }

        assert.equal(setMetadataError, null);
        blobService.getContainerProperties(containerName, function(getContainerPropsError, properties) {
          assert.equal(getContainerPropsError, null);
          assert.equal(properties.metadata['key1'], '');
          done();
        });
      });
    });
  });

  describe('getContainerAcl', function () {
    it('should work', function (done) {
      blobService.getContainerAcl(containerName, function (containerAclError, containerBlob, containerAclResponse) {
        assert.equal(containerAclError, null);
        assert.notEqual(containerBlob, null);
        if (containerBlob) {
          assert.equal(containerBlob.publicAccessLevel, BlobUtilities.BlobContainerPublicAccessType.OFF);
        }

        assert.equal(containerAclResponse.isSuccessful, true);

        blobService.deleteContainer(containerName, function (deleteError) {
            assert.equal(deleteError, null);
            done();
          });
      });
    });
  });

  describe('setContainerAcl', function () {
    it('should work', function (done) {
      var blobServiceAnonymous = azure.createBlobServiceAnonymous(blobService.host.primaryHost)
        .withFilter(new azure.ExponentialRetryPolicyFilter());

      var blobName = suite.getName(blobNamesPrefix);
      var blobText = 'Hello World!';

      blobService.createBlockBlobFromText(containerName, blobName, blobText, function (err) {
        assert.equal(err, null);
        
        var options = {publicAccessLevel: BlobUtilities.BlobContainerPublicAccessType.BLOB};
        blobService.setContainerAcl(containerName, null, options, function (setAclError, setAclContainer1, setResponse1) {
          assert.equal(setAclError, null);
          assert.notEqual(setAclContainer1, null);
          assert.ok(setResponse1.isSuccessful);

          setTimeout(function () {
            blobService.getContainerAcl(containerName, function (getAclError, getAclContainer1, getResponse1) {
              assert.equal(getAclError, null);
              assert.notEqual(getAclContainer1, null);
              assert.equal(getAclContainer1.publicAccessLevel, BlobUtilities.BlobContainerPublicAccessType.BLOB);
              assert.ok(getResponse1.isSuccessful);

              blobServiceAnonymous.getBlobToText(containerName, blobName, function(createBlobError, blobTextResponse, blockBlob, getBlobResponse) {
                assert.equal(setAclError, null);
                assert.notEqual(blockBlob, null);
                assert.ok(getBlobResponse.isSuccessful);
                assert.equal(blobTextResponse, blobText);
                
                options.publicAccessLevel = BlobUtilities.BlobContainerPublicAccessType.CONTAINER;
                blobService.setContainerAcl(containerName, null, options, function (setAclError2, setAclContainer2, setResponse2) {
                  assert.equal(setAclError2, null);
                  assert.notEqual(setAclContainer2, null);
                  assert.ok(setResponse2.isSuccessful);

                  setTimeout(function () {
                    blobService.getContainerAcl(containerName, function (getAclError2, getAclContainer2, getResponse3) {
                      assert.equal(getAclError2, null);
                      assert.notEqual(getAclContainer2, null);
                      assert.equal(getAclContainer2.publicAccessLevel, BlobUtilities.BlobContainerPublicAccessType.CONTAINER);
                      assert.ok(getResponse3.isSuccessful);

                      blobServiceAnonymous.getBlobToText(containerName, blobName, function(createBlobError2, blobTextResponse2, blockBlob2, getBlobResponse2) {
                        assert.equal(setAclError2, null);
                        assert.notEqual(blockBlob2, null);
                        assert.ok(getBlobResponse2.isSuccessful);
                        assert.equal(blobTextResponse2, blobText);

                        blobService.deleteBlobIfExists(containerName, blobName, function(error) {
                          assert.equal(error, null);
                          done();
                        });
                      });
                    });
                  }, timeout);
                });
              });
            });
          }, timeout);
        });
      });
    });

    it('should work with policies', function (done) {
      var readWriteStartDate = new Date(Date.UTC(2012, 10, 10));
      var readWriteExpiryDate = new Date(readWriteStartDate);
      readWriteExpiryDate.setMinutes(readWriteStartDate.getMinutes() + 10);
      readWriteExpiryDate.setMilliseconds(999);

      var options = { publicAccessLevel: BlobUtilities.BlobContainerPublicAccessType.BLOB };
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
      
      blobService.setContainerAcl(containerName, signedIdentifiers, options, function (setAclError, setAclContainer1, setResponse1) {
        assert.equal(setAclError, null);
        assert.notEqual(setAclContainer1, null);
        assert.ok(setResponse1.isSuccessful);
        
        setTimeout(function () {
          blobService.getContainerAcl(containerName, function (getAclError, getAclContainer1, getResponse1) {
            assert.equal(getAclError, null);
            assert.notEqual(getAclContainer1, null);
            assert.equal(getAclContainer1.publicAccessLevel, BlobUtilities.BlobContainerPublicAccessType.BLOB);
            assert.equal(getAclContainer1.signedIdentifiers.readwrite.Expiry.getTime(), readWriteExpiryDate.getTime());
            assert.ok(getResponse1.isSuccessful);
            
            options.publicAccessLevel = BlobUtilities.BlobContainerPublicAccessType.CONTAINER;
            blobService.setContainerAcl(containerName, null, options, function (setAclError2, setAclContainer2, setResponse2) {
              assert.equal(setAclError2, null);
              assert.notEqual(setAclContainer2, null);
              assert.ok(setResponse2.isSuccessful);
            
              setTimeout(function () {
                blobService.getContainerAcl(containerName, function (getAclError2, getAclContainer2, getResponse3) {
                  assert.equal(getAclError2, null);
                  assert.notEqual(getAclContainer2, null);
                  assert.equal(getAclContainer2.publicAccessLevel, BlobUtilities.BlobContainerPublicAccessType.CONTAINER);
                  assert.ok(getResponse3.isSuccessful);
                  done();
                });
              }, timeout);
            });
          });
        }, timeout);
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
      
      var options = {publicAccessLevel: BlobUtilities.BlobContainerPublicAccessType.OFF};
      blobService.setContainerAcl(containerName, signedIdentifiers, options, function (setAclError, setAclContainer, setAclResponse) {
        assert.equal(setAclError, null);
        assert.notEqual(setAclContainer, null);
        assert.ok(setAclResponse.isSuccessful);
        setTimeout(function () {
          blobService.getContainerAcl(containerName, function (getAclError, containerAcl, getAclResponse) {
            assert.equal(getAclError, null);
            assert.notEqual(containerAcl, null);
            assert.notEqual(getAclResponse, null);

            if (getAclResponse) {
              assert.equal(getAclResponse.isSuccessful, true);
            }

            assert.equal(containerAcl.signedIdentifiers.id1.Start.getTime(), new Date('2009-10-10T00:00:00.123Z').getTime());
            assert.equal(containerAcl.signedIdentifiers.id1.Expiry.getTime(), new Date('2009-10-11T00:00:00.456Z').getTime());
            assert.equal(containerAcl.signedIdentifiers.id1.Permissions, 'r');
            assert.equal(containerAcl.signedIdentifiers.id2.Start.getTime(), new Date('2009-11-10T00:00:00.006Z').getTime());
            assert.equal(containerAcl.signedIdentifiers.id2.Start.getMilliseconds(), 6);
            assert.equal(containerAcl.signedIdentifiers.id2.Expiry.getTime(), new Date('2009-11-11T00:00:00.4Z').getTime());
            assert.equal(containerAcl.signedIdentifiers.id2.Expiry.getMilliseconds(), 400);
            assert.equal(containerAcl.signedIdentifiers.id2.Permissions, 'w');
            done();
          });
        }, timeout);
      });
    });
  });

  describe('listBlobs', function () {
    it('should work', function (done) {
      var blobName1 = suite.getName(blobNamesPrefix);
      var blobName2 = suite.getName(blobNamesPrefix);
      var blobText1 = 'hello1';
      var blobText2 = 'hello2';

      blobs.length = 0;

      var listBlobsWithoutPrefix = function (options, token, callback) {
        blobService.listBlobsSegmented(containerName, token, options, function(error, result) {
          assert.equal(error, null);
          blobs.push.apply(blobs, result.entries);
          var token = result.continuationToken;
          if(token) {
            listBlobsWithoutPrefix(options, token, callback);
          }
          else {
            callback();
          }
        });
      };

      listBlobsWithoutPrefix(null, null, function() {
        assert.equal(blobs.length, 0);

        blobService.createBlockBlobFromText(containerName, blobName1, blobText1, function (blobErr1) {
          assert.equal(blobErr1, null);

          // Test listing 1 blob
          listBlobsWithoutPrefix(null, null, function() {
            assert.equal(blobs.length, 1);
            assert.equal(blobs[0].name, blobName1);

            blobService.createBlockBlobFromText(containerName, blobName2, blobText2, function (blobErr2) {
              assert.equal(blobErr2, null);

              blobs.length = 0;

              // Test listing multiple blobs
              listBlobsWithoutPrefix(null, null, function() {
                assert.equal(blobs.length, 2);

                var entries = 0;
                blobs.forEach(function (blob) {
                  assert.notEqual(blob.creationTime, null);
                  assert.deepStrictEqual(typeof blob.creationTime, 'string');

                  if (blob.name === blobName1) {
                    entries += 1;
                  }
                  else if (blob.name === blobName2) {
                    entries += 2;
                  }
                });

                assert.equal(entries, 3);

                blobService.createBlobSnapshot(containerName, blobName1, function (snapErr) {
                  assert.equal(snapErr, null);

                  blobs.length = 0;

                  // Test listing without requesting snapshots
                  listBlobsWithoutPrefix(null, null, function() {
                    assert.equal(blobs.length, 2);

                    var options = {
                      include: BlobUtilities.BlobListingDetails.SNAPSHOTS,
                      maxResults: 2
                    };

                    blobs.length = 0;

                    // Test listing including snapshots
                    listBlobsWithoutPrefix(options, null, function() {
                      assert.equal(blobs.length, 3);

                      blobService.deleteContainer(containerName, function (deleteError) {
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
      });
    });

    it('should work with prefix', function(done) {
      var blobName1 = suite.getName(blobNamesPrefix);
      var blobName2 = suite.getName(blobNamesPrefix);
      var blobText1 = 'hello1';
      var blobText2 = 'hello2';

      blobs.length = 0;

      listBlobs(null, null, null, function() {
        assert.equal(blobs.length, 0);

        blobService.createBlockBlobFromText(containerName, blobName1, blobText1, function (blobErr1) {
          assert.equal(blobErr1, null);

          // Test listing 1 blob
          listBlobs(null, null, null, function() {
            assert.equal(blobs.length, 1);
            assert.equal(blobs[0].name, blobName1);

            blobService.createBlockBlobFromText(containerName, blobName2, blobText2, function (blobErr2) {
              assert.equal(blobErr2, null);

              blobs.length = 0;

              // Test listing multiple blobs with prefix
              listBlobs(blobName1, null, null, function() {
                assert.equal(blobs.length, 1);

                blobService.createBlobSnapshot(containerName, blobName1, function (snapErr) {
                  assert.equal(snapErr, null);

                  blobs.length = 0;

                  // Test listing without requesting snapshots
                  listBlobs(null, null, null, function() {
                    assert.equal(blobs.length, 2);

                    var options = {
                      include: BlobUtilities.BlobListingDetails.SNAPSHOTS
                    };

                    blobs.length = 0;

                    // Test listing with prefix and including snapshots
                    listBlobs(blobName1, options, null, function() {
                      assert.equal(blobs.length, 2);

                      blobService.deleteContainer(containerName, function (deleteError) {
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
      });
    });
    
    it('should work with copy details', function(done) {
      var blobName1 = suite.getName(blobNamesPrefix);
      var blobName2 = suite.getName(blobNamesPrefix);
      var blobText1 = 'hello1';
      var blobText2 = 'hello2';

      blobs.length = 0;

      listBlobs(null, null, null, function() {
        assert.equal(blobs.length, 0);

        blobService.createBlockBlobFromText(containerName, blobName1, blobText1, function (blobErr1) {
          assert.equal(blobErr1, null);

          // Test listing 1 blob
          listBlobs(null, null, null, function() {
            assert.equal(blobs.length, 1);
            assert.equal(blobs[0].name, blobName1);

            blobService.createBlockBlobFromText(containerName, blobName2, blobText2, function (blobErr2) {
              assert.equal(blobErr2, null);

              blobs.length = 0;
              // Test listing multiple blobs with prefix
              listBlobs(blobNamesPrefix, null, null, function() {
                assert.equal(blobs.length, 2);
                
                var sourceUrl = blobService.getUrl(containerName, blobName1);
                var blobName3 = suite.getName(blobNamesPrefix);
                blobService.startCopyBlob(sourceUrl, containerName, blobName3, function (copyErr) {
                  assert.equal(copyErr, null);

                  var options = {
                    include: BlobUtilities.BlobListingDetails.COPY
                  };

                  blobs.length = 0;
                  // Test listing with prefix and including copy status
                  listBlobs(blobNamesPrefix, options, null, function() {
                    assert.equal(blobs.length, 3);
                    var blob = blobs.filter(function(value, index, array) {
                      return value.name === blobName3;
                    });

                    assert.equal(blob.length, 1);
                    assert.notEqual(blob[0].copy.id, undefined);
                    assert.notEqual(blob[0].copy.status, undefined);
                    assert.notEqual(blob[0].copy.source, undefined);
                    assert.notEqual(blob[0].copy.progress, undefined);
                    assert.notEqual(blob[0].copy.completionTime, undefined);
                    assert.equal(typeof blob[0].copy.bytesCopied === 'number', true);
                    assert.equal(blob[0].copy.totalBytes, blobText1.length);

                    blobService.deleteContainer(containerName, function (deleteError) {
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
    });

    it('should work with blob with space only', function(done) {
      var blobName1 = ' ';
      var blobText1 = 'hello1';
      blobs.length = 0;

      listBlobs(null, null, null, function() {
        assert.equal(blobs.length, 0);

        blobService.createBlockBlobFromText(containerName, blobName1, blobText1, function (blobErr1) {
          assert.equal(blobErr1, null);

          // Test listing 1 blob
          listBlobs(null, null, null, function() {
            assert.equal(blobs.length, 1);
            assert.equal(blobs[0].name, blobName1);
            done();
          });
        });
      });
    });
  });

  describe('listBlobDirectories', function () {
    it('should list blob directories', function (done) {
      var blobPrefix1 = suite.getName(blobNamesPrefix) + '/';
      var blobPrefix2 = blobPrefix1 + suite.getName(blobNamesPrefix) + '/';
      var blobName1 = blobPrefix1 + suite.getName(blobNamesPrefix);
      var blobName2 = blobPrefix2 + suite.getName(blobNamesPrefix);
      var blobText1 = 'hello1';
      var blobText2 = 'hello2';

      blobs.length = 0;

      listBlobDirectoriesWithoutPrefix(null, null, function() {
        assert.equal(blobs.length, 0);

        blobService.createBlockBlobFromText(containerName, blobName1, blobText1, function (blobErr1) {
          assert.equal(blobErr1, null);

          listBlobDirectoriesWithoutPrefix(null, null, function() {
            assert.equal(blobs.length, 1);
            assert.equal(blobs[0].name, blobPrefix1);

            blobService.createBlockBlobFromText(containerName, blobName2, blobText2, function (blobErr2) {
              assert.equal(blobErr2, null);

              blobs.length = 0;

              listBlobDirectoriesWithoutPrefix(null, null, function() {
                assert.equal(blobs.length, 1);

                var prefix = blobs[0].name;
                blobs.length = 0;
                listBlobDirectoriesWithPrefix(prefix, null, null, function() {
                  assert.equal(blobs.length, 1);
                  assert.equal(blobs[0].name, blobPrefix2);

                  prefix = blobs[0].name;
                  blobs.length = 0;
                  listBlobs(prefix, null, null, function (blobErr) {
                    assert.equal(blobErr, null);
                    assert.equal(blobs.length, 1);
                    assert.equal(blobs[0].name, blobName2);
                    done();
                  })
                });
              });
            });
          });
        });
      });
    });

    it('should list blob directories with prefix', function (done) {
      var blobPrefix1 = suite.getName(blobNamesPrefix) + '/';
      var blobPrefix2 = blobPrefix1 + suite.getName(blobNamesPrefix) + '/';
      var blobPrefix3 = blobPrefix1 + suite.getName(blobNamesPrefix) + '/';
      var blobName1 = blobPrefix1 + suite.getName(blobNamesPrefix);
      var blobName2 = blobPrefix2 + suite.getName(blobNamesPrefix);
      var blobName3 = blobPrefix3 + suite.getName(blobNamesPrefix);
      var blobText1 = 'hello1';
      var blobText2 = 'hello2';
      var blobText3 = 'hello3';

      blobs.length = 0;
      var prefix = blobPrefix1.slice(0, -1); 
      listBlobDirectoriesWithPrefix(prefix, null, null, function() {
        assert.equal(blobs.length, 0);

        blobService.createBlockBlobFromText(containerName, blobName1, blobText1, function (blobErr1) {
          assert.equal(blobErr1, null);

          
          listBlobDirectoriesWithPrefix(prefix, null, null, function() {
            assert.equal(blobs.length, 1);
            assert.equal(blobs[0].name, blobPrefix1);

            blobService.createBlockBlobFromText(containerName, blobName2, blobText2, function (blobErr2) {
              assert.equal(blobErr2, null);

              blobService.createBlockBlobFromText(containerName, blobName3, blobText3, function (blobErr3) {
              assert.equal(blobErr3, null);

                blobs.length = 0;
                listBlobDirectoriesWithPrefix(blobPrefix1, null, null, function() {
                  assert.equal(blobs.length, 2);

                  var prefix = blobs[1].name.slice(0, -1); 
                  blobs.length = 0;
                  listBlobDirectoriesWithPrefix(prefix, null, null, function() {
                    assert.equal(blobs.length, 1);
                    assert.equal(blobs[0].name, blobPrefix3);

                    prefix = blobs[0].name;
                    blobs.length = 0;
                    listBlobs(prefix, null, null, function (blobErr) {
                      assert.equal(blobErr, null);
                      assert.equal(blobs.length, 1);
                      assert.equal(blobs[0].name, blobName3);
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
});

function listBlobs (prefix, options, token, callback) {
  blobService.listBlobsSegmentedWithPrefix(containerName, prefix, token, options, function(error, result) {
    assert.equal(error, null);
    blobs.push.apply(blobs, result.entries);
    var token = result.continuationToken;
    if(token) {
      listBlobs(prefix, options, token, callback);
    }
    else {
      callback();
    }
  });
}

function listBlobDirectoriesWithPrefix(prefix, options, token, callback) {
  blobService.listBlobDirectoriesSegmentedWithPrefix(containerName, prefix, token, options, function(error, result) {
    assert.equal(error, null);
    blobs.push.apply(blobs, result.entries);
    var token = result.continuationToken;
    if(token) {
      listBlobDirectoriesWithPrefix(prefix, options, token, callback);
    }
    else {
      callback();
    }
  });
}

function listBlobDirectoriesWithoutPrefix(options, token, callback) {
  blobService.listBlobDirectoriesSegmented(containerName, token, options, function(error, result) {
    assert.equal(error, null);
    blobs.push.apply(blobs, result.entries);
    var token = result.continuationToken;
    if(token) {
      listBlobDirectoriesWithoutPrefix(options, token, callback);
    }
    else {
      callback();
    }
  });
}
