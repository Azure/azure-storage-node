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

// Lib includes
var testutil = require('../../framework/util');
var SR = testutil.libRequire('common/util/sr');

var azure = testutil.libRequire('azure-storage');

var Constants = azure.Constants;
var BlobUtilities = azure.BlobUtilities;
var HttpConstants = Constants.HttpConstants;

var containerNamesPrefix = 'cont-';
var blobNamesPrefix = 'blob-';

var blobService;
var containerName;

var blobs = [];

describe('BlobContainer', function () {
  before(function (done) {
    blobService = azure.createBlobService()
      .withFilter(new azure.ExponentialRetryPolicyFilter());
    done();
  });

  beforeEach(function (done) {
    containerName = getName(containerNamesPrefix);
    blobService.createContainerIfNotExists(containerName, function (createError, container) {
      assert.equal(createError, null);
      assert.notEqual(container, null);
      done();
    });
  });

  afterEach(function (done) {
    blobService.deleteContainerIfExists(containerName, function (deleteError) {
      assert.equal(deleteError, null);
      done();
    });
  });

  describe('doesContainerExist', function () {
    it('should work', function (done) {
      containerName = getName(containerNamesPrefix);

      assert.doesNotThrow(function () { blobService.doesContainerExist('$root', function () { }); });
      
      assert.doesNotThrow(function () { blobService.doesContainerExist('$logs', function () { }); });
      
      blobService.doesContainerExist(containerName, function (existsError, exists) {
        assert.equal(existsError, null);
        assert.strictEqual(exists, false);

        blobService.createContainer(containerName, function (createError, container1, createContainerResponse) {
          assert.equal(createError, null);
          assert.notEqual(container1, null);
          assert.equal(createContainerResponse.statusCode, HttpConstants.HttpResponseCodes.Created);

          blobService.doesContainerExist(containerName, function (existsError, exists) {
            assert.equal(existsError, null);
            assert.strictEqual(exists, true);
            done();
          });
        });
      });
    });
  });

  describe('createContainer', function () {
    it('should detect incorrect container names', function (done) {
      assert.throws(function () { blobService.createContainer(null, function () { }); },
        /Required argument container for function createContainer is not defined/);
        
      assert.throws(function () { blobService.createContainer('$root1', function () { }); },
        /Container name format is incorrect./);
      
      assert.throws(function () { blobService.createContainer('$root$logs', function () { }); },
        /Container name format is incorrect./);

      assert.throws(function () { blobService.createContainer('', function () { }); },
        /Required argument container for function createContainer is not defined/);

      assert.throws(function () { blobService.createContainer('as', function () { }); },
        /Container name must be between 3 and 63 characters long./);

      assert.throws(function () { blobService.createContainer('a--s', function () { }); },
        /Container name format is incorrect./);

      assert.throws(function () { blobService.createContainer('cont-', function () { }); },
        /Container name format is incorrect./);

      assert.throws(function () { blobService.createContainer('conTain', function () { }); },
        /Container name format is incorrect./);

      done();
    });

    it('should work', function (done) {
      var containerName = getName(containerNamesPrefix);

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
  });

  describe('createContainerIfNotExists', function() {
    it('should create a container if not exists', function (done) {
      var containerName = getName(containerNamesPrefix);

      blobService.createContainerIfNotExists(containerName, function (createError, created) {
        assert.equal(createError, null);
        assert.equal(created, true);

        blobService.doesContainerExist(containerName, function (existsError, exists) {
          assert.equal(existsError, null);
          assert.equal(exists, true);

          blobService.createContainerIfNotExists(containerName, function (createError2, created2) {
            assert.equal(createError2, null);
            assert.equal(created2, false);

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
        Error
      );

      done();
    });
  });

  describe('deleteContainerIfExists', function() {
    it('should delete a container if exists', function (done) {
      var containerName = getName(containerNamesPrefix);

      blobService.doesContainerExist(containerName, function(existsError, exists){
        assert.equal(existsError, null);
        assert.strictEqual(exists, false);

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

              blobService.doesContainerExist(containerName, function(existsError, exists){
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
      assert.throws(function () { blobService.deleteContainerIfExists('name'); },
        Error
      );
      done();
    });
  });

  describe('getContainerProperties', function () {
    it('should work', function (done) {
      var metadata = { 'color': 'blue' };
      blobService.setContainerMetadata(containerName, metadata, function (setMetadataError, setMetadataResult, setMetadataResponse) {
        assert.equal(setMetadataError, null);
        assert.ok(setMetadataResponse.isSuccessful);

        blobService.getContainerProperties(containerName, function (getError, container2, getResponse) {
          assert.equal(getError, null);
          assert.notEqual(container2, null);
          if (container2) {
            assert.equal('unlocked', container2.leaseStatus);
            assert.equal('available', container2.leaseState);
            assert.equal(null, container2.leaseDuration);
            assert.notEqual(null, container2.requestId);
            assert.strictEqual(container2.metadata.color, metadata.color);
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
    it('should work', function (done) {
      var metadata = { 'class': 'test' };
      blobService.setContainerMetadata(containerName, metadata, function (setMetadataError, setMetadataResult, setMetadataResponse) {
        assert.equal(setMetadataError, null);
        assert.ok(setMetadataResponse.isSuccessful);

        blobService.getContainerMetadata(containerName, function (getMetadataError, containerMetadata, getMetadataResponse) {
          assert.equal(getMetadataError, null);
          assert.notEqual(containerMetadata, null);
          assert.notEqual(containerMetadata.metadata, null);
          if (containerMetadata.metadata) {
            assert.equal(containerMetadata.metadata.class, 'test');
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
        function (err) {return (err instanceof Error) && err.message === SR.METADATA_KEY_INVALID});
      assert.throws( function() { setContainerMetadata(containerName, {' ' : 'value1'}); },
        function (err) {return (err instanceof Error) && err.message === SR.METADATA_KEY_INVALID});
      assert.throws( function() { setContainerMetadata(containerName, {'\n\t' : 'value1'}); },
        function (err) {return (err instanceof Error) && err.message === SR.METADATA_KEY_INVALID});

      assert.throws( function() { setContainerMetadata(containerName, {'key1' : null}); },
        function (err) {return (err instanceof Error) && err.message === SR.METADATA_VALUE_INVALID});
      assert.throws( function() { setContainerMetadata(containerName, {'key1' : ''}); },
        function (err) {return (err instanceof Error) && err.message === SR.METADATA_VALUE_INVALID});
      assert.throws( function() { setContainerMetadata(containerName, {'key1' : '\n\t'}); },
        function (err) {return (err instanceof Error) && err.message === SR.METADATA_VALUE_INVALID});
      assert.throws( function() { setContainerMetadata(containerName, {'key1' : ' '}); },
        function (err) {return (err instanceof Error) && err.message === SR.METADATA_VALUE_INVALID});

      // test that empty headers can be got.
      var callback = function(webresource) {
        webresource.headers['x-ms-meta-key1'] = '';
      };

      blobService.on('sendingRequestEvent', callback);

      blobService.setContainerMetadata(containerName, {}, function(setMetadataError) {
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

      var blobName = getName(blobNamesPrefix);
      var blobText = 'Hello World!';

      blobService.createBlockBlobFromText(containerName, blobName, blobText, function (err) {
        assert.equal(err, null);

        blobService.setContainerAcl(containerName, null, BlobUtilities.BlobContainerPublicAccessType.BLOB, function (setAclError, setAclContainer1, setResponse1) {
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

                blobService.setContainerAcl(containerName, null, BlobUtilities.BlobContainerPublicAccessType.CONTAINER, function (setAclError2, setAclContainer2, setResponse2) {
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
                  }, 30000);
                });
              });
            });
          }, 30000);
        });
      });
    });

    it('should work with policies', function (done) {
      var readWriteStartDate = new Date(Date.UTC(2012, 10, 10));
      var readWriteExpiryDate = new Date(readWriteStartDate);
      readWriteExpiryDate.setMinutes(readWriteStartDate.getMinutes() + 10);
      readWriteExpiryDate.setMilliseconds(999);

      var readWriteSharedAccessPolicy = {
        Id: 'readwrite',
        AccessPolicy: {
          Start: readWriteStartDate,
          Expiry: readWriteExpiryDate,
          Permissions: 'rw'
        }
      };

      var readSharedAccessPolicy = {
        Id: 'read',
        AccessPolicy: {
          Expiry: readWriteStartDate,
          Permissions: 'r'
        }
      };

      var signedIdentifiers = [readWriteSharedAccessPolicy, readSharedAccessPolicy];

      blobService.setContainerAcl(containerName, signedIdentifiers, BlobUtilities.BlobContainerPublicAccessType.BLOB, function (setAclError, setAclContainer1, setResponse1) {
        assert.equal(setAclError, null);
        assert.notEqual(setAclContainer1, null);
        assert.ok(setResponse1.isSuccessful);
        
        setTimeout(function () {
          blobService.getContainerAcl(containerName, function (getAclError, getAclContainer1, getResponse1) {
            assert.equal(getAclError, null);
            assert.notEqual(getAclContainer1, null);
            assert.equal(getAclContainer1.publicAccessLevel, BlobUtilities.BlobContainerPublicAccessType.BLOB);
            assert.equal(getAclContainer1.signedIdentifiers[0].AccessPolicy.Expiry.getTime(), readWriteExpiryDate.getTime());
            assert.ok(getResponse1.isSuccessful);

            blobService.setContainerAcl(containerName, null, BlobUtilities.BlobContainerPublicAccessType.CONTAINER, function (setAclError2, setAclContainer2, setResponse2) {
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
              }, 30000);
            });
          });
        }, 30000);
      });
    });

    it('should work with signed identifiers', function (done) {
      var signedIdentifiers = [
        { Id: 'id1',
          AccessPolicy: {
            Start: '2009-10-10T00:00:00.123Z',
            Expiry: '2009-10-11T00:00:00.456Z',
            Permissions: 'r'
          }
        },
        { Id: 'id2',
          AccessPolicy: {
            Start: '2009-11-10T00:00:00.006Z',
            Expiry: '2009-11-11T00:00:00.4Z',
            Permissions: 'w'
          }
        }];

      blobService.setContainerAcl(containerName, signedIdentifiers, BlobUtilities.BlobContainerPublicAccessType.OFF, function (setAclError, setAclContainer, setAclResponse) {
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

            var entries = 0;

            containerAcl.signedIdentifiers.forEach(function (identifier) {
              if (identifier.Id === 'id1') {
                assert.equal(identifier.AccessPolicy.Start.getTime(), new Date('2009-10-10T00:00:00.123Z').getTime());
                assert.equal(identifier.AccessPolicy.Expiry.getTime(), new Date('2009-10-11T00:00:00.456Z').getTime());
                assert.equal(identifier.AccessPolicy.Permission, 'r');
                entries += 1;
              }
              else if (identifier.Id === 'id2') {
                assert.equal(identifier.AccessPolicy.Start.getTime(), new Date('2009-11-10T00:00:00.006Z').getTime());
                assert.equal(identifier.AccessPolicy.Start.getMilliseconds(), 6);
                assert.equal(identifier.AccessPolicy.Expiry.getTime(), new Date('2009-11-11T00:00:00.4Z').getTime());
                assert.equal(identifier.AccessPolicy.Expiry.getMilliseconds(), 400);
                assert.equal(identifier.AccessPolicy.Permission, 'w');
                entries += 2;
              }
            });
            assert.equal(entries, 3);
            done();
          });
        }, 30000);
      });
    });
  });

  describe('listBlobs', function () {
    it('should work', function (done) {
      var blobName1 = getName(blobNamesPrefix);
      var blobName2 = getName(blobNamesPrefix);
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
      var blobName1 = getName(blobNamesPrefix);
      var blobName2 = getName(blobNamesPrefix);
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
  });
});

function getName (prefix){
  return prefix + guid.v1().toLowerCase();
}

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