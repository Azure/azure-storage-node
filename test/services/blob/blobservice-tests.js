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
var qs = require('querystring');
var path = require('path');
var util = require('util');
var url = require('url');
var extend = require('extend');

var request = require('request');
var _ = require('underscore');

// Test includes
var testutil = require('../../framework/util');
var TestSuite = require('../../framework/test-suite');

// Lib includes
var azureutil = testutil.libRequire('common/util/util');
var azure = testutil.libRequire('azure-storage');
var rfs = testutil.libRequire('common/streams/readablefs');
var WebResource = azure.WebResource;
var SR = azure.SR;
var SharedAccessSignature = azure.SharedAccessSignature;
var BlobService = azure.BlobService;
var ServiceClient = azure.ServiceClient;
var ExponentialRetryPolicyFilter = azure.ExponentialRetryPolicyFilter;
var Constants = azure.Constants;
var StorageUtilities = azure.StorageUtilities;
var BlobUtilities = azure.BlobUtilities;
var HttpConstants = Constants.HttpConstants;
var HeaderConstants = Constants.HeaderConstants;
var StorageServiceClientConstants = Constants.StorageServiceClientConstants;
var QueryStringConstants = Constants.QueryStringConstants;
var CompatibleVersionConstants = Constants.CompatibleVersionConstants;

var blobNames = [];
var blobNamesPrefix = 'blob';

var fileName = 'blobservice_test.tmp';
var blob60MBuffer = new Buffer(80 * 1024 * 1024);

var suite = new TestSuite('blobservice-tests');
var runOrSkip = suite.isMocked ? it.skip : it;
var aclTimeout = (suite.isRecording || !suite.isMocked) ? 30000 : 10;

var containerNames = [];
var containerNamesPrefix = 'cont' + (suite.isMocked ? 0 : Math.floor(Math.random() * 10000));

var blobService;
var suiteUtil;

var containers = [];

describe('BlobService', function () {
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

  describe('serverTimeout', function() {
    it('should work', function (done) {
      var timeout = null;
      var callback = function(webresource) {
        if (webresource.queryString['timeout']) {
          timeout = webresource.queryString['timeout'];
        } else {
          timeout = null;
        }
      };

      blobService.on('sendingRequestEvent', callback);

      blobService.getServiceProperties(function(error1) {
        assert.equal(error1, null);
        assert.equal(timeout, null);
        blobService.getServiceProperties({timeoutIntervalInMs: 10000}, function(error2) {
          assert.equal(error2, null);
          assert.equal(timeout, 10000);
          blobService.defaultTimeoutIntervalInMs = 9000;
          blobService.getServiceProperties(function(error3) {
            assert.equal(error3, null);
            assert.equal(timeout, 9000);
            blobService.getServiceProperties({timeoutIntervalInMs: 10000}, function(error4) {
              assert.equal(error4, null);
              assert.equal(timeout, 10000);
              blobService.getServiceProperties({timeoutIntervalInMs: null}, function(error5) {
                assert.equal(error5, null);
                assert.equal(timeout, 9000);
                blobService.getServiceProperties({timeoutIntervalInMs: 0}, function(error6) {
                  assert.equal(error6, null);
                  assert.equal(timeout, null);
                  blobService.defaultTimeoutIntervalInMs = null;
                  blobService.getServiceProperties(function(error7) {
                    assert.equal(error7, null);
                    assert.equal(timeout, null);
                    blobService.removeAllListeners();
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

  describe('listContainers', function () {
    it('should work', function (done) {
      var containerName1 = testutil.generateId(containerNamesPrefix, containerNames, suite.isMocked);
      var metadata1 = {
        COLOR: 'Orange',
        containernumber: '01',
        somemetadataname: 'SomeMetadataValue'
      };

      var containerName2 = testutil.generateId(containerNamesPrefix, containerNames, suite.isMocked);
      var metadata2 = {
        Color: 'pink',
        containerNumber: '02',
        somemetadataname: 'SomeMetadataValue'
      };

      var containerName3 = testutil.generateId(containerNamesPrefix, containerNames, suite.isMocked);
      var metadata3 = {
        color: 'brown',
        containernumber: '03',
        somemetadataname: 'SomeMetadataValue'
      };

      var containerName4 = testutil.generateId(containerNamesPrefix, containerNames, suite.isMocked);
      var metadata4 = {
        color: 'blue',
        containernumber: '04',
        somemetadataname: 'SomeMetadataValue'
      };

      var validateAndDeleteContainers = function (containers, callback) {
        var entries = [];
        containers.forEach(function (container) {
          if (container.name == containerName1) {
            assert.equal(container.metadata.color, metadata1.COLOR);
            assert.equal(container.metadata.containernumber, metadata1.containernumber);
            assert.equal(container.metadata.somemetadataname, metadata1.somemetadataname);

            blobService.deleteContainer(container.name, function (deleteError1) {
              assert.equal(null, deleteError1);
              entries.push(container.name);
              if (entries.length === 4) {
                callback(entries);
              }
            });
          }
          else if (container.name == containerName2) {
            assert.equal(container.metadata.color, metadata2.Color);
            assert.equal(container.metadata.containernumber, metadata2.containerNumber);
            assert.equal(container.metadata.somemetadataname, metadata2.somemetadataname);

            blobService.deleteContainer(container.name, function (deleteError2) {
              assert.equal(null, deleteError2);
              entries.push(container.name);
              if (entries.length === 4) {
                callback(entries);
              }
            });
          }
          else if (container.name == containerName3) {
            assert.equal(container.metadata.color, metadata3.color);
            assert.equal(container.metadata.containernumber, metadata3.containernumber);
            assert.equal(container.metadata.somemetadataname, metadata3.somemetadataname);

            blobService.deleteContainer(container.name, function (deleteError3) {
              assert.equal(null, deleteError3);
              entries.push(container.name);
              if (entries.length === 4) {
                callback(entries);
              }
            });
          }
          else if (container.name == containerName4) {
            assert.equal(container.metadata.color, metadata4.color);
            assert.equal(container.metadata.containernumber, metadata4.containernumber);
            assert.equal(container.metadata.somemetadataname, metadata4.somemetadataname);

            blobService.deleteContainer(container.name, function (deleteError4) {
              assert.equal(null, deleteError4);
              entries.push(container.name);
              if (entries.length === 4) {
                callback(entries);
              }
            });
          }
        });
      };

      blobService.createContainer(containerName1, { metadata: metadata1 }, function (createError1, createContainer1, createResponse1) {
        assert.equal(createError1, null);
        assert.notEqual(createContainer1, null);
        assert.ok(createResponse1.isSuccessful);

        blobService.createContainer(containerName2, { metadata: metadata2 }, function (createError2, createContainer2, createResponse2) {
          assert.equal(createError2, null);
          assert.notEqual(createContainer2, null);
          assert.ok(createResponse2.isSuccessful);

          blobService.createContainer(containerName3, { metadata: metadata3 }, function (createError3, createContainer3, createResponse3) {
            assert.equal(createError3, null);
            assert.notEqual(createContainer3, null);
            assert.ok(createResponse3.isSuccessful);

            blobService.createContainer(containerName4, { metadata: metadata4 }, function (createError4, createContainer4, createResponse4) {
              assert.equal(createError4, null);
              assert.notEqual(createContainer4, null);
              assert.ok(createResponse4.isSuccessful);

              var options = {
                'maxResults': 3,
                'include': 'metadata',
              };

              containers.length = 0;
              listContainers(containerNamesPrefix, options, null, function () {
                validateAndDeleteContainers(containers, function(entries) {
                  assert.equal(entries.length, 4);
                  done();  
                });                
              });
            });
          });
        });
      });
    });

    it('should work with optional parameters', function (done) {
      var listContainersWithoutPrefix = function (options, token, callback) {
        blobService.listContainersSegmented(token, options, function(error, result) {
          assert.equal(error, null);
          containers.push.apply(containers, result.entries);
          var token = result.continuationToken;
          if(token) {
            listContainersWithoutPrefix(options, token, callback);
          }
          else {
            callback();
          }
        });
      };

      listContainersWithoutPrefix(null, null, function () {
        done();
      });
    });

    it('should work with prefix parameter', function (done) {
      containers.length = 0;
      listContainers('中文', null, null, function () {
        assert.equal(containers.length, 0);
        done();
      });
    });
  });

  describe('blob', function () {
    var containerName;

    describe('prepare a container for blob tests', function () {
      it('should work', function (done) {
        containerName = testutil.generateId(containerNamesPrefix, containerNames, suite.isMocked);
        blobService.createContainer(containerName, done);
      });
    });

    describe('createBlockBlobFromText', function () {
      it('shouldWork', function (done) {
        var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);
        var blobText = 'Hello World';

        blobService.createBlockBlobFromText(containerName, blobName, blobText, function (uploadError, blob, uploadResponse) {
          assert.equal(uploadError, null);
          assert.ok(uploadResponse.isSuccessful);

          blobService.getBlobToText(containerName, blobName, function (downloadErr, blobText, blob, downloadResponse) {
            assert.equal(downloadErr, null);
            assert.ok(downloadResponse.isSuccessful);
            assert.ok(blob);
            assert.equal(blobText, blobText);

            done();
          });
        });
      });

      it('strangeChars1', function (done) {
        var blobName = 'def@#/abef?def/& &/abcde+=-';
        var blobText = 'def@#/abef?def/& &/abcde+=-';

        blobService.createBlockBlobFromText(containerName, blobName, blobText, function (uploadError, blob, uploadResponse) {
          assert.equal(uploadError, null);
          assert.ok(uploadResponse.isSuccessful);

          blobService.getBlobToText(containerName, blobName, function (downloadErr, blobText, blob, downloadResponse) {
            assert.equal(downloadErr, null);
            assert.ok(downloadResponse.isSuccessful);
            assert.ok(blob);
            assert.equal(blobText, blobText);

            done();
          });
        });
      });

      it('strangeChars2', function (done) {
        var blobName = '\u2488\u2460\u216B\u3128\u3129'.toString('GB18030');
        var blobText = '\u2488\u2460\u216B\u3128\u3129'.toString('GB18030');

        blobService.createBlockBlobFromText(containerName, blobName, blobText, function (uploadError, blob, uploadResponse) {
          assert.equal(uploadError, null);
          assert.ok(uploadResponse.isSuccessful);

          blobService.getBlobToText(containerName, blobName, function (downloadErr, blobText, blob, downloadResponse) {
            assert.equal(downloadErr, null);
            assert.ok(downloadResponse.isSuccessful);
            assert.ok(blob);
            assert.equal(blobText, blobText);

            done();
          });
        });
      });

      it('withBuffer', function (done) {
        var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);
        var blobText = new Buffer('Hello World');

        blobService.createBlockBlobFromText(containerName, blobName, blobText, function (uploadError, blob, uploadResponse) {
          assert.equal(uploadError, null);
          assert.ok(uploadResponse.isSuccessful);

          blobService.getBlobToText(containerName, blobName, function (downloadErr,  blobText, blob, downloadResponse) {
            assert.equal(downloadErr, null);
            assert.ok(downloadResponse.isSuccessful);
            assert.ok(blob);
            assert.equal(blobText, blobText);

            done();
          });
        });
      });
    });

    describe('deleteBlob', function () {
      var blobName;
      var blobText;

      beforeEach(function(done) {
        blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);
        blobText = 'Hello World';

        blobService.createBlockBlobFromText(containerName, blobName, blobText, function (uploadError, blob, putResponse) {
          assert.equal(uploadError, null);
          assert.notEqual(putResponse, null);
          assert.ok(putResponse.isSuccessful);
          done();
        });
      });

      it('should delete a blob', function (done) {
        blobService.deleteBlob(containerName, blobName, function(deleteError, deleteResponse) {
          assert.equal(deleteError, null);
          assert.notEqual(deleteResponse, null);
          assert.ok(deleteResponse.isSuccessful);

          blobService.getBlobToText(containerName, blobName, function (getError, content, blockBlob, getResponse) {
            assert.notEqual(getError, null);
            assert.strictEqual(getError.statusCode, 404);
            assert.strictEqual(getError.code, Constants.BlobErrorCodeStrings.BLOB_NOT_FOUND);
            done();
          });
        });
      });
    
      it('should delete a snapshot', function (done) {
        blobService.createBlobSnapshot(containerName, blobName, function (snapshotError, snapshotId, snapshotResponse) {
          assert.equal(snapshotError, null);
          assert.notEqual(snapshotResponse, null);
          assert.notEqual(snapshotId, null);
          assert.ok(snapshotResponse.isSuccessful);

          var options = {
            snapshotId: snapshotId
          };
          blobService.deleteBlob(containerName, blobName, options, function(deleteError, deleteResponse) {
            assert.equal(deleteError, null);
            assert.notEqual(deleteResponse, null);
            assert.ok(deleteResponse.isSuccessful);

            // snapshot should not exist
            blobService.getBlobToText(containerName, blobName, options, function (getError, content, blockBlob, getResponse) {
              assert.notEqual(getError, null);
              assert.strictEqual(getError.statusCode, 404);
              assert.strictEqual(getError.code, Constants.BlobErrorCodeStrings.BLOB_NOT_FOUND);
              
              // regular blob should exist
              blobService.getBlobToText(containerName, blobName, function (getError2, content2, blockBlob2, getResponse2) {
                assert.equal(getError2, null);
                assert.notEqual(content2, null);
                assert.notEqual(blockBlob2, null);
                assert.ok(getResponse2.isSuccessful);
                done();
              });
            });
          });
        });
      });

      it('should delete a blob and its snapshots', function (done) {
        blobService.createBlobSnapshot(containerName, blobName, function (snapshotError, snapshotId, snapshotResponse) {
          assert.equal(snapshotError, null);
          assert.notEqual(snapshotResponse, null);
          assert.ok(snapshotResponse.isSuccessful);
          assert.notEqual(snapshotId, null);

          var options = {
            deleteSnapshots: BlobUtilities.SnapshotDeleteOptions.BLOB_AND_SNAPSHOTS
          };
          blobService.deleteBlob(containerName, blobName, options, function(deleteError, deleteResponse) {
            assert.equal(deleteError, null);
            assert.notEqual(deleteResponse, null);
            assert.ok(deleteResponse.isSuccessful);

            options = {
              snapshotId: snapshotId
            };
            // snapshot should not exist
            blobService.getBlobToText(containerName, blobName, options, function (getError, content, blockBlob, getResponse) {
              assert.notEqual(getError, null);
              assert.strictEqual(getError.statusCode, 404);
              assert.strictEqual(getError.code, Constants.BlobErrorCodeStrings.BLOB_NOT_FOUND);
              
              // regular blob not should exist
              blobService.getBlobToText(containerName, blobName, function (getError2, content2, blockBlob2, getResponse2) {
                assert.notEqual(getError2, null);
                assert.strictEqual(getError2.statusCode, 404);
                assert.strictEqual(getError2.code, Constants.BlobErrorCodeStrings.BLOB_NOT_FOUND);
                done();
              });
            });
          });
        });
      });

      it('should delete only a blob\'s snapshots', function (done) {
        blobService.createBlobSnapshot(containerName, blobName, function (snapshotError, snapshotId, snapshotResponse) {
          assert.equal(snapshotError, null);
          assert.notEqual(snapshotResponse, null);
          assert.ok(snapshotResponse.isSuccessful);
          assert.notEqual(snapshotId, null);

          var options = {
            deleteSnapshots: BlobUtilities.SnapshotDeleteOptions.SNAPSHOTS_ONLY
          };
          blobService.deleteBlob(containerName, blobName, options, function(deleteError, deleteResponse) {
            assert.equal(deleteError, null);
            assert.notEqual(deleteResponse, null);
            assert.ok(deleteResponse.isSuccessful);

            options = {
              snapshotId: snapshotId
            };
            // snapshot should not exist
            blobService.getBlobToText(containerName, blobName, options, function (getError, content, blockBlob, getResponse) {
              assert.notEqual(getError, null);
              assert.strictEqual(getError.statusCode, 404);
              assert.strictEqual(getError.code, Constants.BlobErrorCodeStrings.BLOB_NOT_FOUND);
              
              // regular blob should exist
              blobService.getBlobToText(containerName, blobName, function (getError2, content2, blockBlob2, getResponse2) {
                assert.equal(getError2, null);
                assert.notEqual(content2, null);
                assert.notEqual(blockBlob2, null);
                assert.ok(getResponse2.isSuccessful);
                done();
              });
            });
          });
        });
      });

      it('should delete a blob if it exists', function (done) {
        // does blob exists should return true
        blobService.doesBlobExist(containerName, blobName, function (existsError, exists) {
          assert.equal(existsError, null);
          assert.strictEqual(exists, true);

          // delete if exists should succeed
          blobService.deleteBlobIfExists(containerName, blobName, function(deleteError, deleted) {
            assert.equal(deleteError, null);
            assert.strictEqual(deleted, true);

            // does blob exists should return false
            blobService.doesBlobExist(containerName, blobName, function (existsError2, exists2) {
              assert.equal(existsError2, null);
              assert.strictEqual(exists2, false);

              // delete if exists should succeed with a false status
              blobService.deleteBlobIfExists(containerName, blobName, function(deleteError2, deleted2) {
                assert.equal(deleteError2, null);
                assert.strictEqual(deleted2, false);
                done();
              });
            });
          });
        });
      });
    });

    describe('setBlobMime', function () {
      it('should work', function (done) {
        var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);
        var fileNameSource = testutil.generateId('file') + '.bmp'; // fake bmp file with text...
        var blobText = 'Hello World!';

        fs.writeFile(fileNameSource, blobText, function () {

          // Create the empty page blob
          var blobOptions = {blockIdPrefix : 'blockId' };
          blobService.createBlockBlobFromLocalFile(containerName, blobName, fileNameSource, blobOptions, function (err) {
            assert.equal(err, null);

            blobService.getBlobToText(containerName, blobName, { rangeStart: 2 }, function (err3, content1, blob) {
              assert.equal(err3, null);

              // get the last bytes from the message
              assert.equal(content1, 'llo World!');
              assert.ok(blob.contentType === 'image/bmp' || blob.contentType === 'image/x-ms-bmp');

              try { fs.unlinkSync(fileNameSource); } catch (e) {};
              done();
            });
          });
        });
      });

      it('should work with skip', function (done) {
        var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);
        var fileNameSource = testutil.generateId('prefix') + '.bmp'; // fake bmp file with text...
        var blobText = 'Hello World!';

        fs.writeFile(fileNameSource, blobText, function () {
          // Create the empty page blob
          blobService.createBlockBlobFromLocalFile(containerName, blobName, fileNameSource, { contentType: null, contentTypeHeader: null, blockIdPrefix : 'blockId' }, function (err) {
            assert.equal(err, null);

            blobService.getBlobToText(containerName, blobName, { rangeStart: 2 }, function (err3, content1, blob) {
              assert.equal(err3, null);

              // get the last bytes from the message
              assert.equal(content1, 'llo World!');
              assert.equal(blob.contentType, 'application/octet-stream');

              try { fs.unlinkSync(fileNameSource); } catch (e) {};
              done();
            });
          });
        });
      });
    });

    describe('blob other operations', function () {
      it('createBlobSnapshot', function (done) {
        var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);
        var blobText = 'Hello World';

        blobService.createBlockBlobFromText(containerName, blobName, blobText, function (uploadError, blob, putResponse) {
          assert.equal(uploadError, null);
          assert.notEqual(putResponse, null);
          if (putResponse) {
            assert.ok(putResponse.isSuccessful);
          }

          blobService.createBlobSnapshot(containerName, blobName, function (snapshotError, snapshotId, snapshotResponse) {
            assert.equal(snapshotError, null);
            assert.notEqual(snapshotResponse, null);
            assert.notEqual(snapshotId, null);

            if (snapshotResponse) {
              assert.ok(snapshotResponse.isSuccessful);
            }

            blobService.getBlobToText(containerName, blobName, function (getError, content, blockBlob, getResponse) {
              assert.equal(getError, null);
              assert.notEqual(blockBlob, null);
              assert.notEqual(getResponse, null);
              if (getResponse) {
                assert.ok(getResponse.isSuccessful);
              }

              assert.equal(blobText, content);
              done();
            });
          });
        });
      });

      it('getBlobProperties', function (done) {
        var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);
        var metadata = {
          color: 'blue'
        };

        blobService.createBlockBlobFromText(containerName, blobName, 'hello', { metadata: metadata }, function (blobErr) {
          assert.equal(blobErr, null);

          blobService.getBlobProperties(containerName, blobName, function (getErr, blob) {
            assert.equal(getErr, null);

            assert.notEqual(blob, null);

            if (blob) {
              assert.notEqual(blob.metadata, null);
              if (blob.metadata) {
                assert.equal(blob.metadata.color, metadata.color);
              }
            }

            done();
          });
        });
      });

      it('getBlobProperties with snapshotId', function (done) {
        var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);
        var metadata = {
          color: 'blue'
        };

        blobService.createBlockBlobFromText(containerName, blobName, 'hello', { metadata: metadata }, function (blobErr) {
          assert.equal(blobErr, null);

          blobService.createBlobSnapshot(containerName, blobName, function (snapshotError, snapshotId, snapshotResponse) {
            assert.equal(snapshotError, null);
            assert.notEqual(snapshotResponse, null);
            assert.notEqual(snapshotId, null);

            if (snapshotResponse) {
              assert.ok(snapshotResponse.isSuccessful);
            }
          
            blobService.setBlobMetadata(containerName, blobName, {color: 'red'}, function (setMetadataErr) {
              assert.equal(setMetadataErr, null);
              blobService.getBlobProperties(containerName, blobName, {'snapshotId': snapshotId}, function (getErr, blob) {
                assert.equal(getErr, null);

                assert.notEqual(blob, null);

                if (blob) {
                  assert.notEqual(blob.metadata, null);
                  if (blob.metadata) {
                    assert.equal(blob.metadata.color, metadata.color);
                  }
                }
                done();
              });
            });
          });
        });
      });

      it('setBlobProperties', function (done) {
        var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);
        var text = 'hello';

        blobService.createBlockBlobFromText(containerName, blobName, text, function (blobErr) {
          assert.equal(blobErr, null);

          var options = {};
          options.contentType = 'text';
          options.contentEncoding = 'utf8';
          options.contentLanguage = 'pt';
          options.cacheControl = 'true';
          options.contentDisposition = 'attachment';

          blobService.setBlobProperties(containerName, blobName, options, function (setErr) {
            assert.equal(setErr, null);

            blobService.getBlobProperties(containerName, blobName, function (getErr, blob) {
              assert.equal(getErr, null);

              assert.notEqual(blob, null);
              if (blob) {
                assert.equal(text.length, blob.contentLength);
                assert.equal(options.contentType, blob.contentType);
                assert.equal(options.contentEncoding, blob.contentEncoding);
                assert.equal(options.contentLanguage, blob.contentLanguage);
                assert.equal(options.cacheControl, blob.cacheControl);
                assert.equal(options.contentDisposition, blob.contentDisposition);
              }

              done();
            });
          });
        });
      });

      it('setPageBlobSequenceNumber', function (done) {
        var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);
        var fileNameSource = testutil.generateId('getBlobFile', [], suite.isMocked) + '.test';

        var blobBuffer = new Buffer(1024);
        blobBuffer.fill(0);
        blobBuffer[0] = '1';
        blobService.createPageBlob(containerName, blobName, 1024, function(createErr) {
          assert.equal(createErr, null);

          blobService.setPageBlobSequenceNumber(containerName, blobName, BlobUtilities.SequenceNumberAction.UPDATE, 5, function(setErr, blob) {
            assert.equal(setErr, null);
            assert.equal(blob.sequenceNumber, 5);

            blobService.setPageBlobSequenceNumber(containerName, blobName, BlobUtilities.SequenceNumberAction.MAX, 7, function(setErr1, blob1) {
              assert.equal(setErr1, null);
              assert.equal(blob1.sequenceNumber, 7);

              blobService.setPageBlobSequenceNumber(containerName, blobName, BlobUtilities.SequenceNumberAction.MAX, 3, function(setErr2, blob2) {
                assert.equal(setErr2, null);
                assert.equal(blob2.sequenceNumber, 7);

                blobService.setPageBlobSequenceNumber(containerName, blobName, BlobUtilities.SequenceNumberAction.INCREMENT, null, function(setErr3, blob3) {
                  assert.equal(setErr3, null);
                  assert.equal(blob3.sequenceNumber, 8);

                  function setPageSequenceNumber(containerName, blobName, SequenceNumberAction, sequenceNumber) {
                    blobService.setPageBlobSequenceNumber(containerName, blobName, SequenceNumberAction, sequenceNumber, function() {});
                  }

                  assert.throws( function() { setPageSequenceNumber(containerName, blobName, BlobUtilities.SequenceNumberAction.UPDATE, null); },
                    function (err) {return (err instanceof Error) && err.message === util.format(SR.ARGUMENT_NULL_OR_EMPTY, 'sequenceNumber')});
                  assert.throws( function() { setPageSequenceNumber(containerName, blobName, BlobUtilities.SequenceNumberAction.MAX, null); },
                     function (err) {return (err instanceof Error) && err.message === util.format(SR.ARGUMENT_NULL_OR_EMPTY, 'sequenceNumber')});
                  assert.throws( function() { setPageSequenceNumber(containerName, blobName, BlobUtilities.SequenceNumberAction.INCREMENT, 1); },
                    function (err) {return (err instanceof Error) && err.message === SR.BLOB_INVALID_SEQUENCE_NUMBER});

                  fs.writeFile(fileNameSource, blobBuffer, function () {
                    var options = { accessConditions: { 'x-ms-if-sequence-number-eq': 8} };
                    blobService.createPagesFromStream(containerName, blobName, rfs.createReadStream(fileNameSource), 0, 1023, options, function(createPagesErr) {
                      assert.equal(createPagesErr, null);

                      blobService.clearPageRange(containerName, blobName, 0, 1023, options, function(clearPagesErr) {
                        assert.equal(clearPagesErr, null);

                        options = { accessConditions: { 'x-ms-if-sequence-number-le': 8} };
                        blobService.createPagesFromStream(containerName, blobName, rfs.createReadStream(fileNameSource), 0, 1023, options, function(createPagesErr1) {
                          assert.equal(createPagesErr1, null);

                          blobService.clearPageRange(containerName, blobName, 0, 1023, options, function(clearPagesErr2) {
                            assert.equal(clearPagesErr2, null);

                            options = { accessConditions: { 'x-ms-if-sequence-number-le': 9} };
                            blobService.createPagesFromStream(containerName, blobName, rfs.createReadStream(fileNameSource), 0, 1023, options, function(createPagesErr2) {
                              assert.equal(createPagesErr2, null);

                              blobService.clearPageRange(containerName, blobName, 0, 1023, options, function(clearPagesErr2) {
                                assert.equal(clearPagesErr2, null);

                                options = { accessConditions: { 'x-ms-if-sequence-number-lt': 9} };
                                blobService.createPagesFromStream(containerName, blobName, rfs.createReadStream(fileNameSource), 0, 1023, options, function(createPagesErr3) {
                                  assert.equal(createPagesErr3, null);

                                  blobService.clearPageRange(containerName, blobName, 0, 1023, options, function(clearPagesErr3) {
                                    assert.equal(clearPagesErr3, null);

                                    options = { accessConditions: { 'x-ms-if-sequence-number-eq': 9} };
                                    blobService.createPagesFromStream(containerName, blobName, rfs.createReadStream(fileNameSource), 0, 1023, options, function(createPagesErr4, blobResult4, createPageResponse4) {
                                      assert.notEqual(createPagesErr4, null);
                                      assert.equal(createPageResponse4.statusCode, HttpConstants.HttpResponseCodes.PreconditionFailed);

                                      blobService.clearPageRange(containerName, blobName, 0, 1023, options, function(clearPagesErr5, clearPageResponse5) {
                                        assert.notEqual(clearPagesErr5, null);
                                        assert.equal(clearPageResponse5.statusCode, HttpConstants.HttpResponseCodes.PreconditionFailed);

                                        options = { accessConditions: { 'x-ms-if-sequence-number-le': 7} };
                                        blobService.createPagesFromStream(containerName, blobName, rfs.createReadStream(fileNameSource), 0, 1023, options, function(createPagesErr6, blobResult6, createPageResponse6) {
                                          assert.notEqual(createPagesErr6, null);
                                          assert.equal(createPageResponse6.statusCode, HttpConstants.HttpResponseCodes.PreconditionFailed);

                                          blobService.clearPageRange(containerName, blobName, 0, 1023, options, function(clearPagesErr7, clearPageResponse7) {
                                            assert.notEqual(clearPagesErr7, null);
                                            assert.equal(clearPageResponse7.statusCode, HttpConstants.HttpResponseCodes.PreconditionFailed);

                                            options = { accessConditions: { 'x-ms-if-sequence-number-lt': 8} };
                                            blobService.createPagesFromStream(containerName, blobName, rfs.createReadStream(fileNameSource), 0, 1023, options, function(createPagesErr7, blobResult7, createPageResponse7) {
                                              assert.notEqual(createPagesErr7, null);
                                              assert.equal(createPageResponse7.statusCode, HttpConstants.HttpResponseCodes.PreconditionFailed);

                                              blobService.clearPageRange(containerName, blobName, 0, 1023, options, function(clearPagesErr8, clearPageResponse8) {
                                                assert.notEqual(clearPagesErr8, null);
                                                assert.equal(clearPageResponse8.statusCode, HttpConstants.HttpResponseCodes.PreconditionFailed);

                                                try { fs.unlinkSync(fileNameSource); } catch (e) {};

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
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });

      it('PageBlobResize', function (done) {
        var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);

        blobService.createPageBlob(containerName, blobName, 1024, function(createErr) {
          assert.equal(createErr, null);

          blobService.getBlobProperties(containerName, blobName, function(getErr, blob) {
            assert.equal(getErr, null);
            assert.equal(blob.contentLength, 1024);

            blobService.resizePageBlob(containerName, blobName, 2048, function(resizeErr) {
              assert.equal(resizeErr, null);

              blobService.getBlobProperties(containerName, blobName, function(getErr, blob) {
                assert.equal(getErr, null);
                assert.equal(blob.contentLength, 2048);
                done();
              });
            });
          });
        });
      });

      it('getBlobMetadata', function (done) {
        var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);
        var metadata = { color: 'blue' };

        blobService.createBlockBlobFromText(containerName, blobName, 'hello', { metadata: metadata }, function (blobErr) {
          assert.equal(blobErr, null);

          blobService.getBlobMetadata(containerName, blobName, function (getErr, blob) {
            assert.equal(getErr, null);

            assert.notEqual(blob, null);
            if (blob) {
              assert.notEqual(blob.metadata, null);
              if (blob.metadata) {
                assert.equal(blob.metadata.color, metadata.color);
              }
            }

            done();
          });
        });
      });

      it('setBlobMetadata', function (done) {
        var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);
        
        var metadata = { color: 'blue' };
        blobService.createBlockBlobFromText(containerName, blobName, 'hello', function (blobErr) {
          assert.equal(blobErr, null);

          blobService.setBlobMetadata(containerName, blobName, metadata, function (setErr) {
            assert.equal(setErr, null);
          
            blobService.getBlobMetadata(containerName, blobName, function (getErr, blob) {
              assert.equal(getErr, null);

              assert.notEqual(blob, null);
              if (blob) {
                assert.notEqual(blob.metadata, null);
                if (blob.metadata) {
                  assert.equal(blob.metadata.color, metadata.color);
                }
              }
              done();
            });
          });
        });
      });

      it('should ignore the metadata in the options', function (done) {  
        var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);  
         
        var metadata = { color: 'blue' };  
        blobService.createBlockBlobFromText(containerName, blobName, 'hello', function (blobErr) {  
          assert.equal(blobErr, null);  

          var options = { metadata: {color: 'red'} };  
          blobService.setBlobMetadata(containerName, blobName, metadata, options, function (setErr) {  
            assert.equal(setErr, null);  
            
            blobService.getBlobMetadata(containerName, blobName, function (getErr, blob) {  
              assert.equal(getErr, null);  
  
              assert.notEqual(blob, null);  
              if (blob) {  
                assert.notEqual(blob.metadata, null);  
                if (blob.metadata) {  
                  assert.equal(blob.metadata.color, metadata.color);  
                }  
              }  
              done();  
            });  
          });  
        });  
      }); 

      it('should merge the metadata', function (done) {
        var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);
        
        var metadata = { color: 'blue', Color: 'Orange', COLOR: 'Red' };
        blobService.createBlockBlobFromText(containerName, blobName, 'hello', function (blobErr) {
          assert.equal(blobErr, null);

          blobService.setBlobMetadata(containerName, blobName, metadata, function (setErr) {
            assert.equal(setErr, null);
          
            blobService.getBlobMetadata(containerName, blobName, function (getErr, blob) {
              assert.equal(getErr, null);

              assert.notEqual(blob, null);
              if (blob) {
                assert.notEqual(blob.metadata, null);
                if (blob.metadata) {
                  assert.strictEqual(blob.metadata.color, 'blue,Orange,Red');
                }
              }
              done();
            });
          });
        });
      });
    });

    describe('delete the container for blob tests', function () {
      it('should work', function(done) {
        blobService.deleteContainerIfExists(containerName, done);
      });
    });
  });

  describe('startCopyBlob', function () {
    it('should work', function (done) {
      var sourceContainerName = testutil.generateId(containerNamesPrefix, containerNames, suite.isMocked);
      var targetContainerName = testutil.generateId(containerNamesPrefix, containerNames, suite.isMocked);

      var sourceBlobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);
      var targetBlobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);

      var blobText = 'hi there';

      blobService.createContainer(sourceContainerName, function (createErr1) {
        assert.equal(createErr1, null);

        blobService.createContainer(targetContainerName, function (createErr2) {
          assert.equal(createErr2, null);

          blobService.createBlockBlobFromText(sourceContainerName, sourceBlobName, blobText, function (uploadErr) {
            assert.equal(uploadErr, null);

            blobService.startCopyBlob(blobService.getUrl(sourceContainerName, sourceBlobName), targetContainerName, targetBlobName, function (copyErr, copyRes) {
              assert.equal(copyErr, null);

              blobService.abortCopyBlob(targetContainerName, targetBlobName, copyRes.copyId, function (copyErr) {
                assert.notEqual(copyErr, null);
                assert.equal(copyErr.statusCode, 409);
              });

              blobService.getBlobToText(targetContainerName, targetBlobName, function (downloadErr, text) {
                assert.equal(downloadErr, null);
                assert.equal(text, blobText);

                blobService.deleteContainer(sourceContainerName, function (deleteError) {
                  assert.equal(deleteError, null);
                  blobService.deleteContainer(targetContainerName, function (deleteError) {
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

    it('should work with snapshotID', function(done) {
      var sourceContainerName = testutil.generateId(containerNamesPrefix, containerNames, suite.isMocked);
      var targetContainerName = testutil.generateId(containerNamesPrefix, containerNames, suite.isMocked);

      var sourceBlobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);
      var targetBlobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);

      var blobText = 'hi there';

      blobService.createContainer(sourceContainerName, function (createErr1) {
        assert.equal(createErr1, null);

        blobService.createContainer(targetContainerName, function (createErr2) {
          assert.equal(createErr2, null);

          blobService.createBlockBlobFromText(sourceContainerName, sourceBlobName, blobText, function (uploadErr) {
            assert.equal(uploadErr, null);

            blobService.createBlobSnapshot(sourceContainerName, sourceBlobName, function (snapshotError, snapshotId, snapshotResponse) {
              assert.equal(snapshotError, null);
              assert.notEqual(snapshotResponse, null);
              assert.notEqual(snapshotId, null);

              if (snapshotResponse) {
                assert.ok(snapshotResponse.isSuccessful);
              }

              blobService.startCopyBlob(blobService.getUrl(sourceContainerName, sourceBlobName), targetContainerName, targetBlobName, {'snapshotId': snapshotId}, function (copyErr, copyRes) {
                assert.equal(copyErr, null);
                blobService.getBlobToText(targetContainerName, targetBlobName, function (downloadErr, text) {
                  assert.equal(downloadErr, null);
                  assert.equal(text, blobText);

                  blobService.deleteContainer(sourceContainerName, function (deleteError) {
                    assert.equal(deleteError, null);
                    blobService.deleteContainer(targetContainerName, function (deleteError) {
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

  describe('shared access signature', function () {
    describe('getBlobUrl', function () {
      it('should work', function (done) {
        var containerName = testutil.generateId(containerNamesPrefix, containerNames, suite.isMocked);
        var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);

        var blobServiceassert;
        var blobUrl;

        blobServiceassert = azure.createBlobService('storageAccount', 'storageAccessKey');
        blobServiceassert.setHost({primaryHost: 'host.com'});
        blobUrl = blobServiceassert.getUrl(containerName);
        assert.equal(blobUrl, 'https://host.com/' + containerName);
        blobUrl = blobServiceassert.getUrl(containerName, blobName);
        assert.equal(blobUrl, 'https://host.com/' + containerName + '/' + blobName);
        
        blobServiceassert = azure.createBlobService('storageAccount', 'storageAccessKey');
        blobServiceassert.setHost({ primaryHost: 'http://host.com:80' });
        blobUrl = blobServiceassert.getUrl(containerName);
        assert.equal(blobUrl, 'http://host.com/' + containerName);
        blobUrl = blobServiceassert.getUrl(containerName, blobName);
        assert.equal(blobUrl, 'http://host.com/' + containerName + '/' + blobName);
        
        blobServiceassert = azure.createBlobService('storageAccount', 'storageAccessKey');
        blobServiceassert.setHost({ primaryHost: 'https://host.com:443' });
        blobUrl = blobServiceassert.getUrl(containerName);
        assert.equal(blobUrl, 'https://host.com/' + containerName);
        blobUrl = blobServiceassert.getUrl(containerName, blobName);
        assert.equal(blobUrl, 'https://host.com/' + containerName + '/' + blobName);

        blobServiceassert = azure.createBlobService('storageAccount', 'storageAccessKey');
        blobServiceassert.setHost({primaryHost: 'http://host.com:88'});
        blobUrl = blobServiceassert.getUrl(containerName);
        assert.equal(blobUrl, 'http://host.com:88/' + containerName);
        blobUrl = blobServiceassert.getUrl(containerName, blobName);
        assert.equal(blobUrl, 'http://host.com:88/' + containerName + '/' + blobName);

        blobServiceassert = azure.createBlobService('storageAccount', 'storageAccessKey');
        blobServiceassert.setHost({primaryHost: 'host.com:88'});
        blobUrl = blobServiceassert.getUrl(containerName);
        assert.equal(blobUrl, 'https://host.com:88/' + containerName);
        blobUrl = blobServiceassert.getUrl(containerName, blobName);
        assert.equal(blobUrl, 'https://host.com:88/' + containerName + '/' + blobName);

        done();
      });

      it('should work with shared access policy', function (done) {
        var containerName = 'container';
        var blobName = 'blob';

        var blobServiceassert = azure.createBlobService('storageAccount', 'storageAccessKey', 'host.com:80');

        var sharedAccessPolicy = {
          AccessPolicy: {
            Expiry: new Date('October 12, 2011 11:53:40 am GMT')
          }
        };

        var blobUrl = blobServiceassert.getUrl(containerName, blobName, blobServiceassert.generateSharedAccessSignature(containerName, blobName, sharedAccessPolicy));

        var parsedUrl = url.parse(blobUrl);
        assert.strictEqual(parsedUrl.protocol, 'https:');
        assert.strictEqual(parsedUrl.port, '80');
        assert.strictEqual(parsedUrl.hostname, 'host.com');
        assert.strictEqual(parsedUrl.pathname, '/' + containerName + '/' + blobName);
        assert.strictEqual(parsedUrl.query, 'se=2011-10-12T11%3A53%3A40Z&sv=2014-02-14&sr=b&sig=KAewjRdjdHO6gBSe0R0xqGrEwdGf1Ua%2FhnUfjxOhY7w%3D');

        done();
      });

      // Skip this case in nock because the signing key is different between live run and mocked run
      runOrSkip('should work with container acl permissions', function (done) {
        var containerName = testutil.generateId(containerNamesPrefix, containerNames, suite.isMocked);
        var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);
        var fileNameSource = testutil.generateId('prefix') + '.bmp'; // fake bmp file with text...
        var blobText = 'Hello World!';

        blobService.createContainer(containerName, function (error) {
          assert.equal(error, null);

          var startTime = new Date('April 15, 2013 11:53:40 am GMT');
          var readWriteSharedAccessPolicy = [{
            Id: 'readwrite',
            AccessPolicy: {
              Start: startTime,
              Permissions: 'rwdl'
            }
          }];

          blobService.setContainerAcl(containerName, readWriteSharedAccessPolicy, null, function (err) {
            assert.equal(err, null);

            // wait for the acl to get set
            setTimeout(function() {
              blobService.createBlockBlobFromText(containerName, blobName, blobText, function (err) {
                assert.equal(err, null);

                var sasToken = blobService.generateSharedAccessSignature(containerName, blobName, {
                  Id: 'readwrite',
                  AccessPolicy: {
                    Expiry: new Date('April 15, 2099 11:53:40 am GMT')
                  }
                });
                var blobUrl = blobService.getUrl(containerName, blobName, sasToken);
                function responseCallback(err, rsp) {
                  assert.equal(rsp.statusCode, 200);
                  assert.equal(err, null);
                  blobService.deleteContainer(containerName, function (err) {
                    try { fs.unlinkSync(fileNameSource); } catch (e) {};
                    done();
                  });
                }

                request.get(blobUrl, responseCallback).pipe(fs.createWriteStream(fileNameSource));
              });
            }, aclTimeout); 
          });
        });
      });
    });

    it('GenerateSharedAccessSignature', function (done) {
      var containerName = 'images';
      var blobName = 'pic1.png';

      var devStorageBlobService = azure.createBlobService(StorageServiceClientConstants.DEVSTORE_STORAGE_ACCOUNT, StorageServiceClientConstants.DEVSTORE_STORAGE_ACCESS_KEY);

      var sharedAccessPolicy = {
        AccessPolicy: {
          Permissions: BlobUtilities.SharedAccessPermissions.READ,
          Start: new Date('October 11, 2011 11:03:40 am GMT'),
          Expiry: new Date('October 12, 2011 11:53:40 am GMT')
        }
      };

      var sharedAccessSignature = devStorageBlobService.generateSharedAccessSignature(containerName, blobName, sharedAccessPolicy);
      var sasQueryString = qs.parse(sharedAccessSignature);

      assert.equal(sasQueryString[QueryStringConstants.SIGNED_START], '2011-10-11T11:03:40Z');
      assert.equal(sasQueryString[QueryStringConstants.SIGNED_EXPIRY], '2011-10-12T11:53:40Z');
      assert.equal(sasQueryString[QueryStringConstants.SIGNED_RESOURCE], Constants.BlobConstants.ResourceTypes.BLOB);
      assert.equal(sasQueryString[QueryStringConstants.SIGNED_PERMISSIONS], BlobUtilities.SharedAccessPermissions.READ);
      assert.equal(sasQueryString[QueryStringConstants.SIGNED_VERSION], HeaderConstants.TARGET_STORAGE_VERSION);
      assert.equal(sasQueryString[QueryStringConstants.SIGNATURE], 'kXVNIN/SsiEQ1onxqp2bmxay8PFy0mCtEQE41lOyKy8=');

      done();
    });

    runOrSkip('should be able to download blob using SharedAccessSignature', function (done) {
      var containerName = testutil.generateId(containerNamesPrefix, containerNames, suite.isMocked);
      var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);
      var blobService = azure.createBlobService()
      .withFilter(new azure.ExponentialRetryPolicyFilter());

      blobService.createContainer(containerName, function (error) {
        assert.equal(error, null);

        blobService.createBlockBlobFromText(containerName, blobName, 'id1', function (error2) {
          assert.equal(error2, null);
   
          var startDate = new Date();
          var expiryDate = new Date(startDate);
          expiryDate.setMinutes(startDate.getMinutes() + 5);

          var sharedAccessPolicy = {
            AccessPolicy: {
              Permissions: BlobUtilities.SharedAccessPermissions.READ,
              Expiry: expiryDate
            }
          };

          var headers = {
            cacheControl: 'no-transform',
            contentDisposition: 'attachment',
            contentEncoding: 'gzip',
            contentLanguage: 'tr,en',
            contentType: 'text/html'
          };

          var token = blobService.generateSharedAccessSignature(containerName, blobName, sharedAccessPolicy, headers);
          var sharedBlobService = azure.createBlobServiceWithSas(blobService.host, token);
      
          sharedBlobService.getBlobProperties(containerName, blobName, function (error, result) {
            assert.equal(error, null);
            assert.notEqual(result, null);
            assert.equal(headers.cacheControl, result.cacheControl);
            assert.equal(headers.contentDisposition, result.contentDisposition);
            assert.equal(headers.contentEncoding, result.contentEncoding);
            assert.equal(headers.contentLanguage, result.contentLanguage);
            assert.equal(headers.contentType, result.contentType);

            blobService.deleteContainer(containerName, function (deleteError) {
              assert.equal(deleteError, null);
              done();
            });
          });
        });
      });
    });
  
    runOrSkip(util.format('should be able to download blob using old SAS Version: %s', CompatibleVersionConstants.FEBRUARY_2012), function (done) {
      var containerName = testutil.generateId(containerNamesPrefix, containerNames, suite.isMocked);
      var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);
      var blobService = azure.createBlobService()
      .withFilter(new azure.ExponentialRetryPolicyFilter());

      blobService.createContainer(containerName, function (error) {
        assert.equal(error, null);

        blobService.createBlockBlobFromText(containerName, blobName, 'id1', function (error2) {
          assert.equal(error2, null);
   
          var startDate = new Date();
          var expiryDate = new Date(startDate);
          expiryDate.setMinutes(startDate.getMinutes() + 5);

          var sharedAccessPolicy = {
            AccessPolicy: {
              Permissions: BlobUtilities.SharedAccessPermissions.READ,
              Expiry: expiryDate
            }
          };

          var token = blobService.generateSharedAccessSignatureWithVersion(containerName, blobName, sharedAccessPolicy, CompatibleVersionConstants.FEBRUARY_2012);
          var sharedBlobService = azure.createBlobServiceWithSas(blobService.host, token);
      
          sharedBlobService.getBlobProperties(containerName, blobName, function (error, result) {
            assert.equal(error, null);
            assert.notEqual(result, null);

            blobService.deleteContainer(containerName, function (deleteError) {
              assert.equal(deleteError, null);
              done();
            });
          });
        });
      });
    });

    it(util.format('should NOT be able to download blob using specified SAS Version: %s', '2014-02-14'), function (done) {
      var containerName = testutil.generateId(containerNamesPrefix, containerNames, suite.isMocked);
      var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);
      var blobService = azure.createBlobService().withFilter(new azure.ExponentialRetryPolicyFilter());
      var sharedAccessPolicy = {
        AccessPolicy: {
          Permissions: BlobUtilities.SharedAccessPermissions.READ,
          Expiry: new Date()
        }
      };

      var unsupportedVersion = '2014-02-14';
      var values = _.values(CompatibleVersionConstants);
      var message = azureutil.stringFormat(SR.INVALID_SAS_VERSION, unsupportedVersion, values);
      assert.throws(function () { blobService.generateSharedAccessSignatureWithVersion(containerName, blobName, sharedAccessPolicy, unsupportedVersion); },
        function (err) { return err.message === message; });
      done();
    });

    it('should NOT be able to specify api-version in SAS', function (done) {
      var containerName = testutil.generateId(containerNamesPrefix, containerNames, suite.isMocked);
      var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);
      var blobService = azure.createBlobService().withFilter(new azure.ExponentialRetryPolicyFilter());
      var sharedAccessPolicy = {
        AccessPolicy: {
          Permissions: BlobUtilities.SharedAccessPermissions.READ,
          Expiry: new Date()
        }
      };

      var token = blobService.generateSharedAccessSignature(containerName, blobName, sharedAccessPolicy) + "?api-version=2014-02-14";
      var sharedAccessBlobService = azure.createBlobServiceWithSas(blobService.host, token);

      assert.throws( function () { sharedAccessBlobService.getBlobProperties(containerName, blobName, function () {}); },
        function (err) { return err.message === SR.INVALID_SAS_TOKEN; });
      done();
    });

    runOrSkip('should append api-version', function (done) {
      var containerName = testutil.generateId(containerNamesPrefix, containerNames, suite.isMocked);
      var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);
      var blobService = azure.createBlobService()
      .withFilter(new azure.ExponentialRetryPolicyFilter());

      blobService.createContainer(containerName, function (error) {
        assert.equal(error, null);

        blobService.createBlockBlobFromText(containerName, blobName, 'id1', function (error2) {
          assert.equal(error2, null);
    
          var startDate = new Date();
          var expiryDate = new Date(startDate);
          expiryDate.setMinutes(startDate.getMinutes() + 5);

          var sharedAccessPolicy = {
            AccessPolicy: {
              Permissions: BlobUtilities.SharedAccessPermissions.READ,
              Expiry: expiryDate
            }
          };

          var token = blobService.generateSharedAccessSignature(containerName, blobName, sharedAccessPolicy);

          var sharedAccessBlobService = azure.createBlobServiceWithSas(blobService.host, token);

          var callback = function(webResource) {
            var copy = extend(true, {}, webResource);
            sharedAccessBlobService.storageCredentials.signRequest(copy, function() {
              assert.notEqual(copy.uri.indexOf('api-version'), -1);
            });
          };

          sharedAccessBlobService.on('sendingRequestEvent', callback);

          sharedAccessBlobService.getBlobProperties(containerName, blobName, function (error, result) {
            assert.equal(error, null);
            assert.notEqual(result, null);
            sharedAccessBlobService.removeAllListeners();

            blobService.deleteContainer(containerName, function (deleteError) {
              assert.equal(deleteError, null);
              done();
            });
          });
        });
      });
    });
  
    describe('SasStrangeChars', function() {
      runOrSkip('SasStrangeCharsBlobName', function (done) {
        var containerName = testutil.generateId(containerNamesPrefix, containerNames, suite.isMocked);
        var blobName = 'def@#/abef?def/& &/abcde+=-';
        var blobService = azure.createBlobService().withFilter(new azure.ExponentialRetryPolicyFilter());
        var blobText = 'sampletext!';

        blobService.createContainer(containerName, function (error) {
          assert.equal(error, null);

          blobService.createBlockBlobFromText(containerName, blobName, blobText, function (error2) {
            assert.equal(error2, null);
      
            var startDate = new Date();
            var expiryDate = new Date(startDate);
            expiryDate.setMinutes(startDate.getMinutes() + 5);

            var sharedAccessPolicy = {
              AccessPolicy: {
                Permissions: BlobUtilities.SharedAccessPermissions.READ,
                Expiry: expiryDate
              }
            };

            var token = blobService.generateSharedAccessSignature(containerName, blobName, sharedAccessPolicy);

            var sharedAccessBlobService = azure.createBlobServiceWithSas(blobService.host, token);

            sharedAccessBlobService.getBlobToText(containerName, blobName, function (downloadErr, blobTextResponse) {
              assert.equal(downloadErr, null);
              assert.equal(blobTextResponse, blobText);

              done();
            });
          });
        });
      });

      describe('SasRootContainer', function() {
        var blobService;
        var containerName = '$root';
        var blobName = 'sampleBlobName';
        var blobText = 'sampletext!';

        before(function (done) {
          blobService = azure.createBlobService().withFilter(new azure.ExponentialRetryPolicyFilter());
          done();
        })

        // This is testing the root container functionality, which we don't want to pollute with random blobs.
        // Thus, trying to delete blob both before and after the actual test.
        describe('prepare the root container', function() {
          it('should work', function (done) {
            blobService.doesContainerExist(containerName, function (error, exist) {
              assert.equal(error, null);
              if (exist) {
                blobService.deleteBlobIfExists(containerName, blobName, function () { done(); });
              } else {
                blobService.createContainer(containerName, function () { done(); });
              }
            });
          });
        });

        runOrSkip('should work', function(done) {
          blobService.createBlockBlobFromText(containerName, blobName, blobText, function (error2) {
            assert.equal(error2, null);
      
            var startDate = new Date();
            var expiryDate = new Date(startDate);
            expiryDate.setMinutes(startDate.getMinutes() + 5);

            var sharedAccessPolicy = {
              AccessPolicy: {
                Permissions: BlobUtilities.SharedAccessPermissions.READ,
                Expiry: expiryDate
              }
            };

            var token = blobService.generateSharedAccessSignature(containerName, blobName, sharedAccessPolicy);

            var sharedAccessBlobService = azure.createBlobServiceWithSas(blobService.host, token);

            sharedAccessBlobService.getBlobToText(containerName, blobName, function (downloadErr, blobTextResponse) {
              assert.equal(downloadErr, null);
              assert.equal(blobTextResponse, blobText);

              done();
            });
          });
        });

        describe('cleanup the root container', function() {
          it('should work', function (done) {
            blobService.deleteBlobIfExists(containerName, blobName, function() {
              done();
            });
          });
        });
      });
    });
  });

  it('responseEmits', function (done) {
    var containerName = testutil.generateId(containerNamesPrefix, containerNames, suite.isMocked);
    var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);

    var responseReceived = false;
    blobService.on('receivedResponseEvent', function (response) {
      assert.notEqual(response, null);
      responseReceived = true;
      blobService.removeAllListeners('response');
    });

    blobService.createContainer(containerName, function (error) {
      assert.equal(error, null);

      blobService.createBlockFromText('id1', containerName, blobName, 'id1', function (error2) {
        assert.equal(error2, null);
        // By the time the complete callback is processed the response header callback must have been called before
        assert.equal(responseReceived, true);

        blobService.deleteContainer(containerName, function (deleteError) {
          assert.equal(deleteError, null);
          done();
        });
      });
    });
  });

  // Even the execution time is 1ms in this case, we need skip it in nock as it may receive response in less than 1ms when it is mocked.
  runOrSkip('maximumExecutionTime should work', function (done) {
    //set the maximum execution time.
    var options = {
      maximumExecutionTimeInMs: 1,
      locationMode: StorageUtilities.LocationMode.SECONDARY_THEN_PRIMARY
    };

    // 1. download attributes will fail as the container does not exist
    // 2. the executor will attempt to retry as it is accessing secondary
    // 3. maximum execution time should prevent the retry from being made
    blobService.getContainerProperties('nonexistentcontainer', options, function (err) { 
      assert.notEqual(err, null);
      assert.equal(err.message, SR.MAXIMUM_EXECUTION_TIMEOUT_EXCEPTION);
      done();
    });
  });

  runOrSkip('maximumExecutionTime should work while uploading big blobs', function (done) {
    var containerName = testutil.generateId(containerNamesPrefix, containerNames, suite.isMocked);
    var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);

    blob60MBuffer.fill(1);
    fs.writeFileSync(fileName, blob60MBuffer);

    var localOptions = {
      maximumExecutionTimeInMs: 100
    };

    blobService.createContainer(containerName, function (createError1, container1) {
      assert.equal(createError1, null);
      assert.notEqual(container1, null);
      blobService.createPageBlobFromLocalFile(containerName, blobName, fileName, localOptions, function (err) {
        assert.notEqual(err, null);
        assert.equal(err.message, SR.MAXIMUM_EXECUTION_TIMEOUT_EXCEPTION);

        blobService.deleteContainer(containerName, function (err) {
          try{ fs.unlinkSync(fileName); } catch (e) {}
          done();
        });
      });
    });
  });

  it('storageConnectionStrings', function (done) {
    var key = 'AhlzsbLRkjfwObuqff3xrhB2yWJNh1EMptmcmxFJ6fvPTVX3PZXwrG2YtYWf5DPMVgNsteKStM5iBLlknYFVoA==';
    var connectionString = 'DefaultEndpointsProtocol=https;AccountName=myaccount;AccountKey=' + key;
    var blobService = azure.createBlobService(connectionString);

    assert.equal(blobService.storageAccount, 'myaccount');
    assert.equal(blobService.storageAccessKey, key);
    assert.equal(blobService.host.primaryHost, 'https://myaccount.blob.core.windows.net:443/');

    done();
  });

  it('storageConnectionStringsDevStore', function (done) {
    var connectionString = 'UseDevelopmentStorage=true';
    var blobService = azure.createBlobService(connectionString);

    assert.equal(blobService.storageAccount, StorageServiceClientConstants.DEVSTORE_STORAGE_ACCOUNT);
    assert.equal(blobService.storageAccessKey, StorageServiceClientConstants.DEVSTORE_STORAGE_ACCESS_KEY);
    assert.equal(blobService.host.primaryHost, 'http://127.0.0.1:10000/devstoreaccount1');

    done();
  });
});

function repeat (s, n) {
  var ret = '';
  for (var i = 0; i < n; i++) {
    ret += s;
  }
  return ret;
}

function listContainers (prefix, options, token, callback) {
  blobService.listContainersSegmentedWithPrefix(prefix, token, options, function(error, result) {
    assert.equal(error, null);
    containers.push.apply(containers, result.entries);
    var token = result.continuationToken;
    if(token) {
      listContainers(prefix, options, token, callback);
    } else {
      callback();
    }
  });
}