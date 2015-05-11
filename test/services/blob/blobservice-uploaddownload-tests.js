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
var azureutil = testutil.libRequire('/common/util/util');
var azure = testutil.libRequire('azure-storage');
var rfs = testutil.libRequire('common/streams/readablefs');
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
var containerName;
var containerNamePrefix = 'upload-download-test';
var blockIdPrefix = 'block';
var containerCount = 0;
var containerName = '';

var blockBlobName = 'blockblob_nodesdktest';
var pageBlobName = 'pageblob_nodesdktest';

var blockFileName = 'blobservice_test_block.tmp';
var pageFileName = 'blobservice_test_page.tmp';
var page2KFileName = 'blobservice_test_2K_page.tmp';
var notExistFileName = 'blobservice_not_exist.tmp';
var zeroSizeFileName = 'blobservice_zero_size_file.tmp';
var downloadName = 'blobservice_download.tmp';

var fileText = 'Hello World!';
var pageBlobBuffer = new Buffer(1 * 1024);
var pageBlob2KBuffer = new Buffer(2 * 1024);
var blockBlobContentMD5 = null;
var pageBlobContentMD5 = '';
var pageBlob2KContentMD5 = '';
var uploadOptions = {
  blockIdPrefix : blockIdPrefix
};

var suite = new TestSuite('blobservice-uploaddownload-tests');
var runOrSkip = suite.isMocked ? it.skip : it;

function writeFile(fileName, content) {
  fs.writeFileSync(fileName, content);
  var md5hash = crypto.createHash('md5');
  md5hash.update(content);
  return md5hash.digest('base64');
}

var generateTempFile = function (fileName, size, hasEmptyBlock, callback) {
  var blockSize = 4 * 1024 * 1024;
  var fileInfo = { name: fileName, contentMD5: '', size: size };

  var md5hash = crypto.createHash('md5');
  var offset = 0;
  var file = fs.openSync(fileName, 'w');
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
  } while(size > 0);
      
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
  } while(bytesRead > 0);

  fileInfo.contentMD5 = md5hash.digest('base64');
  callback(fileInfo);
};

describe('blob-uploaddownload-tests', function () {
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
    try { fs.unlinkSync(blockFileName); } catch (e) {}
    try { fs.unlinkSync(pageFileName); } catch (e) {}
    try { fs.unlinkSync(page2KFileName); } catch (e) {}
    try { fs.unlinkSync(notExistFileName); } catch (e) {}
    try { fs.unlinkSync(zeroSizeFileName); } catch (e) {}
    try { fs.unlinkSync(downloadName); } catch (e) {}
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

    // Create the empty page blob
    blobService.createBlockBlobFromText(containerName, blobName, blobText, function (err) {
      assert.equal(err, null);

      blobService.getBlobProperties(containerName, blobName, function (error, properties) {
        assert.equal(error, null);
        assert.equal(properties.container, containerName);
        assert.equal(properties.blob, blobName);

        done();
      });
    });
  });

  // This test ensures that blocks can be created from files correctly
  // and was created to ensure that the request module does not magically add
  // a content type to the request when the user did not specify one.
  it('works with files without specifying content type', function (done) {
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

  describe('blob-piping-tests', function() {
    runOrSkip('should be able to upload block blob from piped stream', function (done) { 
      var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);
      var fileNameTarget = testutil.generateId('uploadBlockBlobPiping', [], suite.isMocked) + '.blocktest';
      var blobBuffer = new Buffer( 6 * 1024 * 1024);
      blobBuffer.fill(1);

      fs.writeFileSync(fileNameTarget, blobBuffer);

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

    runOrSkip('should be able to upload pageblob from piped stream', function (done) {
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

    runOrSkip('should be able to upload a pageblob from piped stream and store the MD5 on the server', function (done) {
      containerName = testutil.generateId(containerNamesPrefix, containerNames, suite.isMocked);
      var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);
      var fileNameTarget = testutil.generateId('uploadPageBlobMD5Piping', [], suite.isMocked) + '.test';
      var blobBuffer = new Buffer( 3 * 1024 * 1024 );
      blobBuffer.fill(1);

      blobService.createContainer(containerName, function (createError1, container1) {
        assert.equal(createError1, null);
        assert.notEqual(container1, null);

        // Write file so that it can be piped
        pageBlobContentMD5 = writeFile(fileNameTarget, blobBuffer);

        blobService.createPageBlob(containerName, blobName, 3 * 1024 * 1024, function (err) {
          assert.equal(err, null);
          // Pipe file to a blob
          var stream = blobService.createWriteStreamToExistingPageBlob(containerName, blobName, {storeBlobContentMD5: true});
          var readable = rfs.createReadStream(fileNameTarget);
          readable.pipe(stream);
          stream.on('close', function () {
            blobService.getBlobProperties(containerName, blobName, function (err, blob) {
              assert.equal(err, null);
              assert.equal(blob.contentMD5, pageBlobContentMD5);

              try { fs.unlinkSync(fileNameTarget); } catch (e) {}
              done();
            });
          });
        });
      });
    });

    runOrSkip('should be able to upload new page blob from piped stream', function (done) {
      var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);
      var fileNameTarget = testutil.generateId('uploadPageBlobStreamPiping', [], suite.isMocked) + '.test';
      var blobBuffer = new Buffer( 6 * 1024 * 1024 );
      blobBuffer.fill(1);

      // Write file so that it can be piped
      fs.writeFile(fileNameTarget, blobBuffer, function() {
        // Pipe file to a blob
        var stream = blobService.createWriteStreamToNewPageBlob(containerName, blobName, 6 * 1024 * 1024);
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

    runOrSkip('should be able to download blob to piped stream', function (done) {
      var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);
      var sourceFileNameTarget = testutil.generateId('getBlobSourceFile', [], suite.isMocked) + '.test';
      var destinationFileNameTarget = testutil.generateId('getBlobDestinationFile', [], suite.isMocked) + '.test';

      var blobBuffer = new Buffer( 5 * 1024 );
      blobBuffer.fill(1);

      fs.writeFileSync(sourceFileNameTarget, blobBuffer);

      blobService.createPageBlobFromStream(containerName, blobName, rfs.createReadStream(sourceFileNameTarget), 5 * 1024, function(uploadError) {
        assert.equal(uploadError, null);
        var writable = fs.createWriteStream(destinationFileNameTarget);
        blobService.createReadStream(containerName, blobName).pipe(writable);

        writable.on('close', function () {
          var exists = azureutil.pathExistsSync(destinationFileNameTarget);
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
    
    it('should emit error events when using piped streams', function (done) {
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
  });

  describe('blob-rangedownload-tests', function() {
    it('getBlobRange', function (done) {
      var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);
      var data1 = 'Hello, World!';

      // Create the empty page blob
      blobService.createBlockBlobFromText(containerName, blobName, data1, function (err) {
        assert.equal(err, null);

        blobService.getBlobToText(containerName, blobName, { rangeStart: 2, rangeEnd: 3 }, function (err3, content1) {
          assert.equal(err3, null);

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

        blobService.getBlobToText(containerName, blobName, { rangeStart: 2 }, function (err3, content1) {
          assert.equal(err3, null);

          // get the last bytes from the message
          assert.equal(content1, 'llo, World!');

          done();
        });
      });
    });

    it('getPageRanges', function (done) {
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

              blobService.createPagesFromStream(containerName, blobName, rfs.createReadStream(fileNameSource), 1048576, 1049087, {contentMD5: azureutil.getContentMd5(blobBuffer)}, function (err3) {
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
  });
  
  describe('CreateBlock', function() {
    it('createBlockFromStream should work without useTransactionalMD5', function(done) {
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

    it('CommitBlockList', function (done) {
      var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);

      blobService.createBlockFromText('id1', containerName, blobName, 'id1', function (error2) {
        assert.equal(error2, null);

        blobService.createBlockFromText('id2', containerName, blobName, 'id2', function (error3) {
          assert.equal(error3, null);

          var blockList = {
            LatestBlocks: ['id1'],
            UncommittedBlocks: ['id2']
          };

          blobService.commitBlocks(containerName, blobName, blockList, function (error4) {
            assert.equal(error4, null);

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

          blobService.commitBlocks(containerName, blobName, blockList, function (error4) {
            assert.equal(error4, null);

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
  });

  describe('blob-MD5Validation-tests', function() {
    runOrSkip('Upload/Download with MD5 validation should work', function (done) {
      var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);
      var fileNameSource = testutil.generateId('MD5Validation', [], suite.isMocked) + '.test';

      var blobBuffer = new Buffer(5 * 1024 * 1024);
      blobBuffer.fill(0);
      blobBuffer[0] = '1';

      fs.writeFile(fileNameSource, blobBuffer, function () {

        var blobOptions = { contentType: 'text', blockIdPrefix : 'blockId'};
        blobService.createBlockBlobFromLocalFile(containerName, blobName, fileNameSource, blobOptions, function (uploadError, blobResponse, uploadResponse) {
          assert.equal(uploadError, null);
          assert.notEqual(blobResponse, null);
          assert.ok(uploadResponse.isSuccessful);

          // Set disableContentMD5Validation to false explicitly.
          blobService.getBlobToStream(containerName, blobName, fs.createWriteStream('task1-download.txt'), { disableContentMD5Validation: false }, function (downloadErr, downloadResult) {
            assert.equal(downloadErr, null);
            assert.strictEqual(downloadResult.contentMD5, 'ndpxhuSh0PPmMvK74fkYvg==');

            // Don't set disableContentMD5Validation explicitly. Since this is a block blob, the response will still contain the Content-MD5.
            blobService.getBlobToStream(containerName, blobName, fs.createWriteStream('task2-download.txt'), function (downloadErr, downloadResult) {
              assert.equal(downloadErr, null);
              assert.strictEqual(downloadResult.contentMD5, 'ndpxhuSh0PPmMvK74fkYvg==');

              blobService.getBlobProperties(containerName, blobName, function (getBlobPropertiesErr, blobGetResponse) {
                assert.equal(getBlobPropertiesErr, null);
                assert.notEqual(blobGetResponse, null);
                if (blobGetResponse) {
                  assert.equal(blobOptions.contentType, blobGetResponse.contentType);
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

    runOrSkip('BlockBlobDownloadWithAndWithoutMD5Validation', function (done) {
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

            var setPropertiesOptions = {contentMD5: 'MDAwMDAwMDA='};
            blobService.setBlobProperties(containerName, blobName, setPropertiesOptions, function (setBlobPropertiesErr) {
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
    
    runOrSkip('PageBlobDownloadWithAndWithoutMD5Validation', function (done) {
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

            var setPropertiesOptions = {contentMD5: 'MDAwMDAwMDA='};
            blobService.setBlobProperties(containerName, blobName, setPropertiesOptions, function (setBlobPropertiesErr) {
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
    
    runOrSkip('BlockBlobDownloadRangeValidation', function (done) {
      var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);
      var fileNameSource = testutil.generateId('getBlockBlobRange', [], suite.isMocked) + '.test';

      var blobBuffer = new Buffer(5 * 1024 * 1024);
      blobBuffer.fill(0);
      blobBuffer[0] = '1';

      fs.writeFile(fileNameSource, blobBuffer, function () {
        var blobOptions = { contentType: 'text', blockIdPrefix : 'blockId'};
        blobService.createBlockBlobFromLocalFile(containerName, blobName, fileNameSource, blobOptions, function (uploadError, blobResponse, uploadResponse) {
          assert.equal(uploadError, null);
          assert.notEqual(blobResponse, null);
          assert.ok(uploadResponse.isSuccessful);

          blobService.getBlobToStream(containerName, blobName, fs.createWriteStream('task1-download.txt'), { rangeStart: 512, rangeEnd: 1023 }, function (downloadErr, downloadResult) {
            assert.equal(downloadErr, null);
            assert.strictEqual(parseInt(downloadResult.contentLength, 10), 512);
            blobService.getBlobToStream(containerName, blobName, fs.createWriteStream('task1-download.txt'), { rangeStart: 512, rangeEnd: 1023, useTransactionalMD5: true }, function (downloadErr, downloadResult) {
              assert.equal(downloadErr, null);
              assert.strictEqual(parseInt(downloadResult.contentLength, 10), 512);
              assert.strictEqual(downloadResult.contentMD5, 'v2GerAzfP2jUluqTRBN+iw==');
              try { fs.unlinkSync(fileNameSource); } catch (e) {}

              done();
            });
          });
        });
      });
    });
  
    runOrSkip('PageBlobDownloadRangeValidation', function (done) {
      var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);
      var fileNameSource = testutil.generateId('getPageBlobRange', [], suite.isMocked) + '.test';

      var blobBuffer = new Buffer(5 * 1024 * 1024);
      blobBuffer.fill(0);
      blobBuffer[0] = '1';

      fs.writeFile(fileNameSource, blobBuffer, function () {
        var blobOptions = { contentType: 'text', blockIdPrefix : 'blockId'};
        blobService.createPageBlobFromLocalFile(containerName, blobName, fileNameSource, blobOptions, function (uploadError, blobResponse, uploadResponse) {
          assert.equal(uploadError, null);
          assert.notEqual(blobResponse, null);
          assert.ok(uploadResponse.isSuccessful);

          blobService.getBlobToStream(containerName, blobName, fs.createWriteStream('task1-download.txt'), { rangeStart: 0, rangeEnd: 511, useTransactionalMD5: true }, function (downloadErr, downloadResult) {
            assert.equal(downloadErr, null);
            assert.strictEqual(parseInt(downloadResult.contentLength, 10), 512);
            blobService.getBlobToStream(containerName, blobName, fs.createWriteStream('task1-download.txt'), { rangeStart: 512, rangeEnd: 1023, useTransactionalMD5: true }, function (downloadErr, downloadResult) {
              assert.equal(downloadErr, null);
              assert.strictEqual(parseInt(downloadResult.contentLength, 10), 512);
              assert.strictEqual(downloadResult.contentMD5, 'v2GerAzfP2jUluqTRBN+iw==');

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
          assert.equal(result.contentMD5, 'ZajifYh5KDgxtmS9i38K1A==');
          
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
          assert.equal(blobProperties.contentMD5, blobMD5);

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

          var options = { accessConditions: { 'if-none-match': blobProperties.etag} };
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

      blobService.createBlockBlobFromText(containerName, blobName, blobText, {storeBlobContentMD5: true, contentMD5: blobMD5}, function (uploadError, blob, uploadResponse) {
        assert.equal(uploadError, null);
        assert.notEqual(blob, null);
        assert.equal(blob.contentMD5, blobMD5);
        assert.ok(uploadResponse.isSuccessful);

        blobService.getBlobToText(containerName, blobName, function (downloadErr, blobTextResponse) {
          assert.equal(downloadErr, null);
          assert.equal(blobTextResponse, blobText);

          done();
        });
      });
    });
  });

  describe('CreateBlockBlobFromFile', function() {
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
      blobService.createBlockBlobFromLocalFile(containerName, blockBlobName, blockFileName, uploadOptions, function (err) {
        assert.equal(err, null);
        blobService.getBlobProperties(containerName, blockBlobName, function (err, blob) {
          assert.equal(blob.contentMD5, blockBlobContentMD5);

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
          assert.equal(blob.contentMD5, zeroFileContentMD5);
          done();
        });
      });
    });

    it('should work with content type', function (done) {
      var blobOptions = { contentType: 'text' };
      blobService.createBlockBlobFromLocalFile(containerName, blockBlobName, blockFileName, blobOptions, function (uploadError, blobResponse, uploadResponse) {
        assert.equal(uploadError, null);
        assert.notEqual(blobResponse, null);
        assert.ok(uploadResponse.isSuccessful);

        blobService.getBlobProperties(containerName, blockBlobName, function (getBlobPropertiesErr, blobGetResponse) {
          assert.equal(getBlobPropertiesErr, null);
          assert.notEqual(blobGetResponse, null);
          assert.equal(blobOptions.contentType, blobGetResponse.contentType);
          done();
        });
      });
    });

    it('should work with not existing file', function(done) {
      blobService.createBlockBlobFromLocalFile(containerName, blockBlobName, notExistFileName, uploadOptions, function (err) {
        assert.notEqual(err, null);
        assert.equal(path.basename(err.path), notExistFileName);

        blobService.doesBlobExist(containerName, blockBlobName, function (existsErr, exists) {
          assert.equal(existsErr, null);
          assert.equal(exists, false);
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
          assert.equal(blob.contentMD5, zeroFileContentMD5);  
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
            assert.strictEqual(blobProperties.contentMD5, baseMD5);
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
            assert.strictEqual(blobProperties.contentMD5, baseMD5);
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
  
  runOrSkip('should download a range of block blob to stream', function (done) {
    var blobName = testutil.generateId(blobNamesPrefix, blobNames, suite.isMocked);
    var fileNameSource = testutil.generateId('getBlockBlobRangeStreamLocal', [], suite.isMocked) + '.test';
    var fileSize = 97 * 1024 * 1024;  // Don't be a multiple of 4MB to cover more scenarios
    generateTempFile(fileNameSource, fileSize, false, function (fileInfo) {
      uploadOptions.parallelOperationThreadCount = 5;
      blobService.createBlockBlobFromLocalFile(containerName, blobName, fileNameSource, uploadOptions, function (error) {
        assert.equal(error, null);
        try { fs.unlinkSync(fileNameSource); } catch (e) { }
        
        var downloadOptions = { parallelOperationThreadCount : 5, rangeStart: 100, rangeEnd: 70000000 };
        var downloadedFileName = testutil.generateId('getBlockBlobRangeStream', [], suite.isMocked) + '.test';
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
  
  describe('CreateBlockBlobFromStream', function() {
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
      blobService.createBlockBlobFromStream(containerName, blockBlobName, stream, len, uploadOptions, function (err) {
        assert.equal(err, null);
        blobService.getBlobProperties(containerName, blockBlobName, function(err, blob) {
          assert.equal(blob.contentMD5, blockBlobContentMD5);

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
        blockIdPrefix : blockIdPrefix,
        contentMD5 : blockBlobContentMD5
      };

      blobService.createBlockBlobFromStream(containerName, blockBlobName, stream, len, options, function (err) {
        assert.equal(err, null);
        blobService.getBlobProperties(containerName, blockBlobName, function(err, blob) {
          assert.equal(blob.contentMD5, blockBlobContentMD5);
          done();
        });
      });
    });

    it('should work with the speed summary in options', function(done) {
      var speedSummary = new azure.BlobService.SpeedSummary();
      var options = {
        blockIdPrefix : blockIdPrefix,
        speedSummary : speedSummary
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
      var blobOptions = { contentType: 'text'};

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
            assert.equal(blobOptions.contentType, blobGetResponse.contentType);

            done();
          });
        });
      });
    });

    runOrSkip('should work with parallelOperationsThreadCount in options', function(done) {
      var options = {
        blockIdPrefix : blockIdPrefix,
        parallelOperationThreadCount : 4
      };

      var buffer = new Buffer(30 * 1024 * 1024);
      buffer.fill(1);
      var writeStream = fs.createWriteStream(blockFileName);
      writeStream.write(buffer);
      writeStream.write(buffer);
      writeStream.write(buffer);

      var stream = rfs.createReadStream(blockFileName);
      blobService.createBlockBlobFromStream(containerName, blockBlobName, stream, buffer.length * 3, options, function (err) {
        assert.equal(err, null);

        blobService.getBlobProperties(containerName, blockBlobName, function (getBlobPropertiesErr, blobGetResponse) {
          assert.equal(getBlobPropertiesErr, null);
          assert.notEqual(blobGetResponse, null);
          assert.equal(blobGetResponse.contentLength, buffer.length * 3);

          done();
        });
      });
    });
  });

  describe('CreatePageBlobFromFile', function() {
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
      blobService.createPageBlobFromLocalFile(containerName, pageBlobName, pageFileName, function (err) {
        assert.equal(err, null);
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
          assert.equal(blob.contentMD5, pageBlobContentMD5);
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
          assert.equal(blob1.contentMD5, pageBlobContentMD5);
          assert.equal(blob1.contentLength, 1024);
          options.contentMD5Header = null;

          blobService.createPageBlobFromLocalFile(containerName, pageBlobName, page2KFileName, options, function (err3) {
            assert.equal(err3, null);

            blobService.getBlobProperties(containerName, pageBlobName, function (err4, blob2) {
              assert.equal(err4, null);
              assert.notEqual(blob2, null);
              assert.equal(blob2.contentLength, 2 * 1024);
              assert.equal(blob2.contentMD5, pageBlob2KContentMD5);
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
          assert.equal(blob.contentMD5, zeroFileContentMD5);
          done();
        });
      });
    });

    it('should work with not existing file', function(done) {
      blobService.createPageBlobFromLocalFile(containerName, pageBlobName, notExistFileName, uploadOptions, function (err) {
        assert.notEqual(err, null);
        assert.equal(path.basename(err.path), notExistFileName);

        blobService.doesBlobExist(containerName, pageBlobName, function (existsErr, exists) {
          assert.equal(existsErr, null);
          assert.equal(exists, false);
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
          assert.equal(blob.contentMD5, zeroFileContentMD5);  
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
            assert.strictEqual(blobProperties.contentMD5, baseMD5);
            
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
            assert.strictEqual(blobProperties.contentMD5, baseMD5);

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
        blobService.createPageBlobFromLocalFile(containerName, blobName, fileNameSource, uploadOptions, function (error) {
          assert.equal(error, null);
          try { fs.unlinkSync(fileNameSource); } catch (e) { }
          
          var downloadOptions = { parallelOperationThreadCount : 5 , rangeStart: 512, rangeEnd: 51199999 };
          var downloadedFileName = testutil.generateId('getPageBlobRangeStream', [], suite.isMocked) + '.test';
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

  describe('CreatePageBlobFromStream', function() {
    //Most cases are in CreatePageBlobFromFile
    it('should work with basic file', function(done) {
      var stream = rfs.createReadStream(pageFileName);
      blobService.createPageBlobFromStream(containerName, pageBlobName, stream, 1024, function (err) {
        assert.equal(err, null);

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

  describe('GetBlockBlobToFile', function() {
    var blockBlobName = 'blockblob-test-getblob';

    it('should work with basic block blob', function(done) {
      blockBlobContentMD5 = writeFile(blockFileName, fileText);
      blobService.createBlockBlobFromLocalFile(containerName, blockBlobName, blockFileName, uploadOptions, function (err) {
        assert.equal(err, null);

        blobService.getBlobToLocalFile(containerName, blockBlobName, downloadName, function(err, blob) {
          assert.equal(err, null);
          assert.equal(blob.contentMD5, blockBlobContentMD5);

          var exists = azureutil.pathExistsSync(downloadName);
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
          assert.equal(blob.contentMD5, blockBlobContentMD5);

          var exists = azureutil.pathExistsSync(downloadName);
          assert.equal(exists, true);

          fs.readFile(downloadName, function (err, text) {
            assert.equal(text, fileText);
            done();
          });
        });
      });
    });
  });

  describe('GetPageBlobToFile', function() {
    var pageBlobName = 'pageblob-test-getblob';

    it('should work with basic page blob', function(done) {
      pageBlobBuffer.fill(1);
      pageBlobContentMD5 = writeFile(pageFileName, pageBlobBuffer);
      blobService.createPageBlobFromLocalFile(containerName, pageBlobName, pageFileName, {storeBlobContentMD5: true}, function (err) {
        assert.equal(err, null);
        blobService.getBlobToLocalFile(containerName, pageBlobName, downloadName, function(err, blob) {
          assert.equal(err, null);
          assert.equal(blob.contentMD5, pageBlobContentMD5);

          var exists = azureutil.pathExistsSync(downloadName);
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
          assert.equal(blob.contentMD5, pageBlobContentMD5);

          var exists = azureutil.pathExistsSync(downloadName);
          assert.equal(exists, true);

          fs.readFile(downloadName, function (err, text) {
            assert.equal(text.toString(), pageBlobBuffer.toString());
            done();
          });
        });
      });
    });
  });
});