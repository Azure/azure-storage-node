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
var util = require('util');
var crypto = require('crypto');

var fs = require('fs');
var path = require('path');
// Test includes
var testutil = require('../../framework/util');
var TestSuite = require('../../framework/test-suite');

// Lib includes
var azureutil = require('../../../lib/common/util/util');
if (testutil.isBrowser()) {
  var azure = AzureStorage.Blob;
} else {
  var azure = require('../../../');
}
var rfs = require('../../../lib/common/streams/readablefs');
var SR = azure.SR;
var Constants = azure.Constants;
var HttpConstants = Constants.HttpConstants;
var HeaderConstants = Constants.HeaderConstants;
var BlobUtilities = azure.BlobUtilities;

var blobService;
var containerNames = [];
var containerNamesPrefix = 'cont';
var blobNames = [];
var blobNamesPrefix = 'blob';
var containerNamePrefix = 'upload-download-test';
var blockIdPrefix = 'block';
var containerCount = 0;
var containerName = '';

var blockBlobName = 'blockblob_nodesdktest';
var pageBlobName = 'pageblob_nodesdktest';
var appendBlobName = 'appendblob_nodesdktest';

var blockFileName = 'blobservice_test_block.tmp';
var pageFileName = 'blobservice_test_page.tmp';
var page2KFileName = 'blobservice_test_2K_page.tmp';
var appendFileName = 'blobservice_test_append.tmp';
var append2KFileName = 'blobservice_test_2K_append.tmp';
var notExistFileName = 'blobservice_not_exist.tmp';
var zeroSizeFileName = 'blobservice_zero_size_file.tmp';
var downloadName = 'blobservice_download.tmp';

var fileText = 'Hello World!';

var pageBlobBuffer = new Buffer(1 * 1024);
var pageBlob2KBuffer = new Buffer(2 * 1024);
var appendBlobBuffer = new Buffer(1 * 1024);
var appendBlob2KBuffer = new Buffer(2 * 1024);

var pageBlobContentMD5 = '';
var pageBlob2KContentMD5 = '';
var blockBlobContentMD5 = null;
var appendBlobContentMD5 = '';
var appendBlob2KContentMD5 = '';

var uploadOptions = {
  blockIdPrefix: blockIdPrefix
};

var suite = new TestSuite('blobservice-uploaddownload-tests');
var runOrSkip = testutil.itSkipMock(suite.isMocked);
var skipBrowser = testutil.itSkipBrowser();
var skipMockAndBrowser = testutil.itSkipMockAndBrowser(suite.isMocked);

function getContentMD5(content) {
  var md5hash = crypto.createHash('md5');
  md5hash.update(content);
  return md5hash.digest('base64');
}

function writeFile(fileName, content) {
  fs.writeFileSync(fileName, content);
  return getContentMD5(content);
}

var generateTempFile = function (fileName, size, hasEmptyBlock, callback) {
  var blockSize = 4 * 1024 * 1024;
  var fileInfo = { name: fileName, contentMD5: '', size: size, content: '' };

  var md5hash = crypto.createHash('md5');
  var offset = 0;
  var file = fs.openSync(fileName, 'w');
  var saveContent = size <= blockSize;

  do {
    var value = crypto.randomBytes(1);
    var zero = hasEmptyBlock ? (parseInt(value[0], 10) >= 64) : false;
    var writeSize = Math.min(blockSize, size);
    var buffer;

    if (zero) {
      buffer = new Buffer(writeSize);
      buffer.fill(0);
    } else {
      buffer = crypto.randomBytes(writeSize);
    }

    fs.writeSync(file, buffer, 0, buffer.length, offset);
    size -= buffer.length;
    offset += buffer.length;
    md5hash.update(buffer);

    if (saveContent) {
      fileInfo.content += buffer.toString();
    }
  } while (size > 0);

  fileInfo.contentMD5 = md5hash.digest('base64');
  callback(fileInfo);
};

var getFileMD5 = function (fileName, callback) {
  var md5hash = crypto.createHash('md5');
  var blockSize = 4 * 1024 * 1024;
  var buffer = new Buffer(blockSize);
  var offset = 0;
  var bytesRead = 0;
  var file = fs.openSync(fileName, 'r');
  var fileInfo = { name: fileName, contentMD5: '' };
  do {
    bytesRead = fs.readSync(file, buffer, 0, buffer.length, offset);
    if (bytesRead > 0) {
      offset += bytesRead;
      if (blockSize == bytesRead) {
        md5hash.update(buffer);
      } else {
        md5hash.update(buffer.slice(0, bytesRead));
      }
    }
  } while (bytesRead > 0);

  fileInfo.contentMD5 = md5hash.digest('base64');
  callback(fileInfo);
};

var assertNoStalePropertyOnBlob = function (blob) {
  assert.notEqual(blob, null);
  assert.strictEqual(blob.lease, undefined);
  assert.strictEqual(blob.copy, undefined);
};

describe('blob-uploaddownload-tests', function () {
  before(function (done) {
    if (suite.isMocked) {
      testutil.POLL_REQUEST_INTERVAL = 0;
    }
    suite.setupSuite(function () {
      blobService = azure.createBlobService(process.env['AZURE_STORAGE_CONNECTION_STRING']).withFilter(new azure.ExponentialRetryPolicyFilter());
      //blobService.logger.level = azure.Logger.LogLevels.DEBUG;
      done();
    });
  });

  after(function (done) {
    try { fs.unlinkSync(blockFileName); } catch (e) { }
    try { fs.unlinkSync(pageFileName); } catch (e) { }
    try { fs.unlinkSync(page2KFileName); } catch (e) { }
    try { fs.unlinkSync(appendFileName); } catch (e) { }
    try { fs.unlinkSync(append2KFileName); } catch (e) { }
    try { fs.unlinkSync(notExistFileName); } catch (e) { }
    try { fs.unlinkSync(zeroSizeFileName); } catch (e) { }
    try { fs.unlinkSync(downloadName); } catch (e) { }
    suite.teardownSuite(done);
  });

  beforeEach(function (done) {
    containerName = testutil.generateId(containerNamesPrefix, containerNames, suite.isMocked);
    suite.setupTest(function () {
      blobService.createContainerIfNotExists(containerName, function (error) {
        assert.equal(error, null);
        done();
      });
    });
  });

  afterEach(function (done) {
    blobService.deleteContainerIfExists(containerName, function (error) {
      assert.equal(error, null);
      suite.teardownTest(done);
    });
  });

  it('CreateBlobWithBars', function (done) {
    var blobName = 'blobs/' + testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);
    var blobText = 'Hello World!';

    blobService.createBlockBlobFromText(containerName, blobName, blobText, function (err) {
      assert.equal(err, null);

      blobService.getBlobProperties(containerName, blobName, function (error, properties) {
        assert.equal(error, null);
        assert.equal(properties.container, containerName);
        assert.equal(properties.name, blobName);

        done();
      });
    });
  });

  it('CreateEmptyBlob', function (done) {
    var blobName = 'blobs/' + testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);

    // Create the empty block blob
    blobService.createBlockBlobFromText(containerName, blobName, null, function (err) {
      assert.equal(err, null);

      blobService.getBlobProperties(containerName, blobName, function (error, properties) {
        assert.equal(error, null);
        assert.equal(properties.container, containerName);
        assert.equal(properties.name, blobName);

        done();
      });
    });
  });

  it('createBlockBlobFromText with specified content type', function (done) {
    var blobName = 'blobs/' + testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);
    var blobText = '<html><h1>THIS IS HTML</h1></html>';
    var contentType = 'text/html';
    var options = {
      contentSettings: {
        contentType: contentType
      }
    };

    blobService.createBlockBlobFromText(containerName, blobName, blobText, options, function (err) {
      assert.equal(err, null);

      blobService.getBlobProperties(containerName, blobName, function (error, properties) {
        assert.equal(error, null);
        assert.equal(properties.container, containerName);
        assert.equal(properties.name, blobName);
        assert.equal(properties.contentSettings.contentType, contentType);

        done();
      });
    });
  });
  
  // This test ensures that blocks can be created from files correctly
  // and was created to ensure that the request module does not magically add
  // a content type to the request when the user did not specify one.
  skipBrowser('works with files without specifying content type', function (done) {
    fs.writeFileSync(blockFileName, fileText);

    var callback = function (webresource) {
      assert.notEqual(webresource.headers[HeaderConstants.CONTENT_MD5], null);
    };

    blobService.on('sendingRequestEvent', callback);

    blobService.createBlockFromStream('test', containerName, blockBlobName, rfs.createReadStream(blockFileName), fileText.length, {useTransactionalMD5: true}, function (error) {
      assert.equal(error, null);
      blobService.removeAllListeners('sendingRequestEvent');

      done();
    });
  });
  
  skipBrowser('returns correct error when specifying invalid content-length', function (done) {
    blobService.createBlockFromStream('test', containerName, blockBlobName, rfs.createReadStream(blockFileName), 'invalidlength', function (error) {
      assert.ok(error.message.indexOf('invalid content length') !== -1);
      done();
    });
  });
  
  describe('blob-piping-tests', function() {
    skipMockAndBrowser('should be able to upload block blob from piped stream', function (done) { 
      var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);
      var fileNameTarget = testutil.generateId('uploadBlockBlobPiping', [], suite.isMocked) + '.blocktest';
      var blobBuffer = new Buffer( 6 * 1024 * 1024);
      blobBuffer.fill(1);

      // Write file so that it can be piped
      fs.writeFileSync(fileNameTarget, blobBuffer);
      
      // Pipe file to a blob
      var stream = rfs.createReadStream(fileNameTarget).pipe(blobService.createWriteStreamToBlockBlob(containerName, blobName, { blockIdPrefix: 'block' }));
      stream.on('close', function () {
        blobService.getBlobToText(containerName, blobName, function (err, text) {
          assert.equal(err, null);

          assert.equal(text, blobBuffer);

          try { fs.unlinkSync(fileNameTarget); } catch (e) {}

          done();
        });
      });
    });

    skipMockAndBrowser('should be able to upload block blob from piped stream with IfNoneMatch:*', function (done) { 
      var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);
      var fileNameTarget = testutil.generateId('uploadBlockBlobPiping', [], suite.isMocked) + '.blocktest';
      var blobBuffer = new Buffer( 6 * 1024 * 1024);
      blobBuffer.fill(1);

      // Write file so that it can be piped
      fs.writeFileSync(fileNameTarget, blobBuffer);
      
      // Pipe file to a blob
      var stream = rfs.createReadStream(fileNameTarget).pipe(blobService.createWriteStreamToBlockBlob(containerName, blobName, { blockIdPrefix: 'block', accessConditions: azure.AccessCondition.generateIfNotExistsCondition() }));
      stream.on('close', function () {
        blobService.getBlobToText(containerName, blobName, function (err, text) {
          assert.equal(err, null);

          assert.equal(text, blobBuffer);

          try { fs.unlinkSync(fileNameTarget); } catch (e) {}

          done();
        });
      });
    });
  
    skipMockAndBrowser('should be able to upload pageblob from piped stream', function (done) {
      var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);
      var fileNameTarget = testutil.generateId('uploadPageBlobPiping', [], suite.isMocked) + '.test';
      var blobBuffer = new Buffer( 5 * 1024 * 1024 );
      blobBuffer.fill(1);

      // Write file so that it can be piped
      fs.writeFile(fileNameTarget, blobBuffer, function() {
        blobService.createPageBlob(containerName, blobName, 5 * 1024 * 1024, function (err) {
          assert.equal(err, null);
          // Pipe file to a blob
          var stream = blobService.createWriteStreamToExistingPageBlob(containerName, blobName);
          var readable = rfs.createReadStream(fileNameTarget);
          readable.pipe(stream);
          stream.on('close', function () {
            blobService.getBlobToText(containerName, blobName, function (err, text) {
              assert.equal(err, null);

              assert.equal(text, blobBuffer);

              try { fs.unlinkSync(fileNameTarget); } catch (e) {}
              done();
            });
          });
        });
      });
    });

    skipMockAndBrowser('should be able to upload a pageblob from piped stream and store the MD5 on the server', function (done) {
      containerName = testutil.generateId(containerNamesPrefix, containerNames, suite.isMocked);
      var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);
      var fileNameTarget = testutil.generateId('uploadPageBlobMD5Piping', [], suite.isMocked) + '.test';
      var length = 3 * 1024 * 1024;
      var blobBuffer = new Buffer(length);
      blobBuffer.fill(1);

      blobService.createContainer(containerName, function (createError1, container1) {
        assert.equal(createError1, null);
        assert.notEqual(container1, null);

        // Write file so that it can be piped
        pageBlobContentMD5 = writeFile(fileNameTarget, blobBuffer);

        // Pipe file to a blob
        var stream = blobService.createWriteStreamToNewPageBlob(containerName, blobName, length, {storeBlobContentMD5: true});
        var readable = rfs.createReadStream(fileNameTarget);
        readable.pipe(stream);
        stream.on('close', function () {
          blobService.getBlobProperties(containerName, blobName, function (err, blob) {
            assert.equal(err, null);
            assert.equal(blob.contentSettings.contentMD5, pageBlobContentMD5);

            try { fs.unlinkSync(fileNameTarget); } catch (e) {}
            done();
          });
        });
      });
    });

    skipMockAndBrowser('should be able to upload an appendblob from piped stream', function (done) {
      containerName = testutil.generateId(containerNamesPrefix, containerNames, suite.isMocked);
      var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);
      var fileNameTarget = testutil.generateId('uploadAppendBlobMD5Piping', [], suite.isMocked) + '.test';
      var length = 3 * 1024 * 1024;
      var blobBuffer = new Buffer(length);
      blobBuffer.fill(1);

      // Write file so that it can be piped
      writeFile(fileNameTarget, blobBuffer);
      
      blobService.createContainer(containerName, function (createError1, container1) {
        assert.equal(createError1, null);
        assert.notEqual(container1, null);
        
        blobService.createOrReplaceAppendBlob(containerName, blobName, length, function (err) {
          assert.equal(err, null);
          
          assert.throws(function () { 
            blobService.createWriteStreamToExistingAppendBlob(containerName, blobName, { storeBlobContentMD5: true });
          }, function(err) {
            return (err instanceof Error) && err.message === SR.MD5_NOT_POSSIBLE;
          });

          // Pipe file to a blob
          var stream = blobService.createWriteStreamToExistingAppendBlob(containerName, blobName, { storeBlobContentMD5: false });
          rfs.createReadStream(fileNameTarget).pipe(stream);

          stream.on('close', function () {
            blobService.getBlobProperties(containerName, blobName, function (err, blob) {
              assert.equal(err, null);
              assert.equal(blob.contentLength, length);
              assert.equal(blob.blobType, 'AppendBlob');
              
              try { fs.unlinkSync(fileNameTarget); } catch (e) { }
              done();
            });
          });
        });
      });
    });

    skipMockAndBrowser('should be able to upload new page blob from piped stream', function (done) {
      var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);
      var fileNameTarget = testutil.generateId('uploadPageBlobStreamPiping', [], suite.isMocked) + '.test';
      var length = 6 * 1024 * 1024;
      var blobBuffer = new Buffer(length);
      blobBuffer.fill(1);

      // Write file so that it can be piped
      fs.writeFile(fileNameTarget, blobBuffer, function() {
        // Pipe file to a blob
        var stream = blobService.createWriteStreamToNewPageBlob(containerName, blobName, length);
        var readable = rfs.createReadStream(fileNameTarget);
        readable.pipe(stream);
        stream.on('close', function () {
          blobService.getBlobToText(containerName, blobName, function (err, text) {
            assert.equal(err, null);
            assert.equal(text, blobBuffer);
            try { fs.unlinkSync(fileNameTarget); } catch (e) { }
            done();
          });
        });
      });
    });

    skipMockAndBrowser('should be able to download blob to piped stream', function (done) {
      var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);
      var sourceFileNameTarget = testutil.generateId('getBlobSourceFile', [], suite.isMocked) + '.test';
      var destinationFileNameTarget = testutil.generateId('getBlobDestinationFile', [], suite.isMocked) + '.test';
      var length = 5 * 1024;
      var blobBuffer = new Buffer(length);
      blobBuffer.fill(1);

      fs.writeFileSync(sourceFileNameTarget, blobBuffer);

      blobService.createPageBlobFromStream(containerName, blobName, rfs.createReadStream(sourceFileNameTarget), length, function(uploadError) {
        assert.equal(uploadError, null);
        var writable = fs.createWriteStream(destinationFileNameTarget);
        blobService.createReadStream(containerName, blobName).pipe(writable);

        writable.on('close', function () {
          var exists = fs.existsSync(destinationFileNameTarget);
          assert.equal(exists, true);

          fs.readFile(destinationFileNameTarget, function (err, destFileText) {
            fs.readFile(sourceFileNameTarget, function (err, srcFileText) {
              assert.deepEqual(destFileText, srcFileText);

              try { fs.unlinkSync(sourceFileNameTarget); } catch (e) {}
              try { fs.unlinkSync(destinationFileNameTarget); } catch (e) {}

              done();
            });
          });
        });
      });
    });

    skipMockAndBrowser('should be able to download blob snapshot to stream', function (done) {
      var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);
      var sourceFileNameTarget = testutil.generateId('getBlobSourceFile', [], suite.isMocked) + '.test';
      var destinationFileNameTarget = testutil.generateId('getBlobDestinationFile', [], suite.isMocked) + '.test';
      var length = 33 * 1024 * 1024;
      var blobBuffer = new Buffer(length);
      blobBuffer.fill(1);

      fs.writeFileSync(sourceFileNameTarget, blobBuffer);

      blobService.createPageBlobFromStream(containerName, blobName, rfs.createReadStream(sourceFileNameTarget), length, function (uploadError) {
        assert.equal(uploadError, null);

        blobService.createBlobSnapshot(containerName, blobName, function (err, snapshotID) {
          assert.equal(err, null);

          blobService.clearPageRange(containerName, blobName, 0, length - 1, function (err) {
            assert.equal(err, null);

            var writable = fs.createWriteStream(destinationFileNameTarget);
            blobService.getBlobToStream(containerName, blobName, writable, {snapshotId: snapshotID}, function(err) {
              assert.equal(err, null);

              var exists = fs.existsSync(destinationFileNameTarget);
              assert.equal(exists, true);

              fs.readFile(destinationFileNameTarget, function (err, destFileText) {
                fs.readFile(sourceFileNameTarget, function (err, srcFileText) {
                  assert.deepEqual(destFileText, srcFileText);
    
                  try { fs.unlinkSync(sourceFileNameTarget); } catch (e) {}
                  try { fs.unlinkSync(destinationFileNameTarget); } catch (e) {}
    
                  done();
                });
              });
            });
          });
        });
      });
    });
    
    skipBrowser('should emit error events when using piped streams', function (done) {
      var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);
      var fileNameTarget = testutil.generateId('streamErrorPiping', [], suite.isMocked) + '.test';

      var stream = blobService.createReadStream(containerName, blobName);
      stream.on('error', function (error) {
        assert.equal(error.code, 'NotFound');
        assert.equal(error.statusCode, '404');
        assert.notEqual(error.requestId, null);

        try { fs.unlinkSync(fileNameTarget); } catch (e) {}

        done();
      });

      stream.pipe(fs.createWriteStream(fileNameTarget));
    });

    skipMockAndBrowser('error message should NOT be written to the piped stream when downloading blob', function (done) {
      var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);
      var downloadedFileName = testutil.generateId('getBlobToStream', [], suite.isMocked) + '.test';
      var stream = fs.createWriteStream(downloadedFileName);
      blobService.getBlobToStream(containerName, blobName, stream, {skipSizeCheck: true}, function (error) {
        var content = fs.readFileSync(downloadedFileName);
        assert.equal(content.length, 0);
        done();
      });
    });
  });
  
  describe('blob-rangedownload-tests', function() {
    skipBrowser('getBlobRange', function (done) {
      var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);
      var data1 = 'Hello, World!';

      // Create the empty page blob
      blobService.createBlockBlobFromText(containerName, blobName, data1, function (err) {
        assert.equal(err, null);

        // Browser will fail when enabling useTransactionlMD5, because like Chrome refuses to access to content-md5 header when using xhr.getAllResponseHeaders()
        blobService.getBlobToText(containerName, blobName, { rangeStart: 2, rangeEnd: 3, useTransactionalMD5: true }, function (err3, content1, result) {
          assert.equal(err3, null);
          assert.notEqual(result.contentSettings.contentMD5, null);

          // get the double ll's in the hello
          assert.equal(content1, 'll');

          done();
        });
      });
    });

    it('getBlobRangeOpenEnded', function (done) {
      var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);
      var data1 = 'Hello, World!';

      // Create the empty page blob
      blobService.createBlockBlobFromText(containerName, blobName, data1, function (err) {
        assert.equal(err, null);

        blobService.getBlobToText(containerName, blobName, { rangeStart: 2 }, function (err3, content1, result) {
          assert.equal(err3, null);
          assert.notEqual(result.contentSettings.contentMD5, null);

          // get the last bytes from the message
          assert.equal(content1, 'llo, World!');

          done();
        });
      });
    });

    skipBrowser('getPageRanges', function (done) {
      var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);
      var fileNameSource = testutil.generateId('getPageRanges', [], suite.isMocked) + '.test';

      var blobBuffer = new Buffer(512);
      blobBuffer.fill(0);
      blobBuffer[0] = '1';

      // Upload contents in 2 parts
      blobService.createPageBlob(containerName, blobName, 1024 * 1024 * 1024, function (err) {
        assert.equal(err, null);

        fs.writeFile(fileNameSource, blobBuffer, function () {

          var callback = function (webresource) {
            assert.notEqual(webresource.headers[HeaderConstants.CONTENT_MD5], null);
          };

          blobService.on('sendingRequestEvent', callback);
          blobService.createPagesFromStream(containerName, blobName, rfs.createReadStream(fileNameSource), 0, 511, {useTransactionalMD5: true}, function(err2) {
            // Upload all data
            assert.equal(err2, null);
            blobService.removeAllListeners('sendingRequestEvent');

            // Only one range present
            blobService.listPageRanges(containerName, blobName, function (error, ranges) {
              assert.equal(error, null);
              assert.notEqual(ranges, null);
              if (ranges) {
                assert.equal(ranges.length, 1);

                var entries = 0;
                ranges.forEach(function (range) {
                  if (range.start === 0) {
                    assert.equal(range.end, 511);
                    entries += 1;
                  }
                });

                assert.equal(entries, 1);
              }

              blobService.on('sendingRequestEvent', callback);

              blobService.createPagesFromStream(containerName, blobName, rfs.createReadStream(fileNameSource), 1048576, 1049087, {transactionalContentMD5: azureutil.getContentMd5(blobBuffer)}, function (err3) {
                assert.equal(err3, null);

                blobService.removeAllListeners('sendingRequestEvent');

                // Get page ranges
                blobService.listPageRanges(containerName, blobName, function (error5, ranges) {
                  assert.equal(error5, null);
                  assert.notEqual(ranges, null);
                  if (ranges) {
                    assert.equal(ranges.length, 2);

                    var entries = 0;
                    ranges.forEach(function (range) {
                      if (range.start === 0) {
                        assert.equal(range.end, 511);
                        entries += 1;
                      }
                      else if (range.start === 1048576) {
                        assert.equal(range.end, 1049087);
                        entries += 2;
                      }
                    });

                    assert.equal(entries, 3);
                  }
                  
                  blobService.getBlobToLocalFile(containerName, blobName, fileNameSource, function (error) {
                    assert.equal(error, null);
                    try { fs.unlinkSync(fileNameSource); } catch (e) { }
                    done();
                  });
                });
              });
            });
          });
        });
      });
    });

    skipBrowser('getPageRangesDiff should works', function(done) {
      var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);
      var fileNameSource = testutil.generateId('getPageRangesDiff', [], suite.isMocked) + '.test';
      var fileNameSourceUpdated = testutil.generateId('getPageRangesDiffUpdated', [], suite.isMocked) + '.test';

      var blobBuffer = new Buffer(512);
      blobBuffer.fill(0);
      blobBuffer[0] = '1';
      blobBuffer[1] = '1';

      var blobBufferUpdated = new Buffer(512);
      blobBufferUpdated.fill(0);
      blobBufferUpdated[0] = '1';
      blobBufferUpdated[1] = '1';
      blobBufferUpdated[3] = '1';

      // Upload contents in 2 parts
      blobService.createPageBlob(containerName, blobName, 1024 * 1024 * 1024, function (err) {
        assert.equal(err, null);

        fs.writeFile(fileNameSource, blobBuffer, function () {
          // Create 1st range
          blobService.createPagesFromStream(containerName, blobName, rfs.createReadStream(fileNameSource), 0, 511, {useTransactionalMD5: true}, function(err) {
            assert.equal(err, null);
            // Create 2nd range
            blobService.createPagesFromStream(containerName, blobName, rfs.createReadStream(fileNameSource), 1048576, 1049087, {transactionalContentMD5: azureutil.getContentMd5(blobBuffer)}, function (err) {
              assert.equal(err, null);
              // Snapshot the page blob
              blobService.createBlobSnapshot(containerName, blobName, function(err, snapshotTime) {
                assert.equal(err, null);
                var prevSnapshot = snapshotTime;

                // After the snapshot, update 1 range and clear 1 range
                fs.writeFile(fileNameSourceUpdated, blobBuffer, function () {
                  // Update the 1st range
                  blobService.createPagesFromStream(containerName, blobName, rfs.createReadStream(fileNameSourceUpdated), 0, 511, {useTransactionalMD5: true}, function(err) {
                    assert.equal(err, null);
                    // Clear the 2nd range
                    blobService.clearPageRange(containerName, blobName, 1048576, 1049087, function(err) {

                      assert.equal(err, null);
                      // Get the ranges diff
                      blobService.getPageRangesDiff(containerName, blobName, prevSnapshot, function(err, rangesDiff) {
                        assert.equal(err, null);
                        assert.equal(rangesDiff.length, 2);

                        rangesDiff.forEach(function (rangeDiff) {
                          if (rangeDiff.start === 0) {
                            assert.equal(rangeDiff.end, 511);
                            assert.equal(rangeDiff.isCleared, false);
                          } else if (rangeDiff.start === 1048576) {
                            assert.equal(rangeDiff.end, 1049087);
                            assert.equal(rangeDiff.isCleared, true);
                          }
                        });

                        try { fs.unlinkSync(fileNameSource); } catch (e) { }
                        try { fs.unlinkSync(fileNameSourceUpdated); } catch (e) { }
                        done();
                      });
                    })
                  });
                });
              });
            });
          });
        });
      });
    });

    skipMockAndBrowser('should download a range of block blob to stream', function (done) {
      var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);
      var fileNameSource = testutil.generateId('getBlockBlobRangeStreamLocal', [], suite.isMocked) + '.test';
      var fileSize = 97 * 1024 * 1024;  // Don't be a multiple of 4MB to cover more scenarios
      generateTempFile(fileNameSource, fileSize, false, function (fileInfo) {
        uploadOptions.parallelOperationThreadCount = 5;
        uploadOptions.storeBlobContentMD5 = true;
        blobService.createBlockBlobFromLocalFile(containerName, blobName, fileNameSource, uploadOptions, function (error) {
          assert.equal(error, null);
          try { fs.unlinkSync(fileNameSource); } catch (e) { }
          
          var downloadOptions = { parallelOperationThreadCount : 5, rangeStart: 100, rangeEnd: 70000000, useTransactionalMD5: true };
          var downloadedFileName = testutil.generateId('getBlockBlobRangeStream', [], suite.isMocked) + '.test';
          var stream = fs.createWriteStream(downloadedFileName);
          blobService.getBlobToStream(containerName, blobName, stream, downloadOptions, function (error, result) {
            assert.equal(error, null);
            assert.notEqual(result.contentSettings.contentMD5, null);
            
            var content = fs.readFileSync(downloadedFileName);
            assert.equal(content.length, downloadOptions.rangeEnd - downloadOptions.rangeStart + 1);
            delete content;
            try { fs.unlinkSync(downloadedFileName); } catch (e) { }
            done();
          });
        });
      });
    });
  });
  
  describe('CreateBlock', function() {
    skipBrowser('createBlockFromStream should work without useTransactionalMD5', function(done) {
      var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);
      var fileName = testutil.generateId('prefix', null, suite.isMocked) + '.txt';
      var blobText = 'Hello World!';
      try { fs.unlinkSync(fileName); } catch (e) {}
      fs.writeFileSync(fileName, blobText);
      var stat = fs.statSync(fileName);

      blobService.createBlockFromStream('blockid1', containerName, blobName, rfs.createReadStream(fileName), stat.size, function (error2) {
        assert.equal(error2, null);
        try { fs.unlinkSync(fileName); } catch (e) {}
        done();
      });
    });

    it('createBlockFromText should work with useTransactionalMD5', function(done) {
      var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);
      var blobText = 'Hello World!';

      var callback = function (webresource) {
        assert.notEqual(webresource.headers[HeaderConstants.CONTENT_MD5], null);
      };

      blobService.on('sendingRequestEvent', callback);

      blobService.createBlockFromText('blockid1', containerName, blobName, blobText, {useTransactionalMD5: true}, function (error2) {
        assert.equal(error2, null);
        blobService.removeAllListeners('sendingRequestEvent');

        done();
      });
    });

    skipBrowser('CommitBlockList', function (done) {
      var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);

      blobService.createBlockFromText('id1', containerName, blobName, 'id1', function (error2) {
        assert.equal(error2, null);

        blobService.createBlockFromText('id2', containerName, blobName, 'id2', function (error3) {
          assert.equal(error3, null);

          var blockList = {
            LatestBlocks: ['id1'],
            UncommittedBlocks: ['id2']
          };

          blobService.commitBlocks(containerName, blobName, blockList, function (error4, blob) {
            assert.equal(error4, null);
            assert.equal(blob.container, containerName);
            assert.equal(blob.name, blobName);
            assert.deepEqual(blob.list, blockList);
            assert.notEqual(blob.etag, null);
            assert.notEqual(blob.lastModified, null);
            assert.notEqual(blob.contentSettings.contentMD5, null);

            blobService.listBlocks(containerName, blobName, BlobUtilities.BlockListFilter.ALL, function (error5, list) {
              assert.equal(error5, null);
              assert.notEqual(list, null);
              assert.notEqual(list.CommittedBlocks, null);
              assert.equal(list.CommittedBlocks.length, 2);
              
              var fileNameSource = testutil.generateId('CommitBlockList', [], suite.isMocked) + '.test';
              blobService.getBlobToLocalFile(containerName, blobName, fileNameSource, function (error) {
                assert.equal(error, null);
                try { fs.unlinkSync(fileNameSource); } catch (e) { }
                done();
              });
            });
          });
        });
      });
    });

    it('should work with a single block', function (done) {
      var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);

      blobService.createBlockFromText('id1', containerName, blobName, 'id1', function (error2) {
        assert.equal(error2, null);

        blobService.createBlockFromText('id2', containerName, blobName, 'id2', function (error3) {
          assert.equal(error3, null);

          var blockList = {
            LatestBlocks: ['id1'],
          };

          blobService.commitBlocks(containerName, blobName, blockList, function (error4, blob) {
            assert.equal(error4, null);
            assert.equal(blob.container, containerName);
            assert.equal(blob.name, blobName);
            assert.deepEqual(blob.list, blockList);
            assert.notEqual(blob.etag, null);
            assert.notEqual(blob.lastModified, null);
            assert.notEqual(blob.contentSettings.contentMD5, null);

            blobService.listBlocks(containerName, blobName, BlobUtilities.BlockListFilter.ALL, function (error5, list) {
              assert.equal(error5, null);
              assert.notEqual(list, null);
              assert.notEqual(list.CommittedBlocks, null);
              assert.equal(list.CommittedBlocks.length, 1);

              blobService.createBlockFromText('id3', containerName, blobName, 'id3', function (error6) {
                assert.equal(error6, null);
                blobService.listBlocks(containerName, blobName, BlobUtilities.BlockListFilter.ALL, function (error7, list) {
                  assert.equal(error7, null);
                  assert.notEqual(list, null);
                  assert.notEqual(list.CommittedBlocks, null);
                  assert.notEqual(list.UncommittedBlocks, null);
                  assert.equal(list.CommittedBlocks.length, 1);
                  assert.equal(list.UncommittedBlocks.length, 1);
                  done();
                });
              });
            });
          });
        });
      });
    });

    it('createBlockFromUrl should work', function(done) {
      var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);
      var destBlobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);
      var blobText = 'Hello World!';

      blobService.createBlockBlobFromText(containerName, blobName, blobText, function (err, res) {
        assert.equal(err, null);

        var expiryDate = new Date();
        expiryDate.setHours(expiryDate.getHours() + 1);
        var sas = blobService.generateSharedAccessSignature(containerName, blobName, {AccessPolicy: {Permissions: 'r', Expiry: expiryDate}});

        blobService.createBlockFromURL('MDE=', containerName, destBlobName, blobService.getUrl(containerName, blobName, sas), 0, 4, function (err, res) {
          assert.equal(err, null);

          blobService.listBlocks(containerName, destBlobName, 'all', function (err, res) {
            assert.equal(err, null);
            assert.equal(res.UncommittedBlocks.length, 1);
            assert.equal(res.UncommittedBlocks[0].Name, 'MDE=');
            assert.equal(res.UncommittedBlocks[0].Size, 5);

            blobService.commitBlocks(containerName, destBlobName, {LatestBlocks: ['MDE=']}, function (err, res) {
              assert.equal(err, null);

              blobService.getBlobToText(containerName, destBlobName, function (err, text) {
                assert.equal(err, null);
                assert.equal(blobText.substr(0, 5), text);
                done();
              });
            });
          });
        });
      });
    });

  });
  
  describe('AppendBlock', function() {
    var appendText = 'stringappendtoblob';

    it('should append a block to the append blob from a text', function (done) {
      blobService.createOrReplaceAppendBlob(containerName, appendBlobName, function (err, blob) {
        assert.equal(err, null);
        
        var textMD5 = getContentMD5(appendText);
        var appendOption = {storeBlobContentMD5: true, useTransactionalMD5: true};
        blobService.appendBlockFromText(containerName, appendBlobName, appendText, appendOption, function(err, blob) {
          assert.equal(err, null);
          assert.equal(blob.contentSettings.contentMD5, textMD5);

          blobService.getBlobToText(containerName, appendBlobName, function (err, blobText) {
            assert.equal(err, null);
            assert.equal(blobText, appendText);
            done();
          });
        });
      });
    });

    skipBrowser('should append a block to the append blob from a stream', function (done) {
      blobService.createOrReplaceAppendBlob(containerName, appendBlobName, function (err, blob) {
        assert.equal(err, null);

        var streamMD5 = writeFile(appendFileName, appendText);
        var stream = rfs.createReadStream(appendFileName);
        var appendOption = {storeBlobContentMD5: true, useTransactionalMD5: true};
        blobService.appendBlockFromStream(containerName, appendBlobName, stream, appendText.length, appendOption, function(err, blob) {
          assert.equal(err, null);
          assert.equal(blob.contentSettings.contentMD5, streamMD5);

          blobService.getBlobToText(containerName, appendBlobName, function (err, blobText) {
            assert.equal(err, null);
            assert.equal(blobText, appendText);
            done();
          });
        });
      });
    });

    skipBrowser('should append a block to the append blob with conditions', function (done) {
      blobService.createOrReplaceAppendBlob(containerName, appendBlobName, function (err, blob) {
        assert.equal(err, null);

        var stream = rfs.createReadStream(appendFileName);
        var appendOption = { appendPosition: 0 };
        blobService.appendBlockFromStream(containerName, appendBlobName, stream, appendText.length, appendOption, function(err, blob) {
          assert.equal(err, null);

          appendOption.appendPosition += appendText.length;
          blobService.appendBlockFromText(containerName, appendBlobName, appendText, appendOption, function(err, blob) {
            assert.equal(err, null);

            appendOption.appendPosition += appendText.length;
            appendOption.maxBlobSize = appendText.length * 2; 
            blobService.appendBlockFromText(containerName, appendBlobName, 'a', appendOption, function(err, blob) {
              var errorKeyword = 'The max blob size condition specified was not met';
              assert.notEqual(err, null);
              assert.equal(err.statusCode, 412);
              assert.notEqual(err.message.indexOf(errorKeyword), -1);

              blobService.getBlobToText(containerName, appendBlobName, function (err, blobText) {
                assert.equal(err, null);
                assert.equal(blobText, appendText + appendText);
                done();
              });
            });
          });
        });
      });
    });    

    it('should throw conditional error when appends a block from a wrong position', function (done) {
      blobService.createOrReplaceAppendBlob(containerName, appendBlobName, function (err, blob) {
        assert.equal(err, null);

        var appendOption = {appendPosition: 1};
        blobService.appendBlockFromText(containerName, appendBlobName, appendText, appendOption, function(err, blob) {
          assert.equal(err.statusCode, 412);
          done();
        });
      });
    });

    it('should throw conditional error when appends a block exceeding the maximun blob size', function (done) {
      blobService.createOrReplaceAppendBlob(containerName, appendBlobName, function (err, blob) {
        assert.equal(err, null);

        var appendOption = {maxBlobSize: appendText.length - 1};
        blobService.appendBlockFromText(containerName, appendBlobName, appendText, appendOption, function(err, blob) {
          var errorKeyword = 'The max blob size condition specified was not met';
          assert.notEqual(err, null);
          assert.equal(err.statusCode, 412);
          assert.notEqual(err.message.indexOf(errorKeyword), -1);
          done();
        });
      });
    });
  });
   
  describe('blob-MD5Validation-tests', function() {
    skipMockAndBrowser('Upload/Download with MD5 validation should work', function (done) {
      var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);
      var fileNameSource = testutil.generateId('MD5Validation', [], suite.isMocked) + '.test';

      var blobBuffer = new Buffer(5 * 1024 * 1024);
      blobBuffer.fill(0);
      blobBuffer[0] = '1';

      fs.writeFile(fileNameSource, blobBuffer, function () {

        var blobOptions = { contentSettings: {contentType: 'text'}, blockIdPrefix : 'blockId'};
        blobService.createBlockBlobFromLocalFile(containerName, blobName, fileNameSource, blobOptions, function (uploadError, blobResponse, uploadResponse) {
          assert.equal(uploadError, null);
          assert.notEqual(blobResponse, null);
          assert.ok(uploadResponse.isSuccessful);

          // Set disableContentMD5Validation to false explicitly.
          blobService.getBlobToStream(containerName, blobName, fs.createWriteStream('task1-download.txt'), { disableContentMD5Validation: false }, function (downloadErr, downloadResult) {
            assert.equal(downloadErr, null);
            assert.strictEqual(downloadResult.contentSettings.contentMD5, 'ndpxhuSh0PPmMvK74fkYvg==');

            // Don't set disableContentMD5Validation explicitly. Since this is a block blob, the response will still contain the Content-MD5.
            blobService.getBlobToStream(containerName, blobName, fs.createWriteStream('task2-download.txt'), function (downloadErr, downloadResult) {
              assert.equal(downloadErr, null);
              assert.strictEqual(downloadResult.contentSettings.contentMD5, 'ndpxhuSh0PPmMvK74fkYvg==');

              blobService.getBlobProperties(containerName, blobName, function (getBlobPropertiesErr, blobGetResponse) {
                assert.equal(getBlobPropertiesErr, null);
                assert.notEqual(blobGetResponse, null);
                if (blobGetResponse) {
                  assert.equal(blobOptions.contentSettings.contentType, blobGetResponse.contentSettings.contentType);
                }

                try { fs.unlinkSync(fileNameSource); } catch (e) {}
                try { fs.unlinkSync('task1-download.txt'); } catch (e) {}
                try { fs.unlinkSync('task2-download.txt'); } catch (e) {}

                done();
              });
            });
          });
        });
      });
    });

    skipMockAndBrowser('BlockBlobDownloadWithAndWithoutMD5Validation', function (done) {
      var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);
      var fileNameSource = testutil.generateId('getBlockBlobFileMD5', [], suite.isMocked) + '.test';

      var blobBuffer = new Buffer(5 * 1024 * 1024);
      blobBuffer.fill(0);
      blobBuffer[0] = '1';

      fs.writeFile(fileNameSource, blobBuffer, function () {

        var blobOptions = { contentType: 'text', blockIdPrefix : 'blockId'};
        blobService.createBlockBlobFromLocalFile(containerName, blobName, fileNameSource, blobOptions, function (uploadError, blobResponse, uploadResponse) {
          assert.equal(uploadError, null);
          assert.notEqual(blobResponse, null);
          assert.ok(uploadResponse.isSuccessful);

          blobService.getBlobProperties(containerName, blobName, function (getBlobPropertiesErr) {
            assert.equal(getBlobPropertiesErr, null);

            var properties = {contentMD5: 'MDAwMDAwMDA='};
            blobService.setBlobProperties(containerName, blobName, properties, function (setBlobPropertiesErr) {
              assert.equal(setBlobPropertiesErr, null);

              blobService.getBlobToStream(containerName, blobName, fs.createWriteStream('task1-download.txt'), { disableContentMD5Validation: false }, function (downloadErr) {
                assert.notEqual(downloadErr, null);
                assert.equal(downloadErr.message, util.format(SR.HASH_MISMATCH, 'MDAwMDAwMDA=', 'ndpxhuSh0PPmMvK74fkYvg=='));

                blobService.getBlobToStream(containerName, blobName, fs.createWriteStream('task2-download.txt'), function (downloadErr2) {
                  assert.notEqual(downloadErr2, null);
                  assert.equal(downloadErr2.message, util.format(SR.HASH_MISMATCH, 'MDAwMDAwMDA=', 'ndpxhuSh0PPmMvK74fkYvg=='));

                  blobService.getBlobToStream(containerName, blobName, fs.createWriteStream('task3-download.txt'), { disableContentMD5Validation: true }, function (downloadErr3) {
                    assert.equal(downloadErr3, null);
                    try { fs.unlinkSync(fileNameSource); } catch (e) {}
                    try { fs.unlinkSync('task3-download.txt'); } catch (e) {}

                    done();
                  });
                });
              });
            });
          });
        });
      });
    });
    
    skipMockAndBrowser('PageBlobDownloadWithAndWithoutMD5Validation', function (done) {
      var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);
      var fileNameSource = testutil.generateId('getPageBlobMD5', [], suite.isMocked) + '.test';

      var blobBuffer = new Buffer(5 * 1024 * 1024);
      blobBuffer.fill(0);
      blobBuffer[0] = '1';

      fs.writeFile(fileNameSource, blobBuffer, function () {
        var blobOptions = { contentType: 'text'};
        blobService.createPageBlobFromLocalFile(containerName, blobName, fileNameSource, blobOptions, function (uploadError, blobResponse, uploadResponse) {
          assert.equal(uploadError, null);
          assert.notEqual(blobResponse, null);
          assert.ok(uploadResponse.isSuccessful);

          blobService.getBlobProperties(containerName, blobName, function (getBlobPropertiesErr) {
            assert.equal(getBlobPropertiesErr, null);

            var properties = {contentMD5: 'MDAwMDAwMDA='};
            blobService.setBlobProperties(containerName, blobName, properties, function (setBlobPropertiesErr) {
              assert.equal(setBlobPropertiesErr, null);

              blobService.getBlobToStream(containerName, blobName, fs.createWriteStream('task1-download.txt'), { disableContentMD5Validation: false }, function (downloadErr) {
                assert.notEqual(downloadErr, null);
                assert.equal(downloadErr.message, util.format(SR.HASH_MISMATCH, 'MDAwMDAwMDA=', 'ndpxhuSh0PPmMvK74fkYvg=='));

                blobService.getBlobToStream(containerName, blobName, fs.createWriteStream('task2-download.txt'), function (downloadErr2) {
                  assert.notEqual(downloadErr2, null);
                  assert.equal(downloadErr2.message, util.format(SR.HASH_MISMATCH, 'MDAwMDAwMDA=', 'ndpxhuSh0PPmMvK74fkYvg=='));

                  blobService.getBlobToStream(containerName, blobName, fs.createWriteStream('task3-download.txt'), { disableContentMD5Validation: true }, function (downloadErr3) {
                    assert.equal(downloadErr3, null);
                    try { fs.unlinkSync(fileNameSource); } catch (e) {}
                    try { fs.unlinkSync('task1-download.txt'); } catch (e) {}
                    try { fs.unlinkSync('task2-download.txt'); } catch (e) {}
                    try { fs.unlinkSync('task3-download.txt'); } catch (e) {}

                    done();
                  });
                });
              });
            });
          });
        });
      });
    });
    
    skipMockAndBrowser('BlockBlobDownloadRangeValidation', function (done) {
      var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);
      var fileNameSource = testutil.generateId('getBlockBlobRange', [], suite.isMocked) + '.test';

      var blobBuffer = new Buffer(5 * 1024 * 1024);
      blobBuffer.fill(0);
      blobBuffer[0] = '1';

      fs.writeFile(fileNameSource, blobBuffer, function () {
        var blobOptions = { contentType: 'text', blockIdPrefix : 'blockId', storeBlobContentMD5: true};
        blobService.createBlockBlobFromLocalFile(containerName, blobName, fileNameSource, blobOptions, function (uploadError, blobResponse, uploadResponse) {
          assert.equal(uploadError, null);
          assert.notEqual(blobResponse, null);
          assert.ok(uploadResponse.isSuccessful);

          blobService.getBlobToStream(containerName, blobName, fs.createWriteStream('task1-download.txt'), { rangeStart: 512, rangeEnd: 1023, useTransactionalMD5: true }, function (downloadErr, downloadResult) {
            assert.equal(downloadErr, null);
            assert.notEqual(downloadResult.contentSettings.contentMD5, null);

            assert.strictEqual(parseInt(downloadResult.contentLength, 10), 512);
            blobService.getBlobToStream(containerName, blobName, fs.createWriteStream('task1-download.txt'), { rangeStart: 512, rangeEnd: 1023, useTransactionalMD5: true }, function (downloadErr, downloadResult) {
              assert.equal(downloadErr, null);
              assert.strictEqual(parseInt(downloadResult.contentLength, 10), 512);
              assert.strictEqual(downloadResult.contentSettings.contentMD5, 'ndpxhuSh0PPmMvK74fkYvg==');
              try { fs.unlinkSync(fileNameSource); } catch (e) {}

              done();
            });
          });
        });
      });
    });
  
    skipMockAndBrowser('PageBlobDownloadRangeValidation', function (done) {
      var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);
      var fileNameSource = testutil.generateId('getPageBlobRange', [], suite.isMocked) + '.test';

      var blobBuffer = new Buffer(5 * 1024 * 1024);
      blobBuffer.fill(0);
      blobBuffer[0] = '1';

      fs.writeFile(fileNameSource, blobBuffer, function () {
        var blobOptions = { contentType: 'text', blockIdPrefix : 'blockId', storeBlobContentMD5: true};
        blobService.createPageBlobFromLocalFile(containerName, blobName, fileNameSource, blobOptions, function (uploadError, blobResponse, uploadResponse) {
          assert.equal(uploadError, null);
          assert.notEqual(blobResponse, null);
          assert.ok(uploadResponse.isSuccessful);

          blobService.getBlobToStream(containerName, blobName, fs.createWriteStream('task1-download.txt'), { rangeStart: 0, rangeEnd: 511, useTransactionalMD5: true }, function (downloadErr, downloadResult) {
            assert.equal(downloadErr, null);
            assert.notEqual(downloadResult.contentSettings.contentMD5, null);

            assert.strictEqual(parseInt(downloadResult.contentLength, 10), 512);
            blobService.getBlobToStream(containerName, blobName, fs.createWriteStream('task1-download.txt'), { rangeStart: 512, rangeEnd: 1023, useTransactionalMD5: true }, function (downloadErr, downloadResult) {
              assert.equal(downloadErr, null);
              assert.notEqual(downloadResult.contentSettings.contentMD5, null);
              assert.strictEqual(parseInt(downloadResult.contentLength, 10), 512);
              assert.strictEqual(downloadResult.contentSettings.contentMD5, 'ndpxhuSh0PPmMvK74fkYvg==');

              try { fs.unlinkSync(fileNameSource); } catch (e) {}
              try { fs.unlinkSync('task1-download.txt'); } catch (e) {}

              done();
            });
          });
        });
      });
    });
  
    it('DownloadTextWithMD5Validation', function (done) {
      var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);
      var data1 = 'Hello, World!';
        
      var callback = function (webresource) {
        assert.notEqual(webresource.headers[HeaderConstants.CONTENT_MD5], null);
      };

      blobService.on('sendingRequestEvent', callback);
      blobService.createBlockBlobFromText(containerName, blobName, data1, {useTransactionalMD5: true}, function (err) {
        assert.equal(err, null);
        blobService.removeAllListeners('sendingRequestEvent');

        blobService.getBlobToText(containerName, blobName, function (err2, content, result) {
          assert.equal(err2, null);
          assert.equal(content, 'Hello, World!');
          assert.equal(result.contentSettings.contentMD5, 'ZajifYh5KDgxtmS9i38K1A==');
          
          done();
        });
      });
    });
  });

  describe('createBlockBlobFromText', function () {
    it('should work for small size from text', function (done) {
      var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked) + ' a';
      var blobText = 'Hello World';

      blobService.createBlockBlobFromText(containerName, blobName, blobText, function (uploadError, blobResponse, uploadResponse) {
        assert.equal(uploadError, null);
        assert.notEqual(blobResponse, null);
        assertNoStalePropertyOnBlob(blobResponse);
        assert.ok(uploadResponse.isSuccessful);

        blobService.getBlobToText(containerName, blobName, function (downloadErr, blobTextResponse) {
          assert.equal(downloadErr, null);
          assert.equal(blobTextResponse, blobText);

          done();
        });
      });
    });

    it('should automatically store md5', function (done) {
      var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked) + ' a';
      var blobText = 'Hello World';
      var blobMD5 = azureutil.getContentMd5(blobText);

      blobService.createBlockBlobFromText(containerName, blobName, blobText, function (uploadError, blobResponse, uploadResponse) {
        assert.equal(uploadError, null);
        assert.notEqual(blobResponse, null);
        assert.ok(uploadResponse.isSuccessful);

        blobService.getBlobProperties(containerName, blobName, function (error4, blobProperties) {
          assert.equal(error4, null);
          assert.notEqual(blobProperties, null);
          assert.equal(blobProperties.contentSettings.contentMD5, blobMD5);

          done();
        });
      });
    });

    it('should work with access condition', function (done) {
      var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);
      var blobText = 'hello';

      blobService.createBlockBlobFromText(containerName, blobName, blobText, function (error2) {
        assert.equal(error2, null);

        blobService.getBlobProperties(containerName, blobName, function (error4, blobProperties) {
          assert.equal(error4, null);

          var options = { accessConditions: { EtagNonMatch: blobProperties.etag} };
          blobService.createBlockBlobFromText(containerName, blobName, blobText, options, function (error3) {
            assert.notEqual(error3, null);
            assert.equal(error3.code, Constants.StorageErrorCodeStrings.CONDITION_NOT_MET);

            done();
          });
        });
      });
    });

    it('should work with storeBlobContentMD5', function (done) {
      var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked) + ' a';
      var blobText = 'Hello World';
      var blobMD5 = azureutil.getContentMd5(blobText);

      blobService.createBlockBlobFromText(containerName, blobName, blobText, {storeBlobContentMD5: true, contentSettings: { contentMD5: blobMD5 }}, function (uploadError, blob, uploadResponse) {
        assert.equal(uploadError, null);
        assert.notEqual(blob, null);
        assert.equal(blob.contentSettings.contentMD5, blobMD5);
        assert.ok(uploadResponse.isSuccessful);

        blobService.getBlobToText(containerName, blobName, function (downloadErr, blobTextResponse) {
          assert.equal(downloadErr, null);
          assert.equal(blobTextResponse, blobText);

          done();
        });
      });
    });
  });

  if (!suite.isBrowser) {
    describe('createBlockBlobFromLocalFile', function() {
      var zeroFileContentMD5;
      before(function (done) {
        blockBlobContentMD5 = writeFile(blockFileName, fileText);
        var zeroBuffer = new Buffer(0);
        zeroFileContentMD5 = writeFile(zeroSizeFileName, zeroBuffer);
        done();
      });
  
      afterEach(function (done) {
        blobService.deleteBlobIfExists(containerName, blockBlobName, function (err) {
          assert.equal(err, null);
          done();
        });
      });
  
      it('should work with basic file', function(done) {
        blobService.createBlockBlobFromLocalFile(containerName, blockBlobName, blockFileName, uploadOptions, function (err, blob) {
          assert.equal(err, null);
          assertNoStalePropertyOnBlob(blob);
  
          blobService.getBlobProperties(containerName, blockBlobName, function (err, blob) {
            assert.equal(blob.contentSettings.contentMD5, blockBlobContentMD5);
  
            blobService.getBlobToText(containerName, blockBlobName, function (downloadErr, blobTextResponse) {
              assert.equal(downloadErr, null);
              assert.equal(blobTextResponse, fileText);
              done();
            });
          });
        });
      });
  
      it('should overwrite the existing blob', function(done) {
        blobService.createBlockBlobFromText(containerName, blockBlobName, 'garbage', uploadOptions, function (err) {
          assert.equal(err, null);
          blobService.createBlockBlobFromLocalFile(containerName, blockBlobName, blockFileName, uploadOptions, function (err) {
            assert.equal(err, null);
  
            blobService.getBlobToText(containerName, blockBlobName, function (downloadErr, blobTextResponse) {
              assert.equal(downloadErr, null);
              assert.equal(blobTextResponse, fileText);
              done();
            });
          });
        });
      });
  
      it('should work with zero size file', function(done) {
        blobService.createBlockBlobFromLocalFile(containerName, blockBlobName, zeroSizeFileName, uploadOptions, function (err) {
          assert.equal(err, null);
  
          blobService.getBlobProperties(containerName, blockBlobName, function(err, blob) {
            assert.equal(blob.contentLength, 0);
            assert.equal(blob.contentSettings.contentMD5, zeroFileContentMD5);
            done();
          });
        });
      });
  
      it('should work with content type', function (done) {
        var blobOptions = { contentSettings: { contentType: 'text' }};
        blobService.createBlockBlobFromLocalFile(containerName, blockBlobName, blockFileName, blobOptions, function (uploadError, blobResponse, uploadResponse) {
          assert.equal(uploadError, null);
          assert.notEqual(blobResponse, null);
          assert.ok(uploadResponse.isSuccessful);
  
          blobService.getBlobProperties(containerName, blockBlobName, function (getBlobPropertiesErr, blobGetResponse) {
            assert.equal(getBlobPropertiesErr, null);
            assert.notEqual(blobGetResponse, null);
            assert.equal(blobOptions.contentSettings.contentType, blobGetResponse.contentSettings.contentType);
            done();
          });
        });
      });
  
      it('should work with not existing file', function(done) {
        blobService.createBlockBlobFromLocalFile(containerName, blockBlobName, notExistFileName, uploadOptions, function (err) {
          assert.notEqual(err, null);
          assert.equal(path.basename(err.path), notExistFileName);
  
          blobService.doesBlobExist(containerName, blockBlobName, function (existsErr, existsResult) {
            assert.equal(existsErr, null);
            assert.equal(existsResult.exists, false);
            done();
          });
        });
      });
  
      it('should work with metadata', function(done) {
        var options = {
          storeBlobContentMD5 : true,
          useTransactionalMD5 : true,
          metadata: { color: 'blue' }
        };
        blobService.createBlockBlobFromLocalFile(containerName, blockBlobName, zeroSizeFileName, options, function (err) {
          assert.equal(err, null);
  
          blobService.getBlobProperties(containerName, blockBlobName, function (err, blob) {
            assert.equal(err, null);
            assert.equal(blob.contentLength, 0);
            assert.equal(blob.contentSettings.contentMD5, zeroFileContentMD5);
            assert.notEqual(blob.metadata, null);
            assert.equal(blob.metadata.color, options.metadata.color);
            done();
          });
        });
      });
  
      runOrSkip('should have same md5 with range-based downloading to local file', function (done) {
        var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);
        var fileNameSource = testutil.generateId('getBlobRangeMD5', [], suite.isMocked) + '.test';
        var fileSize = 97 * 1024 * 1024;  // Don't be a multiple of 4MB to cover more scenarios
        generateTempFile(fileNameSource, fileSize, false, function (fileInfo) {
          var baseMD5 = fileInfo.contentMD5;
          uploadOptions.parallelOperationThreadCount = 5;
          blobService.createBlockBlobFromLocalFile(containerName, blobName, fileNameSource, uploadOptions, function (error) {
            assert.equal(error, null);
            
            blobService.getBlobProperties(containerName, blobName, function (error, blobProperties) {
              assert.equal(error, null);
              assert.notEqual(blobProperties, null);
              assert.strictEqual(blobProperties.contentSettings.contentMD5, baseMD5);
              var downloadOptions = { parallelOperationThreadCount : 5 };
              blobService.getBlobToLocalFile(containerName, blobName, fileNameSource, downloadOptions, function (error) {
                assert.equal(error, null);
                
                getFileMD5(fileNameSource, function (fileInfo) {
                  assert.strictEqual(fileInfo.contentMD5, baseMD5);
                  try { fs.unlinkSync(fileNameSource); } catch (e) { }
                  done();
                });
              });
            });
          });
        });
      });
  
      runOrSkip('getBlobToLocalFile should return the SpeedSummary correctly', function (done) {
        var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);
        var fileNameSource = testutil.generateId('getBlobToLocalFileSpeedSummary', [], suite.isMocked) + '.test';
        var fileSize = 97 * 1024 * 1024;  // Don't be a multiple of 4MB to cover more scenarios
        generateTempFile(fileNameSource, fileSize, false, function (fileInfo) {
          uploadOptions.parallelOperationThreadCount = 5;
          blobService.createBlockBlobFromLocalFile(containerName, blobName, fileNameSource, uploadOptions, function (error) {
            assert.equal(error, null);
            
            var speedSummary;
            var downloadOptions = { 
              parallelOperationThreadCount : 5
            };
            
            speedSummary = blobService.getBlobToLocalFile(containerName, blobName, fileNameSource, downloadOptions, function (error) {
              assert.equal(speedSummary.getTotalSize(false), fileSize);
              assert.equal(speedSummary.getCompleteSize(false), fileSize);
              assert.equal(speedSummary.getCompletePercent(), '100.0');
              
              try { fs.unlinkSync(fileNameSource); } catch (e) { }
              done();
            });
            
            assert.notEqual(speedSummary, null);
          });
        });
      });
      
      runOrSkip('should have same md5 with range-based downloading to stream', function (done) {
        var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);
        var fileNameSource = testutil.generateId('getBlobRangeStreamMD5Local', [], suite.isMocked) + '.test';
        var fileSize = 97 * 1024 * 1024;  // Don't be a multiple of 4MB to cover more scenarios
        generateTempFile(fileNameSource, fileSize, false, function (fileInfo) {
          var baseMD5 = fileInfo.contentMD5;
          uploadOptions.parallelOperationThreadCount = 5;
          blobService.createBlockBlobFromLocalFile(containerName, blobName, fileNameSource, uploadOptions, function (error) {
            assert.equal(error, null);
            
            blobService.getBlobProperties(containerName, blobName, function (error, blobProperties) {
              assert.equal(error, null);
              assert.notEqual(blobProperties, null);
              assert.strictEqual(blobProperties.contentSettings.contentMD5, baseMD5);
              var downloadOptions = { parallelOperationThreadCount : 5 };
              var downloadedFileName = testutil.generateId('getBlobRangeStreamMD5', [], suite.isMocked) + '.test';
              var stream = fs.createWriteStream(downloadedFileName);
              blobService.getBlobToStream(containerName, blobName, stream, downloadOptions, function (error) {
                assert.equal(error, null);
                
                getFileMD5(downloadedFileName, function (fileInfo) {
                  assert.strictEqual(fileInfo.contentMD5, baseMD5);
                  try {
                    fs.unlinkSync(downloadedFileName);
                    fs.unlinkSync(fileNameSource);
                  } catch (e) { }
                  done();
                });
              });
            });
          });
        });
      });
  
      runOrSkip('should download a range of block blob to local file', function (done) {
        var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);
        var fileNameSource = testutil.generateId('getBlockBlobRangeLocal', [], suite.isMocked) + '.test';
        var fileSize = 97 * 1024 * 1024;  // Don't be a multiple of 4MB to cover more scenarios
        generateTempFile(fileNameSource, fileSize, false, function (fileInfo) {
          uploadOptions.parallelOperationThreadCount = 5;
          blobService.createBlockBlobFromLocalFile(containerName, blobName, fileNameSource, uploadOptions, function (error) {
            assert.equal(error, null);
            try { fs.unlinkSync(fileNameSource); } catch (e) { }
  
            var downloadOptions = { parallelOperationThreadCount : 5, rangeStart: 100, rangeEnd: 70000000 };
            var downloadedFileName = testutil.generateId('getBlockBlobRange', [], suite.isMocked) + '.test';
            blobService.getBlobToLocalFile(containerName, blobName, downloadedFileName, downloadOptions, function (error) {
              assert.equal(error, null);
              
              var content = fs.readFileSync(downloadedFileName);
              assert.equal(content.length, downloadOptions.rangeEnd - downloadOptions.rangeStart + 1);
              delete content;
              try { fs.unlinkSync(downloadedFileName); } catch (e) { }
              done();
            });
          });
        });
      });
    });
  
    describe('createBlockBlobFromStream', function() {
      var len;
      var stream;
  
      before(function (done) {
        blockBlobContentMD5 = writeFile(blockFileName, fileText);
        var zeroBuffer = new Buffer(0);
        zeroFileContentMD5 = writeFile(zeroSizeFileName, zeroBuffer);
        done();
      });
  
      beforeEach(function (done) {
        len = Buffer.byteLength(fileText);
        stream = rfs.createReadStream(blockFileName);
        done();
      });
  
      afterEach(function (done) {
        blobService.deleteBlobIfExists(containerName, blockBlobName, function(error) {
          done();
        });
      });
  
      it('should work with basic file stream', function(done) {
        blobService.createBlockBlobFromStream(containerName, blockBlobName, stream, len, uploadOptions, function (err, blob) {
          assert.equal(err, null);
          assertNoStalePropertyOnBlob(blob);
  
          blobService.getBlobProperties(containerName, blockBlobName, function(err, blob) {
            assert.equal(blob.contentSettings.contentMD5, blockBlobContentMD5);
  
            blobService.getBlobToText(containerName, blockBlobName, function (downloadErr, blobTextResponse) {
              assert.equal(downloadErr, null);
              assert.equal(blobTextResponse, fileText);
              done();
            });
          });
        });
      });
  
      it('should work with contentMD5 in options', function(done) {
        var options = {
          blockIdPrefix: blockIdPrefix,
          contentSettings: {
            contentMD5: blockBlobContentMD5
          }
        };
  
        blobService.createBlockBlobFromStream(containerName, blockBlobName, stream, len, options, function (err) {
          assert.equal(err, null);
          blobService.getBlobProperties(containerName, blockBlobName, function(err, blob) {
            assert.equal(blob.contentSettings.contentMD5, blockBlobContentMD5);
            done();
          });
        });
      });
  
      it('should work with the speed summary in options', function(done) {
        var speedSummary = new azure.BlobService.SpeedSummary();
        var options = {
          blockIdPrefix: blockIdPrefix,
          speedSummary: speedSummary
        };
  
        blobService.createBlockBlobFromStream(containerName, blockBlobName, stream, len, options, function (err) {
          assert.equal(err, null);
          assert.equal(speedSummary.getTotalSize(false), Buffer.byteLength(fileText));
          assert.equal(speedSummary.getCompleteSize(false), Buffer.byteLength(fileText));
          assert.equal(speedSummary.getCompletePercent(), '100.0');
          done();
        });
      });
  
      it('should work with content type', function (done) {
        var blobOptions = { contentSettings: { contentType: 'text' }};
  
        blobService.createBlockBlobFromStream(containerName, blockBlobName, rfs.createReadStream(blockFileName), fileText.length, blobOptions, function (uploadError, blobResponse, uploadResponse) {
          assert.equal(uploadError, null);
          assert.notEqual(blobResponse, null);
          assert.ok(uploadResponse.isSuccessful);
  
          blobService.getBlobToText(containerName, blockBlobName, function (downloadErr, blobTextResponse) {
            assert.equal(downloadErr, null);
            assert.equal(blobTextResponse, fileText);
  
            blobService.getBlobProperties(containerName, blockBlobName, function (getBlobPropertiesErr, blobGetResponse) {
              assert.equal(getBlobPropertiesErr, null);
              assert.notEqual(blobGetResponse, null);
              assert.equal(blobOptions.contentSettings.contentType, blobGetResponse.contentSettings.contentType);
  
              done();
            });
          });
        });
      });
  
      runOrSkip('should work with stream size (<= 32MB) which is a part of the read stream', function (done) {
        var options = {
          storeBlobContentMD5: false,
          useTransactionalMD5: false
        };
        var buffer = new Buffer(15 * 1024 * 1024);
        var tempBuffer = new Buffer(10);
        var uploadLength = buffer.length + tempBuffer.length;
        buffer.fill(1);
        tempBuffer.fill(2);
        var internalHash = crypto.createHash('md5');
        internalHash.update(buffer);
        internalHash.update(tempBuffer);
        var expectedMD5 = internalHash.digest('base64');
        var writeStream = fs.createWriteStream(blockFileName);
        writeStream.write(buffer, function () {
          buffer.fill(2);
          writeStream.write(buffer, function () {
            buffer.fill(3);
            writeStream.write(buffer, function () {
              writeStream.end();
            });
          });
        });
        
        writeStream.on('finish', function () {
          var stream = rfs.createReadStream(blockFileName);
          blobService.createBlockBlobFromStream(containerName, blockBlobName, stream, uploadLength, options, function (err) {
            assert.equal(err, null);
            blobService.getBlobProperties(containerName, blockBlobName, function (getBlobPropertiesErr, blobGetResult) {
              assert.equal(getBlobPropertiesErr, null);
              assert.notEqual(blobGetResult, null);
              assert.equal(blobGetResult.contentLength, uploadLength);
              assert.equal(blobGetResult.contentSettings.contentMD5, expectedMD5);
              
              // Calculate the MD5 by the library
              options.storeBlobContentMD5 = true;
              options.useTransactionalMD5 = true;
              stream = rfs.createReadStream(blockFileName);
              blobService.createBlockBlobFromStream(containerName, blockBlobName+1, stream, uploadLength, options, function (err) {
                assert.equal(err, null);
                blobService.getBlobProperties(containerName, blockBlobName+1, function (getBlobPropertiesErr, blobGetResult) {
                  assert.equal(getBlobPropertiesErr, null);
                  assert.notEqual(blobGetResult, null);
                  assert.equal(blobGetResult.contentLength, uploadLength);
                  assert.equal(blobGetResult.contentSettings.contentMD5, expectedMD5);
      
                  done();
                });
              });
            });
          });
        });
      });
      
      runOrSkip('should work with stream size (> 32MB) which is a part of the read stream', function (done) {
        var options = {
          storeBlobContentMD5: true,
          useTransactionalMD5: true
        };
        var expectedMD5;
        var buffer = new Buffer(20 * 1024 * 1024);
        var tempBuffer = new Buffer(10);
        var uploadLength = buffer.length * 2 + tempBuffer.length;
        buffer.fill(1);
        var internalHash = crypto.createHash('md5');
        internalHash.update(buffer);
        var writeStream = fs.createWriteStream(blockFileName);
        writeStream.write(buffer, function () {
          buffer.fill(2);
          internalHash.update(buffer);
          writeStream.write(buffer, function () {
            buffer.fill(3);
            tempBuffer.fill(3);
            internalHash.update(tempBuffer);
            expectedMD5 = internalHash.digest('base64');
            writeStream.write(buffer, function () {
              writeStream.end();
            });
          });
        });
        
        writeStream.on('finish', function () {
          var stream = rfs.createReadStream(blockFileName);
          blobService.createBlockBlobFromStream(containerName, blockBlobName, stream, uploadLength, options, function (err) {
            assert.equal(err, null);
            blobService.getBlobProperties(containerName, blockBlobName, function (getBlobPropertiesErr, blobGetResult) {
              assert.equal(getBlobPropertiesErr, null);
              assert.notEqual(blobGetResult, null);
              assert.equal(blobGetResult.contentLength, uploadLength);
              assert.equal(blobGetResult.contentSettings.contentMD5, expectedMD5);
  
              done();
            });
          });
        });
      });
  
      runOrSkip('should work with parallelOperationsThreadCount in options', function (done) {
        var options = {
          blockIdPrefix: blockIdPrefix,
          parallelOperationThreadCount: 4
        };
        var expectedMD5;
        var buffer = new Buffer(25 * 1024 * 1024);
        var uploadLength = buffer.length * 3;
        buffer.fill(1);
        var internalHash = crypto.createHash('md5');
        internalHash.update(buffer);
        var writeStream = fs.createWriteStream(blockFileName);
        writeStream.write(buffer, function () {
          buffer.fill(2);
          internalHash.update(buffer);
          writeStream.write(buffer, function () {
            buffer.fill(3);
            internalHash.update(buffer);
            expectedMD5 = internalHash.digest('base64');
            writeStream.write(buffer, function () {
              writeStream.end();
            });
          });
        });
  
        writeStream.on('finish', function () {
          var stream = rfs.createReadStream(blockFileName);
          blobService.createBlockBlobFromStream(containerName, blockBlobName, stream, uploadLength, options, function (err) {
            assert.equal(err, null);
    
            blobService.getBlobProperties(containerName, blockBlobName, function (getBlobPropertiesErr, blobGetResult) {
              assert.equal(getBlobPropertiesErr, null);
              assert.notEqual(blobGetResult, null);
              assert.equal(blobGetResult.contentLength, uploadLength);
              assert.equal(blobGetResult.contentSettings.contentMD5, expectedMD5);
    
              done();
            });
          });
        });
      });
    });
  
    describe('createPageBlobFromLocalFile', function() {
      var zeroFileContentMD5;
      before(function (done) {
        pageBlobBuffer.fill(1);
        pageBlobContentMD5 = writeFile(pageFileName, pageBlobBuffer);
        pageBlob2KBuffer.fill(1);
        pageBlob2KContentMD5 = writeFile(page2KFileName, pageBlob2KBuffer);
        var zeroBuffer = new Buffer(0);
        zeroFileContentMD5 = writeFile(zeroSizeFileName, zeroBuffer);
        done();
      });
  
      afterEach(function (done) {
        blobService.deleteBlobIfExists(containerName, pageBlobName, function(error) {
          done();
        });
      });
  
      it('should work with basic file', function(done) {
        blobService.createPageBlobFromLocalFile(containerName, pageBlobName, pageFileName, function (err, blob) {
          assert.equal(err, null);
          assertNoStalePropertyOnBlob(blob);
  
          blobService.getBlobProperties(containerName, pageBlobName, function (err1, blob) {
            assert.equal(err1, null);
            assert.equal(blob.contentMD5, undefined);
  
            blobService.getBlobToText(containerName, pageBlobName, function (downloadErr, blobTextResponse) {
              assert.equal(downloadErr, null);
              assert.equal(blobTextResponse, pageBlobBuffer.toString());
              done();
            });
          });
        });
      });
  
      it('should work with speed summary', function(done) {
        var speedSummary = blobService.createPageBlobFromLocalFile(containerName, pageBlobName, pageFileName, function (err) {
          assert.equal(err, null);
  
          blobService.getBlobProperties(containerName, pageBlobName, function (err1, blob) {
            assert.equal(err1, null);
            assert.equal(blob.contentMD5, undefined);
            assert.equal(speedSummary.getTotalSize(false), 1024);
            assert.equal(speedSummary.getCompleteSize(false), 1024);
            assert.equal(speedSummary.getCompletePercent(), '100.0');
            done();
          });
        });
      });
  
      it('should set content md5', function(done) {
        var options = { storeBlobContentMD5 : true };
  
        blobService.createPageBlobFromLocalFile(containerName, pageBlobName, pageFileName, options, function (err) {
          assert.equal(err, null);
  
          blobService.getBlobProperties(containerName, pageBlobName, function (getErr, blob) {
            assert.equal(getErr, null);
            assert.equal(blob.contentSettings.contentMD5, pageBlobContentMD5);
            done();
          });
        });
      });
  
      it('should overwrite the existing page blob', function(done) {
        var options = { storeBlobContentMD5 : true };
  
        blobService.createPageBlobFromLocalFile(containerName, pageBlobName, pageFileName, options, function (err) {
          assert.equal(err, null);
  
          blobService.getBlobProperties(containerName, pageBlobName, function (err2, blob1) {
            assert.equal(err2, null);
            assert.notEqual(blob1, null);
            assert.equal(blob1.contentSettings.contentMD5, pageBlobContentMD5);
            assert.equal(blob1.contentLength, 1024);
            options.contentMD5Header = null;
  
            blobService.createPageBlobFromLocalFile(containerName, pageBlobName, page2KFileName, options, function (err3) {
              assert.equal(err3, null);
  
              blobService.getBlobProperties(containerName, pageBlobName, function (err4, blob2) {
                assert.equal(err4, null);
                assert.notEqual(blob2, null);
                assert.equal(blob2.contentLength, 2 * 1024);
                assert.equal(blob2.contentSettings.contentMD5, pageBlob2KContentMD5);
                done();
              });
            });
          });
        });
      });
  
      it('should work with zero size file', function(done) {
        uploadOptions.storeBlobContentMD5 = true;
        blobService.createPageBlobFromLocalFile(containerName, pageBlobName, zeroSizeFileName, uploadOptions, function (err1) {
          assert.equal(err1, null);
  
          blobService.getBlobProperties(containerName, pageBlobName, function (err2, blob) {
            assert.equal(err2, null);
            assert.equal(blob.contentLength, 0);
            assert.equal(blob.contentSettings.contentMD5, zeroFileContentMD5);
            done();
          });
        });
      });
  
      it('should work with not existing file', function(done) {
        blobService.createPageBlobFromLocalFile(containerName, pageBlobName, notExistFileName, uploadOptions, function (err) {
          assert.notEqual(err, null);
          assert.equal(path.basename(err.path), notExistFileName);
  
          blobService.doesBlobExist(containerName, pageBlobName, function (existsErr, existsResult) {
            assert.equal(existsErr, null);
            assert.equal(existsResult.exists, false);
            done();
          });
        });
      });
  
      it('should work with metadata', function(done) {
        var options = {
          storeBlobContentMD5 : true,
          useTransactionalMD5 : true,
          metadata: { color: 'blue' }
        };
        blobService.createPageBlobFromLocalFile(containerName, pageBlobName, zeroSizeFileName, options, function (err) {
          assert.equal(err, null);
  
          blobService.getBlobProperties(containerName, pageBlobName, function (err, blob) {
            assert.equal(err, null);
            assert.equal(blob.contentLength, 0);
            assert.equal(blob.contentSettings.contentMD5, zeroFileContentMD5);
            assert.notEqual(blob.metadata, null);
            assert.equal(blob.metadata.color, options.metadata.color);
            done();
          });
        });
      });
      
      runOrSkip('should have same md5 with range-based downloading to local file', function (done) {
        var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);
        var fileNameSource = testutil.generateId('getBlobRangeLocal', [], suite.isMocked) + '.test';
        var fileSize = 97 * 1024 * 1024;  // Don't be a multiple of 4MB to cover more scenarios
        generateTempFile(fileNameSource, fileSize, true, function (fileInfo) {
          var baseMD5 = fileInfo.contentMD5;
          uploadOptions.parallelOperationThreadCount = 5;
          uploadOptions.storeBlobContentMD5 = true;
          blobService.createPageBlobFromLocalFile(containerName, blobName, fileNameSource, uploadOptions, function (error) {
            assert.equal(error, null);
            
            blobService.getBlobProperties(containerName, blobName, function (error, blobProperties) {
              assert.equal(error, null);
              assert.notEqual(blobProperties, null);
              assert.strictEqual(blobProperties.contentSettings.contentMD5, baseMD5);
              
              var downloadOptions = { parallelOperationThreadCount : 5 };
              blobService.getBlobToLocalFile(containerName, blobName, fileNameSource, downloadOptions, function (error) {
                assert.equal(error, null);
                
                getFileMD5(fileNameSource, function (fileInfo) {
                  assert.strictEqual(fileInfo.contentMD5, baseMD5);
                  try { fs.unlinkSync(fileNameSource); } catch (e) { }
                  done();
                });
              });
            });
          });
        });
      });
  
      runOrSkip('should have same md5 with range-based downloading to stream', function (done) {
        var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);
        var fileNameSource = testutil.generateId('getBlobRangeStreamLocal', [], suite.isMocked) + '.test';
        var fileSize = 97 * 1024 * 1024;  // Don't be a multiple of 4MB to cover more scenarios
        generateTempFile(fileNameSource, fileSize, true, function (fileInfo) {
          var baseMD5 = fileInfo.contentMD5;
          uploadOptions.parallelOperationThreadCount = 5;
          uploadOptions.storeBlobContentMD5 = true;
          blobService.createPageBlobFromLocalFile(containerName, blobName, fileNameSource, uploadOptions, function (error) {
            assert.equal(error, null);
            
            blobService.getBlobProperties(containerName, blobName, function (error, blobProperties) {
              assert.equal(error, null);
              assert.notEqual(blobProperties, null);
              assert.strictEqual(blobProperties.contentSettings.contentMD5, baseMD5);
  
              var downloadOptions = { parallelOperationThreadCount : 5 };
              var downloadedFileName = testutil.generateId('getBlobRangeStream', [], suite.isMocked) + '.test';
              var stream = fs.createWriteStream(downloadedFileName);
              blobService.getBlobToStream(containerName, blobName, stream, downloadOptions, function (error) {
                assert.equal(error, null);
                
                getFileMD5(downloadedFileName, function (fileInfo) {
                  assert.strictEqual(fileInfo.contentMD5, baseMD5);
                  try {
                    fs.unlinkSync(fileNameSource);
                    fs.unlinkSync(downloadedFileName);
                  } catch (e) { }
                  done();
                });
              });
            });
          });
        });
      });
      
      runOrSkip('should download a range of page blob to local file', function (done) {
        var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);
        var fileNameSource = testutil.generateId('getPageBlobRangeLocal', [], suite.isMocked) + '.test';
        var fileSize = 97 * 1024 * 1024;  // Don't be a multiple of 4MB to cover more scenarios
        generateTempFile(fileNameSource, fileSize, true, function (fileInfo) {
          uploadOptions.parallelOperationThreadCount = 5;
          blobService.createPageBlobFromLocalFile(containerName, blobName, fileNameSource, uploadOptions, function (error) {
            assert.equal(error, null);
            try { fs.unlinkSync(fileNameSource); } catch (e) { }
            
            var downloadOptions = { parallelOperationThreadCount : 5 , rangeStart: 512, rangeEnd: 51199999 };
            var downloadedFileName = testutil.generateId('getPageBlobRange', [], suite.isMocked) + '.test';
            blobService.getBlobToLocalFile(containerName, blobName, downloadedFileName, downloadOptions, function (error) {
              assert.equal(error, null);
              
              var content = fs.readFileSync(downloadedFileName);
              assert.equal(content.length, downloadOptions.rangeEnd - downloadOptions.rangeStart + 1);
              delete content;
              try { fs.unlinkSync(downloadedFileName); } catch (e) { }
              done();
            });
          });
        });
      });
  
      runOrSkip('should download a range of page blob to stream', function (done) {
        var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);
        var fileNameSource = testutil.generateId('getPageBlobRangeStreamLocal', [], suite.isMocked) + '.test';
        var fileSize = 97 * 1024 * 1024;  // Don't be a multiple of 4MB to cover more scenarios
        generateTempFile(fileNameSource, fileSize, true, function (fileInfo) {
          uploadOptions.parallelOperationThreadCount = 5;
          uploadOptions.storeBlobContentMD5 = true;
          blobService.createPageBlobFromLocalFile(containerName, blobName, fileNameSource, uploadOptions, function (error) {
            assert.equal(error, null);
            try { fs.unlinkSync(fileNameSource); } catch (e) { }
            
            var downloadOptions = { parallelOperationThreadCount : 5 , rangeStart: 512, rangeEnd: 51199999, useTransactionalMD5: true };
            var downloadedFileName = testutil.generateId('getPageBlobRangeStream', [], suite.isMocked) + '.test';
            var stream = fs.createWriteStream(downloadedFileName);
            blobService.getBlobToStream(containerName, blobName, stream, downloadOptions, function (error, downloadResult) {
              assert.equal(error, null);
              assert.notEqual(downloadResult.contentSettings.contentMD5, null);
              
              var content = fs.readFileSync(downloadedFileName);
              assert.equal(content.length, downloadOptions.rangeEnd - downloadOptions.rangeStart + 1);
              delete content;
              try { fs.unlinkSync(downloadedFileName); } catch (e) { }
              done();
            });
          });
        });
      });
    });
  
    describe('createPageBlobFromStream', function() {
      //Most cases are in CreatePageBlobFromFile
      it('should work with basic file', function(done) {
        var stream = rfs.createReadStream(pageFileName);
        blobService.createPageBlobFromStream(containerName, pageBlobName, stream, 1024, function (err, blob) {
          assert.equal(err, null);
          assertNoStalePropertyOnBlob(blob);
  
          blobService.getBlobProperties(containerName, pageBlobName, function (err1, blob) {
            assert.equal(err1, null);
            assert.equal(blob.contentMD5, undefined);
  
            blobService.getBlobToText(containerName, pageBlobName, function (downloadErr, blobTextResponse) {
              assert.equal(downloadErr, null);
              assert.equal(blobTextResponse, pageBlobBuffer.toString());
              done();
            });
          });
        });
      });
      
      runOrSkip('should work with stream size which is a part of the read stream', function (done) {
        var options = {
          storeBlobContentMD5: true,
          useTransactionalMD5: true
        };
        var buffer = new Buffer(15 * 1024 * 1024);
        var tempBuffer = new Buffer(512);
        var uploadLength = buffer.length + tempBuffer.length;
        buffer.fill(1);
        tempBuffer.fill(2);
        var internalHash = crypto.createHash('md5');
        internalHash.update(buffer);
        internalHash.update(tempBuffer);
        var expectedMD5 = internalHash.digest('base64');
        var writeStream = fs.createWriteStream(pageFileName);
        writeStream.write(buffer, function () {
          buffer.fill(2);
          writeStream.write(buffer, function () {
            buffer.fill(3);
            writeStream.write(buffer, function () {
              writeStream.end();
            });
          });
        });
        
        writeStream.on('finish', function () {
          var stream = rfs.createReadStream(pageFileName);
          blobService.createPageBlobFromStream(containerName, pageBlobName, stream, uploadLength, options, function (err) {
            assert.equal(err, null);
            blobService.getBlobProperties(containerName, pageBlobName, function (getBlobPropertiesErr, blobGetResponse) {
              assert.equal(getBlobPropertiesErr, null);
              assert.notEqual(blobGetResponse, null);
              assert.equal(blobGetResponse.contentLength, uploadLength);
              assert.equal(blobGetResponse.contentSettings.contentMD5, expectedMD5);
  
              done();
            });
          });
        });
      });
  
      runOrSkip('should work with parallelOperationsThreadCount in options', function(done) {
        var options = {
          parallelOperationThreadCount : 4
        };
  
        var buffer = new Buffer(65 * 1024 * 1024);
        buffer.fill(1);
        var stream = rfs.createReadStream(pageFileName);
        
        blobService.createPageBlobFromStream(containerName, pageBlobName, stream, buffer.length, options, function (err) {
          assert.equal(err, null);
  
          blobService.getBlobProperties(containerName, pageBlobName, function (getBlobPropertiesErr, blobGetResponse) {
            assert.equal(getBlobPropertiesErr, null);
            assert.notEqual(blobGetResponse, null);
            assert.equal(blobGetResponse.contentLength, buffer.length);
  
            done();
          });
        });
      });
    });
  
    describe('createAppendBlobFromLocalFile', function () {
      var zeroFileContentMD5;
      before(function (done) {
        appendBlobBuffer.fill(1);
        appendBlobContentMD5 = writeFile(appendFileName, appendBlobBuffer);
        appendBlob2KBuffer.fill(1);
        appendBlob2KContentMD5 = writeFile(append2KFileName, appendBlob2KBuffer);
        var zeroBuffer = new Buffer(0);
        zeroFileContentMD5 = writeFile(zeroSizeFileName, zeroBuffer);
        done();
      });
      
      afterEach(function (done) {
        blobService.deleteBlobIfExists(containerName, appendBlobName, function (error) {
          done();
        });
      });
      
      it('should work with basic file', function (done) {
        blobService.createAppendBlobFromLocalFile(containerName, appendBlobName, appendFileName, function (err, blob) {
          assert.equal(err, null);
          assert.equal(blob.appendOffset, 0);
          assert.equal(blob.committedBlockCount, 1);
          assertNoStalePropertyOnBlob(blob);
  
          blobService.getBlobProperties(containerName, appendBlobName, function (err1, blob) {
            assert.equal(err1, null);
            assert.equal(blob.contentSettings.contentMD5, undefined);
            assert.equal(blob.committedBlockCount, 1);
            
            blobService.getBlobToText(containerName, appendBlobName, function (downloadErr, blobTextResponse) {
              assert.equal(downloadErr, null);
              assert.equal(blobTextResponse, appendBlobBuffer.toString());
              done();
            });
          });
        });
      });   
  
      it('should work with speed summary', function (done) {
        var speedSummary = blobService.createAppendBlobFromLocalFile(containerName, appendBlobName, appendFileName, function (err) {
          assert.equal(err, null);
          
          blobService.getBlobProperties(containerName, appendBlobName, function (err1, blob) {
            assert.equal(err1, null);
            assert.equal(blob.contentSettings.contentMD5, undefined);
            assert.equal(speedSummary.getTotalSize(false), 1024);
            assert.equal(speedSummary.getCompleteSize(false), 1024);
            assert.equal(speedSummary.getCompletePercent(), '100.0');
            done();
          });
        });
      });
      
      it('should set content md5', function (done) {
        var options = { storeBlobContentMD5 : true };
        
        blobService.createAppendBlobFromLocalFile(containerName, appendBlobName, appendFileName, options, function (err) {
          assert.equal(err, null);
          
          blobService.getBlobProperties(containerName, appendBlobName, function (getErr, blob) {
            assert.equal(getErr, null);
            assert.equal(blob.contentSettings.contentMD5, appendBlobContentMD5);
            done();
          });
        });
      });
      
      it('should overwrite the existing append blob', function (done) {
        var options = { storeBlobContentMD5 : true };
        
        blobService.createAppendBlobFromLocalFile(containerName, appendBlobName, appendFileName, options, function (err) {
          assert.equal(err, null);
          
          blobService.getBlobProperties(containerName, appendBlobName, function (err2, blob1) {
            assert.equal(err2, null);
            assert.notEqual(blob1, null);
            assert.equal(blob1.contentSettings.contentMD5, appendBlobContentMD5);
            assert.equal(blob1.contentLength, 1024);
            options.contentMD5Header = null;
            
            blobService.createAppendBlobFromLocalFile(containerName, appendBlobName, append2KFileName, options, function (err3, blob) {
              assert.equal(err3, null);
              assert.equal(blob.appendOffset, 0);
              assert.equal(blob.committedBlockCount, 1);
              
              blobService.getBlobProperties(containerName, appendBlobName, function (err4, blob2) {
                assert.equal(err4, null);
                assert.notEqual(blob2, null);
                assert.equal(blob2.committedBlockCount, 1);
                assert.equal(blob2.contentLength, 2 * 1024);
                assert.equal(blob2.contentSettings.contentMD5, appendBlob2KContentMD5);
                done();
              });
            });
          });
        });
      });
      
      it('should work with zero size file', function (done) {
        uploadOptions.storeBlobContentMD5 = true;
        blobService.createAppendBlobFromLocalFile(containerName, appendBlobName, zeroSizeFileName, uploadOptions, function (err) {
          assert.equal(err, null);
          done();
        });
      });
      
      it('should work with not existing file', function (done) {
        blobService.createAppendBlobFromLocalFile(containerName, appendBlobName, notExistFileName, uploadOptions, function (err) {
          assert.notEqual(err, null);
          assert.equal(path.basename(err.path), notExistFileName);
          
          blobService.doesBlobExist(containerName, appendBlobName, function (existsErr, existsResult) {
            assert.equal(existsErr, null);
            assert.equal(existsResult.exists, false);
            done();
          });
        });
      });
  
      it('should work with metadata', function(done) {
        var options = {
          storeBlobContentMD5 : true,
          metadata: { color: 'blue' }
        };
        blobService.createAppendBlobFromLocalFile(containerName, appendBlobName, appendFileName, options, function (err) {
          assert.equal(err, null);
  
          blobService.getBlobProperties(containerName, appendBlobName, function (err, blob) {
            assert.equal(err, null);
            assert.equal(blob.contentLength, 1024);
            assert.equal(blob.contentSettings.contentMD5, appendBlobContentMD5);
            assert.notEqual(blob.metadata, null);
            assert.equal(blob.metadata.color, options.metadata.color);
            done();
          });
        });
      });
  
      runOrSkip('should download a range of append blob to local file', function (done) {
        var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);
        var fileNameSource = testutil.generateId('getAppendBlobRangeLocal', [], suite.isMocked) + '.test';
        var fileSize = 97 * 1024 * 1024;  // Don't be a multiple of 4MB to cover more scenarios
        generateTempFile(fileNameSource, fileSize, true, function (fileInfo) {
          uploadOptions.parallelOperationThreadCount = 1;
          blobService.createAppendBlobFromLocalFile(containerName, blobName, fileNameSource, uploadOptions, function (error) {
            assert.equal(error, null);
            try { fs.unlinkSync(fileNameSource); } catch (e) { }
            
            var downloadOptions = { parallelOperationThreadCount : 5 , rangeStart: 512, rangeEnd: 51199999 };
            var downloadedFileName = testutil.generateId('getAppendBlobRange', [], suite.isMocked) + '.test';
            blobService.getBlobToLocalFile(containerName, blobName, downloadedFileName, downloadOptions, function (error) {
              assert.equal(error, null);
              
              var content = fs.readFileSync(downloadedFileName);
              assert.equal(content.length, downloadOptions.rangeEnd - downloadOptions.rangeStart + 1);
              delete content;
              try { fs.unlinkSync(downloadedFileName); } catch (e) { }
              done();
            });
          });
        });
      });
    });
  
    describe('createAppendBlobFromStream', function () {
      var len;
      var stream;
      
      before(function (done) {
        appendBlobContentMD5 = writeFile(appendFileName, fileText);
        var zeroBuffer = new Buffer(0);
        zeroFileContentMD5 = writeFile(zeroSizeFileName, zeroBuffer);
        done();
      });
      
      beforeEach(function (done) {
        len = Buffer.byteLength(fileText);
        stream = rfs.createReadStream(appendFileName);
        done();
      });
      
      afterEach(function (done) {
        blobService.deleteBlobIfExists(containerName, appendBlobName, function (error) {
          done();
        });
      });
      
      it('should work with basic file stream', function (done) {
        uploadOptions.storeBlobContentMD5 = true;
        uploadOptions.useTransactionalMD5 = true;
        blobService.createAppendBlobFromStream(containerName, appendBlobName, stream, len, uploadOptions, function (err, blob) {
          assert.equal(err, null);
          assert.equal(blob.appendOffset, 0);
          assert.equal(blob.committedBlockCount, 1);
          assertNoStalePropertyOnBlob(blob);
  
          blobService.getBlobProperties(containerName, appendBlobName, function (err, blob) {
            assert.equal(blob.contentSettings.contentMD5, appendBlobContentMD5);
            
            blobService.getBlobToText(containerName, appendBlobName, function (downloadErr, blobTextResponse) {
              assert.equal(downloadErr, null);
              assert.equal(blobTextResponse, fileText);
              done();
            });
          });
        });
      });
      
      it('should work with contentMD5 in options', function (done) {
        var options = {
          contentSettings: {
            contentMD5 : appendBlobContentMD5
          },
          useTransactionalMD5: true,
          storeBlobContentMD5: true
        };
        blobService.createAppendBlobFromStream(containerName, appendBlobName, stream, len, options, function (err) {
          assert.equal(err, null);
          blobService.getBlobProperties(containerName, appendBlobName, function (err, blob) {
            assert.equal(blob.contentSettings.contentMD5, appendBlobContentMD5);
            done();
          });
        });
      });
      
      it('should work with the speed summary in options', function (done) {
        var speedSummary = new azure.BlobService.SpeedSummary();
        var options = {
          speedSummary : speedSummary
        };
        
        blobService.createAppendBlobFromStream(containerName, appendBlobName, stream, len, options, function (err) {
          assert.equal(err, null);
          assert.equal(speedSummary.getTotalSize(false), Buffer.byteLength(fileText));
          assert.equal(speedSummary.getCompleteSize(false), Buffer.byteLength(fileText));
          assert.equal(speedSummary.getCompletePercent(), '100.0');
          done();
        });
      });
      
      it('should work with content type', function (done) {
        var blobOptions = { contentSettings: { contentType: 'text' }};
        
        blobService.createAppendBlobFromStream(containerName, appendBlobName, rfs.createReadStream(appendFileName), fileText.length, blobOptions, function (uploadError, blobResponse, uploadResponse) {
          assert.equal(uploadError, null);
          assert.notEqual(blobResponse, null);
          assert.ok(uploadResponse.isSuccessful);
          
          blobService.getBlobToText(containerName, appendBlobName, function (downloadErr, blobTextResponse) {
            assert.equal(downloadErr, null);
            assert.equal(blobTextResponse, fileText);
            
            blobService.getBlobProperties(containerName, appendBlobName, function (getBlobPropertiesErr, blobGetResponse) {
              assert.equal(getBlobPropertiesErr, null);
              assert.notEqual(blobGetResponse, null);
              assert.equal(blobOptions.contentSettings.contentType, blobGetResponse.contentSettings.contentType);
              
              done();
            });
          });
        });
      });
      
      runOrSkip('should work with stream size which is a part of the read stream', function (done) {
        var options = {
          storeBlobContentMD5: true,
          useTransactionalMD5: true
        };
        var buffer = new Buffer(15 * 1024 * 1024);
        var tempBuffer = new Buffer(512);
        var uploadLength = buffer.length + tempBuffer.length;
        buffer.fill(1);
        tempBuffer.fill(2);
        var internalHash = crypto.createHash('md5');
        internalHash.update(buffer);
        internalHash.update(tempBuffer);
        var expectedMD5 = internalHash.digest('base64');
        var writeStream = fs.createWriteStream(appendFileName);
        writeStream.write(buffer, function () {
          buffer.fill(2);
          writeStream.write(buffer, function () {
            buffer.fill(3);
            writeStream.write(buffer, function () {
              writeStream.end();
            });
          });
        });
        
        writeStream.on('finish', function () {
          var stream = rfs.createReadStream(appendFileName);
          blobService.createAppendBlobFromStream(containerName, appendBlobName, stream, uploadLength, options, function (err) {
            assert.equal(err, null);
            blobService.getBlobProperties(containerName, appendBlobName, function (getBlobPropertiesErr, blobGetResponse) {
              assert.equal(getBlobPropertiesErr, null);
              assert.notEqual(blobGetResponse, null);
              assert.equal(blobGetResponse.contentLength, uploadLength);
              assert.equal(blobGetResponse.contentSettings.contentMD5, expectedMD5);
  
              done();
            });
          });
        });
      });
  
      runOrSkip('should download a range of append blob to stream', function (done) {
        var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);
        var fileNameSource = testutil.generateId('getAppendBlobRangeStreamLocal', [], suite.isMocked) + '.test';
        var fileSize = 97 * 1024 * 1024;  // Don't be a multiple of 4MB to cover more scenarios
        generateTempFile(fileNameSource, fileSize, true, function (fileInfo) {
          uploadOptions.parallelOperationThreadCount = 5;
          blobService.createAppendBlobFromLocalFile(containerName, blobName, fileNameSource, uploadOptions, function (error) {
            assert.equal(error, null);
            try { fs.unlinkSync(fileNameSource); } catch (e) { }
            
            var downloadOptions = { parallelOperationThreadCount : 5 , rangeStart: 512, rangeEnd: 51199999 };
            var downloadedFileName = testutil.generateId('getAppendBlobRangeStream', [], suite.isMocked) + '.test';
            var stream = fs.createWriteStream(downloadedFileName);
            blobService.getBlobToStream(containerName, blobName, stream, downloadOptions, function (error) {
              assert.equal(error, null);
              
              var content = fs.readFileSync(downloadedFileName);
              assert.equal(content.length, downloadOptions.rangeEnd - downloadOptions.rangeStart + 1);
              delete content;
              try { fs.unlinkSync(downloadedFileName); } catch (e) { }
              done();
            });
          });
        });
      });
    });
  }

  describe('createAppendBlobFromText', function () {
    it('should work for small size from text', function (done) {
      var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked) + ' a';
      var blobText = 'Hello World';
      
      blobService.createAppendBlobFromText(containerName, blobName, blobText, function (uploadError, blobResult, uploadResponse) {
        assert.equal(uploadError, null);
        assert.notEqual(blobResult, null);
        assert.equal(blobResult.appendOffset, 0);
        assert.equal(blobResult.committedBlockCount, 1);
        assert.ok(uploadResponse.isSuccessful);
        
        blobService.getBlobToText(containerName, blobName, function (downloadErr, blobTextResponse) {
          assert.equal(downloadErr, null);
          assert.equal(blobTextResponse, blobText);
          
          done();
        });
      });
    });
    
    it('should store md5', function (done) {
      var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked) + ' a';
      var blobText = 'Hello World';
      var blobMD5 = azureutil.getContentMd5(blobText);
      var options = {
        storeBlobContentMD5: true
      };
      
      blobService.createAppendBlobFromText(containerName, blobName, blobText, options, function (uploadError, blobResult, uploadResponse) {
        assert.equal(uploadError, null);
        assert.notEqual(blobResult, null);
        assert.equal(blobResult.appendOffset, 0);
        assert.equal(blobResult.committedBlockCount, 1);
        assertNoStalePropertyOnBlob(blobResult);
        assert.ok(uploadResponse.isSuccessful);
        
        blobService.getBlobProperties(containerName, blobName, function (error4, blobProperties) {
          assert.equal(error4, null);
          assert.notEqual(blobProperties, null);
          assert.equal(blobProperties.contentSettings.contentMD5, blobMD5);
          
          done();
        });
      });
    });
    
    it('should work with access condition', function (done) {
      var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);
      var blobText = 'hello';
      
      blobService.createAppendBlobFromText(containerName, blobName, blobText, function (error2) {
        assert.equal(error2, null);
        
        blobService.getBlobProperties(containerName, blobName, function (error4, blobProperties) {
          assert.equal(error4, null);
          
          var options = { accessConditions: { EtagNonMatch: blobProperties.etag } };
          blobService.createAppendBlobFromText(containerName, blobName, blobText, options, function (error3) {
            assert.notEqual(error3, null);
            assert.equal(error3.code, Constants.StorageErrorCodeStrings.CONDITION_NOT_MET);
            
            done();
          });
        });
      });
    });
  });

  if (!testutil.isBrowser()) {
    describe('appendFromLocalFile', function () {  
      afterEach(function (done) {
        blobService.deleteBlobIfExists(containerName, appendBlobName, function (error) {
          done();
        });
      });
  
      it('should work with basic file', function (done) {
        appendBlobBuffer.fill(1);
        writeFile(appendFileName, appendBlobBuffer);
  
        var text = appendBlobBuffer.toString();
        blobService.createAppendBlobFromLocalFile(containerName, appendBlobName, appendFileName, function (err, blob) {
          assert.equal(err, null);
          assert.equal(blob.appendOffset, 0);
          assert.equal(blob.committedBlockCount, 1);
          assertNoStalePropertyOnBlob(blob);
  
          blobService.appendFromLocalFile(containerName, appendBlobName, appendFileName, function (err, blob) {
            assert.equal(err, null);
            assert.equal(blob.committedBlockCount, 2);
  
            blobService.appendFromLocalFile(containerName, appendBlobName, appendFileName, function (err, blob) {
              assert.equal(err, null);
              assert.equal(blob.committedBlockCount, 3);
  
              blobService.getBlobToText(containerName, appendBlobName, function (downloadErr, blobTextResponse) {
                assert.equal(downloadErr, null);
                assert.equal(blobTextResponse, text + text + text);
                done();
              });
            });
          });
        });
      });
    });
  
    describe('appendFromStream', function () { 
      afterEach(function (done) {
        blobService.deleteBlobIfExists(containerName, appendBlobName, function (error) {
          done();
        });
      });
  
      it('should append from stream', function (done) {
        appendBlobBuffer.fill(1);
        writeFile(appendFileName, appendBlobBuffer);
  
        var text = appendBlobBuffer.toString();
        blobService.createAppendBlobFromLocalFile(containerName, appendBlobName, appendFileName, function (err, blob) {
          assert.equal(err, null);
          assert.equal(blob.appendOffset, 0);
          assert.equal(blob.committedBlockCount, 1);
          assertNoStalePropertyOnBlob(blob);
  
          appendBlobBuffer.fill(2);
          writeFile(appendFileName, appendBlobBuffer);
          var text1 = appendBlobBuffer.toString();
          var stream1 = rfs.createReadStream(appendFileName);
  
          blobService.appendFromStream(containerName, appendBlobName, stream1, text.length, function (err, blob) {
            assert.equal(err, null);
            assert.equal(blob.committedBlockCount, 2);
  
            appendBlobBuffer.fill(3);
            writeFile(appendFileName, appendBlobBuffer);
            var text2 = appendBlobBuffer.toString();
            var stream2 = rfs.createReadStream(appendFileName);
  
            blobService.appendFromStream(containerName, appendBlobName, stream2, text.length, function (err, blob) {
              assert.equal(err, null);
              assert.equal(blob.committedBlockCount, 3);
  
              blobService.getBlobToText(containerName, appendBlobName, function (downloadErr, blobTextResponse) {
                assert.equal(downloadErr, null);
                assert.equal(blobTextResponse, text + text1 + text2);
                done();
              });
            });
          });
        });
      }); 
      
      it('should append from stream with stream length is part of the stream', function (done) {
        appendBlobBuffer.fill(1);
        writeFile(appendFileName, appendBlobBuffer);
  
        var text = appendBlobBuffer.toString();
        blobService.createAppendBlobFromLocalFile(containerName, appendBlobName, appendFileName, function (err, blob) {
          assert.equal(err, null);
          assert.equal(blob.appendOffset, 0);
          assert.equal(blob.committedBlockCount, 1);
          assertNoStalePropertyOnBlob(blob);
  
          appendBlobBuffer.fill(2);
          writeFile(appendFileName, appendBlobBuffer);
          var text1 = appendBlobBuffer.toString().substring(0, appendBlobBuffer.length - 10);
          var stream1 = rfs.createReadStream(appendFileName);
          var appendLength1 = text1.length;
          
          blobService.appendFromStream(containerName, appendBlobName, stream1, appendLength1, function (err, blob) {
            assert.equal(err, null);
            assert.equal(blob.committedBlockCount, 2);
  
            appendBlobBuffer.fill(3);
            writeFile(appendFileName, appendBlobBuffer);
            var text2 = appendBlobBuffer.toString().substring(0, appendBlobBuffer.length - 20);
            var stream2 = rfs.createReadStream(appendFileName);
            var appendLength2 = text2.length;
            
            blobService.appendFromStream(containerName, appendBlobName, stream2, appendLength2, function (err, blob) {
              assert.equal(err, null);
              assert.equal(blob.committedBlockCount, 3);
  
              blobService.getBlobToText(containerName, appendBlobName, function (downloadErr, blobTextResponse) {
                assert.equal(downloadErr, null);
                assert.equal(blobTextResponse, text + text1 + text2);
                done();
              });
            });
          });
        });
      });
    });
  }

  describe('appendFromText', function () {  
    afterEach(function (done) {
      blobService.deleteBlobIfExists(containerName, appendBlobName, function (error) {
        done();
      });
    });

    skipBrowser('should append plain text', function (done) {
      appendBlobBuffer.fill(1);
      writeFile(appendFileName, appendBlobBuffer);

      var text = appendBlobBuffer.toString();
      blobService.createAppendBlobFromLocalFile(containerName, appendBlobName, appendFileName, function (err, blob) {
        assert.equal(err, null);
        assert.equal(blob.appendOffset, 0);
        assert.equal(blob.committedBlockCount, 1);
        assertNoStalePropertyOnBlob(blob);

        var text1 = 'redblack';
        var text2 = 'yellowblue';
        blobService.appendFromText(containerName, appendBlobName, text1, function (err, blob) {
          assert.equal(err, null);
          assert.equal(blob.committedBlockCount, 2);

          blobService.appendFromText(containerName, appendBlobName, text2, function (err, blob) {
            assert.equal(err, null);
            assert.equal(blob.committedBlockCount, 3);

            blobService.getBlobToText(containerName, appendBlobName, function (downloadErr, blobTextResponse) {
              assert.equal(downloadErr, null);
              assert.equal(blobTextResponse, text + text1 + text2);
              done();
            });
          });
        });
      });
    });
  });

  if (!testutil.isBrowser()) {
    describe('getAppendBlobToFile', function () {
      var appendBlobName = 'appendblob-test-getblob';
      
      it('should work with basic append blob', function (done) {
        appendBlobContentMD5 = writeFile(appendFileName, fileText);
        uploadOptions.storeBlobContentMD5 = true;
        blobService.createAppendBlobFromLocalFile(containerName, appendBlobName, appendFileName, uploadOptions, function (err) {
          assert.equal(err, null);
          
          blobService.getBlobToLocalFile(containerName, appendBlobName, downloadName, function (err, blob) {
            assert.equal(err, null);
            assert.equal(blob.blobType, 'AppendBlob');
            assert.equal(blob.contentSettings.contentMD5, appendBlobContentMD5);
            
            var exists = fs.existsSync(downloadName);
            assert.equal(exists, true);
            
            fs.readFile(downloadName, function (err, text) {
              assert.equal(text, fileText);
              done();
            });
          });
        });
      });
      
      it('should calculate content md5', function (done) {
        appendBlobContentMD5 = writeFile(appendFileName, fileText);
        uploadOptions.storeBlobContentMD5 = true;
        blobService.createAppendBlobFromLocalFile(containerName, appendBlobName, appendFileName, uploadOptions, function (err) {
          assert.equal(err, null);
          
          var options = { disableContentMD5Validation : false };
          blobService.getBlobToLocalFile(containerName, appendBlobName, downloadName, options, function (err, blob) {
            assert.equal(err, null);
            assert.equal(blob.blobType, 'AppendBlob');
            assert.equal(blob.contentSettings.contentMD5, appendBlobContentMD5);
            
            var exists = fs.existsSync(downloadName);
            assert.equal(exists, true);
            
            fs.readFile(downloadName, function (err, text) {
              assert.equal(text, fileText);
              done();
            });
          });
        });
      }); 
    });
  
    describe('getBlockBlobToFile', function() {
      var blockBlobName = 'blockblob-test-getblob';
  
      it('should work with basic block blob', function(done) {
        blockBlobContentMD5 = writeFile(blockFileName, fileText);
        blobService.createBlockBlobFromLocalFile(containerName, blockBlobName, blockFileName, uploadOptions, function (err) {
          assert.equal(err, null);
  
          blobService.getBlobToLocalFile(containerName, blockBlobName, downloadName, function(err, blob) {
            assert.equal(err, null);
            assert.equal(blob.contentSettings.contentMD5, blockBlobContentMD5);
  
            var exists = fs.existsSync(downloadName);
            assert.equal(exists, true);
  
            fs.readFile(downloadName, function (err, text) {
              assert.equal(text, fileText);
              done();
            });
          });
        });
      });
  
      it('should calculate content md5', function(done) {
        blockBlobContentMD5 = writeFile(blockFileName, fileText);
        blobService.createBlockBlobFromLocalFile(containerName, blockBlobName, blockFileName, uploadOptions, function (err) {
          assert.equal(err, null);
  
          var options = {disableContentMD5Validation : false};
          blobService.getBlobToLocalFile(containerName, blockBlobName, downloadName, options, function(err, blob) {
            assert.equal(err, null);
            assert.equal(blob.contentSettings.contentMD5, blockBlobContentMD5);
  
            var exists = fs.existsSync(downloadName);
            assert.equal(exists, true);
  
            fs.readFile(downloadName, function (err, text) {
              assert.equal(text, fileText);
              done();
            });
          });
        });
      });
      
      it('should skip the size check', function(done) {
        blockBlobContentMD5 = writeFile(blockFileName, fileText);
        blobService.createBlockBlobFromLocalFile(containerName, blockBlobName, blockFileName, uploadOptions, function (err) {
          assert.equal(err, null);
  
          var options = {disableContentMD5Validation : false};
          var elapsed1 = new Date().valueOf();
          blobService.getBlobToLocalFile(containerName, blockBlobName, downloadName, options, function(err, blob) {
            elapsed1 = new Date().valueOf() - elapsed1;
            assert.equal(err, null);
            assert.equal(blob.contentSettings.contentMD5, blockBlobContentMD5);
  
            var exists = fs.existsSync(downloadName);
            assert.equal(exists, true);
  
            fs.readFile(downloadName, function (err, text) {
              assert.equal(text, fileText);
              
              var elapsed2 = new Date().valueOf();
              options.skipSizeCheck = true;
              blobService.getBlobToLocalFile(containerName, blockBlobName, downloadName, options, function(err, blob) {
                elapsed2 = new Date().valueOf() - elapsed2;
                assert.ok(suite.isMocked ? true : elapsed1 > elapsed2);
                
                assert.equal(err, null);
                assert.equal(blob.contentSettings.contentMD5, blockBlobContentMD5);
      
                var exists = fs.existsSync(downloadName);
                assert.equal(exists, true);
      
                fs.readFile(downloadName, function (err, text) {
                  assert.equal(text, fileText);
                  done();
                });
              });
            });
          });
        });
      });
      
      it('should download a block blob to a local file in chunks', function (done) {
        var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);
        var fileNameSource = testutil.generateId('getBlockBlobRangeStreamLocal', [], suite.isMocked) + '.test';
        var buffer = new Buffer(4 * 1024 * 1024 + 512); // Don't be a multiple of 4MB to cover more scenarios
        var originLimit = blobService.singleBlobPutThresholdInBytes;
        buffer.fill(0);
        writeFile(fileNameSource, buffer);
        blobService.singleBlobPutThresholdInBytes = 1024 * 1024;
        blobService.createBlockBlobFromLocalFile(containerName, blobName, fileNameSource, uploadOptions, function (error) {
          try { fs.unlinkSync(fileNameSource); } catch (e) { }
          assert.equal(error, null);
          
          var downloadOptions = { parallelOperationThreadCount : 2 };
          var downloadedFileName = testutil.generateId('getBlockBlobRangeStream', [], suite.isMocked) + '.test';
          blobService.getBlobToLocalFile(containerName, blobName, downloadedFileName, downloadOptions, function (error) {
            try { fs.unlinkSync(downloadedFileName); } catch (e) { }
            assert.equal(error, null);
            blobService.singleBlobPutThresholdInBytes = originLimit;
            done();
          });
        });
      });
      
      runOrSkip('should download a block blob to a local file in chunks with anonymous credential', function (done) {
        containerName = testutil.generateId(containerNamesPrefix, containerNames, suite.isMocked);
        var options = {
          publicAccessLevel: 'container'
        };
        
        blobService.createContainerIfNotExists(containerName, options, function (error) {
          assert.equal(error, null);
  
          var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);
          var fileNameSource = testutil.generateId('getBlockBlobRangeStreamLocal', [], suite.isMocked) + '.test';
          var buffer = new Buffer(4 * 1024 * 1024 + 512); // Don't be a multiple of 4MB to cover more scenarios
          var originLimit = blobService.singleBlobPutThresholdInBytes;
          buffer.fill(0);
          writeFile(fileNameSource, buffer);
          blobService.singleBlobPutThresholdInBytes = 1024 * 1024;
          blobService.createBlockBlobFromLocalFile(containerName, blobName, fileNameSource, uploadOptions, function (error) {
            try { fs.unlinkSync(fileNameSource); } catch (e) { }
            assert.equal(error, null);
  
            var anonymousBlobService = azure.createBlobServiceAnonymous(blobService.host).withFilter(new azure.ExponentialRetryPolicyFilter());
            anonymousBlobService.singleBlobPutThresholdInBytes = 1024 * 1024;
            
            var downloadOptions = { parallelOperationThreadCount : 2 };
            var downloadedFileName = testutil.generateId('getBlockBlobRangeStream', [], suite.isMocked) + '.test';
            anonymousBlobService.getBlobToLocalFile(containerName, blobName, downloadedFileName, downloadOptions, function (error) {
              try { fs.unlinkSync(downloadedFileName); } catch (e) { }
              assert.equal(error, null);
              blobService.singleBlobPutThresholdInBytes = originLimit;
              done();
            });
          });
        });
      });
    });
  
    describe('getPageBlobToFile', function() {
      var pageBlobName = 'pageblob-test-getblob';
  
      it('should work with basic page blob', function(done) {
        pageBlobBuffer.fill(1);
        pageBlobContentMD5 = writeFile(pageFileName, pageBlobBuffer);
        blobService.createPageBlobFromLocalFile(containerName, pageBlobName, pageFileName, {storeBlobContentMD5: true}, function (err) {
          assert.equal(err, null);
          blobService.getBlobToLocalFile(containerName, pageBlobName, downloadName, function(err, blob) {
            assert.equal(err, null);
            assert.equal(blob.contentSettings.contentMD5, pageBlobContentMD5);
  
            var exists = fs.existsSync(downloadName);
            assert.equal(exists, true);
  
            fs.readFile(downloadName, function (err, text) {
              assert.equal(text.toString(), pageBlobBuffer.toString());
              done();
            });
          });
        });
      });
  
      it('should calculate content md5', function(done) {
        pageBlobBuffer.fill(1);
        pageBlobContentMD5 = writeFile(pageFileName, pageBlobBuffer);
        blobService.createPageBlobFromLocalFile(containerName, pageBlobName, pageFileName, {storeBlobContentMD5: true}, function (err) {
          assert.equal(err, null);        
          var options = {disableContentMD5Validation : false};
          blobService.getBlobToLocalFile(containerName, pageBlobName, downloadName, options, function(err, blob) {
            assert.equal(err, null);
            assert.equal(blob.contentSettings.contentMD5, pageBlobContentMD5);
  
            var exists = fs.existsSync(downloadName);
            assert.equal(exists, true);
  
            fs.readFile(downloadName, function (err, text) {
              assert.equal(text.toString(), pageBlobBuffer.toString());
              done();
            });
          });
        });
      });
    });
    
    describe('createWriteStreamToBlob', function() {
      it('should work with basic stream for block blob', function(done) {
        var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);
        var fileNameTarget = testutil.generateId('createWriteStreamToBlockBlob', [], suite.isMocked) + '.blocktest';
        var blobBuffer = new Buffer(99);
        blobBuffer.fill(1);
  
        // Write file so that it can be piped
        fs.writeFileSync(fileNameTarget, blobBuffer);
        
        // Pipe file to a blob
        var stream = rfs.createReadStream(fileNameTarget).pipe(blobService.createWriteStreamToBlockBlob(containerName, blobName, { blockIdPrefix: 'block' }));
        stream.on('close', function () {
          blobService.getBlobToText(containerName, blobName, function (err, text) {
            assert.equal(err, null);
            assert.equal(text, blobBuffer);
            try { fs.unlinkSync(fileNameTarget); } catch (e) {}
            done();
          });
        });
      });
      
      it('should throw error with basic stream for page blob when the length is not a multiple of 512', function(done) {
        var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);
        var fileNameTarget = testutil.generateId('createWriteStreamToPageBlob', [], suite.isMocked) + '.pagetest';
        var length = 99;
        var blobBuffer = new Buffer(length);
        blobBuffer.fill('b');
        // Write file so that it can be piped
        fs.writeFileSync(fileNameTarget, blobBuffer);
        // Pipe file to a blob
        assert.throws(function() {
          rfs.createReadStream(fileNameTarget).pipe(blobService.createWriteStreamToNewPageBlob(containerName, blobName, length));
        }, function(err) {
          return (err instanceof RangeError) && err.message === 'Page blob length must be multiple of 512.';
        });
        
        done();
      });
      
      it('should work with basic stream for page blob', function(done) {
        var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);
        var fileNameTarget = testutil.generateId('createWriteStreamToPageBlob', [], suite.isMocked) + '.pagetest';
        var length = 2 * 1024 * 1024;
        var blobBuffer = new Buffer(length);
        blobBuffer.fill('a');
        pageBlobContentMD5 = writeFile(fileNameTarget, blobBuffer);
        var readable = rfs.createReadStream(fileNameTarget);
        var stream = blobService.createWriteStreamToNewPageBlob(containerName, blobName, length, {storeBlobContentMD5: true});
        readable.pipe(stream);
        stream.on('close', function () {
          blobService.getBlobToText(containerName, blobName, function (err, text) {
            assert.equal(err, null);
            assert.equal(text, blobBuffer);
            try { fs.unlinkSync(fileNameTarget); } catch (e) {}
            done();
          });
        });
      });
      
      it('should work with basic stream for append blob', function(done) {
        var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);
        var fileNameTarget = testutil.generateId('createWriteStreamToAppendBlob', [], suite.isMocked) + '.appendtest';
        var length = 2 * 1024 * 1024;
        var blobBuffer = new Buffer(length);
        blobBuffer.fill('a');
        pageBlobContentMD5 = writeFile(fileNameTarget, blobBuffer);
        var readable = rfs.createReadStream(fileNameTarget);
        var stream = blobService.createWriteStreamToNewAppendBlob(containerName, blobName, length);
        readable.pipe(stream);
        stream.on('close', function () {
          blobService.getBlobToText(containerName, blobName, function (err, text) {
            assert.equal(err, null);
            assert.equal(text, blobBuffer);
            try { fs.unlinkSync(fileNameTarget); } catch (e) {}
            done();
          });
        });
      });
  
      it('should work with string for block blob', function(done) {
        var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);
        var content = 'plainstring';
        var stream = blobService.createWriteStreamToBlockBlob(containerName, blobName, { blockIdPrefix: 'block' });
        stream.write(content, 'utf-8');
        stream.end();
        stream.on('finish', function () {
          blobService.getBlobToText(containerName, blobName, function (err, text) {
            blobService.logger.level = azure.Logger.LogLevels.INFO;
            assert.equal(err, null);
            assert.equal(text, content);
            done();
          });
        });
      });
    });
  }
});