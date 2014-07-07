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
var fs = require('fs');
var util = require('util');
var crypto = require('crypto');
var path = require('path');

// Lib includes
var testutil = require('../../framework/util');
var SR = testutil.libRequire('common/util/sr');
var azureutil = testutil.libRequire('/common/util/util');

var azure = testutil.libRequire('azure-storage');

var Constants = azure.Constants;
var HttpConstants = Constants.HttpConstants;
var HeaderConstants = Constants.HeaderConstants;

var shareNamesPrefix = 'share-';
var directoryNamesPrefix = 'dir-';
var fileNamesPrefix = 'file-';

var localFileName = 'fileservice_test_block.tmp';
var notExistFileName = 'fileservice_not_exist.tmp';
var zeroSizeFileName = 'fileservice_zero_size_file.tmp';
var downloadFileName = 'fileservice_download.tmp';

var fileService;
var shareName;
var directoryName;
var fileName;

function writeFile(fileName, content) {
  fs.writeFileSync(fileName, content);
  var md5hash = crypto.createHash('md5');
  md5hash.update(content);
  return md5hash.digest('base64');
}

describe('FileUploadDownload', function () {
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
  	try { fs.unlinkSync(localFileName); } catch (e) {}
    try { fs.unlinkSync(notExistFileName); } catch (e) {}
    try { fs.unlinkSync(zeroSizeFileName); } catch (e) {}
    try { fs.unlinkSync(downloadFileName); } catch (e) {}
    fileService.deleteShareIfExists(shareName, function (deleteError) {
      assert.equal(deleteError, null);
      done();
    });
  });

  beforeEach(function (done) {
    fileName = getName(fileNamesPrefix);
    done();
  });

  describe('createWriteStream', function() {
     it('existing file', function (done) {
      var fileBuffer = new Buffer( 5 * 1024 * 1024 );
      fileBuffer.fill(1);

      // Write file so that it can be piped
      fs.writeFile(localFileName, fileBuffer, function() {
        fileService.createFile(shareName, directoryName, fileName, 5 * 1024 * 1024, function (err) {
          assert.equal(err, null);
          // Pipe file to a file
          var stream = fileService.createWriteStreamToExistingFile(shareName, directoryName, fileName);
          var readable = fs.createReadStream(localFileName);
          readable.pipe(stream);
          stream.on('close', function () {
            fileService.getFileToText(shareName, directoryName, fileName, function (err, text) {
              assert.equal(err, null);
              assert.equal(text, fileBuffer);
              done();
            });
          });
        });
      });
    });

    it('new file', function (done) {
      var fileBuffer = new Buffer( 6 * 1024 * 1024 );
      fileBuffer.fill(1);

      // Write file so that it can be piped
      fs.writeFile(localFileName, fileBuffer, function() {
        // Pipe file to a file
        var stream = fileService.createWriteStreamToNewFile(shareName, directoryName, fileName, 6 * 1024 * 1024);
        var readable = fs.createReadStream(localFileName);
        readable.pipe(stream);
        stream.on('close', function () {
          fileService.getFileToText(shareName, directoryName, fileName, function (err, text) {
            assert.equal(err, null);
            assert.equal(text, fileBuffer);
            done();
          });
        });
      });
    });

    it('store the MD5 on the server', function (done) {
      var fileBuffer = new Buffer( 3 * 1024 * 1024 );
      fileBuffer.fill(1);

      // Write file so that it can be piped
      fileContentMD5 = writeFile(localFileName, fileBuffer);

      fileService.createFile(shareName, directoryName, fileName, 3 * 1024 * 1024, function (err) {
        assert.equal(err, null);
        // Pipe file to a file
        var stream = fileService.createWriteStreamToExistingFile(shareName, directoryName, fileName, {storeFileContentMD5: true});
        var readable = fs.createReadStream(localFileName);
        readable.pipe(stream);
        stream.on('close', function () {
          fileService.getFileProperties(shareName, directoryName, fileName, function (err, file) {
            assert.equal(err, null);
            assert.equal(file.contentMD5, fileContentMD5);
            done();
          });
        });
      });
    });

    it('should emit error events', function (done) {
    	var fileText = "Hello, world!"
    	writeFile(localFileName, fileText);

      var stream = fileService.createWriteStreamToExistingFile(shareName, directoryName, fileName);
      stream.on('error', function (error) {
        assert.equal(error.code, 'ResourceNotFound');
        assert.equal(error.statusCode, '404');
        assert.notEqual(error.requestId, null);
        done();
      });

      fs.createReadStream(localFileName).pipe(stream);
    });
  });

  describe('createReadStream', function() {
    it('download file', function (done) {
      var sourceFileNameTarget = testutil.generateId('getFileSourceFile', [], false) + '.test';
      var destinationFileNameTarget = testutil.generateId('getFileDestinationFile', [], false) + '.test';

      var fileBuffer = new Buffer( 5 * 1024 );
      fileBuffer.fill(1);

      fs.writeFileSync(sourceFileNameTarget, fileBuffer);

      fileService.createFileFromStream(shareName, directoryName, fileName, fs.createReadStream(sourceFileNameTarget), 5 * 1024, function (uploadError, file, uploadResponse) {
	      assert.equal(uploadError, null);
	      assert.ok(file);
	      assert.ok(uploadResponse.isSuccessful);

        var writable = fs.createWriteStream(destinationFileNameTarget);
        fileService.createReadStream(shareName, directoryName, fileName).pipe(writable);

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
    
    it('should emit error events', function (done) {
      var stream = fileService.createReadStream(shareName, directoryName, fileName);
      stream.on('error', function (error) {
        assert.equal(error.code, 'NotFound');
        assert.equal(error.statusCode, '404');
        assert.notEqual(error.requestId, null);

        done();
      });

      stream.pipe(fs.createWriteStream(downloadFileName));
    });
  });

  describe('getFileRange', function() {
    it('getFileRange', function (done) {
      var data1 = 'Hello, World!';

      // Create the empty file
      fileService.createFileFromText(shareName, directoryName, fileName, data1, function (err) {
        assert.equal(err, null);

        fileService.getFileToText(shareName, directoryName, fileName, { rangeStart: 2, rangeEnd: 3 }, function (err3, content1) {
          assert.equal(err3, null);

          // get the double ll's in the hello
          assert.equal(content1, 'll');

          done();
        });
      });
    });

    it('getFileRangeOpenEnded', function (done) {
      var data1 = 'Hello, World!';

      // Create the empty file
      fileService.createFileFromText(shareName, directoryName, fileName, data1, function (err) {
        assert.equal(err, null);

        fileService.getFileToText(shareName, directoryName, fileName, { rangeStart: 2 }, function (err3, content1) {
          assert.equal(err3, null);

          // get the last bytes from the message
          assert.equal(content1, 'llo, World!');

          done();
        });
      });
    });
  });

	describe('createRangesFromStream', function() {
    it('should work', function (done) {
    	var fileText = "createRangesFromStreamText";
			var fileMD5 = writeFile(localFileName, fileText);

 			fileService.createFile(shareName, directoryName, fileName, fileText.length + 5, function (err) {
        assert.equal(err, null);

        var stream = fs.createReadStream(localFileName);
        fileService.createRangesFromStream(shareName, directoryName, fileName, stream, 5, 5 + fileText.length - 1, function(err2) {
          assert.equal(err2, null);

	 	      fileService.getFileToText(shareName, directoryName, fileName, function (downloadErr, text, file, downloadResponse) {
		        assert.equal(downloadErr, null);
		        assert.ok(downloadResponse.isSuccessful);
		        assert.ok(file);
		        assert.equal(text, '\u0000\u0000\u0000\u0000\u0000' + fileText);

		        done();       
          });
        });
 			});
    });

    it('should work with transactional MD5', function (done) {
    	var fileText = "createRangesFromStreamText";
			var fileMD5 = writeFile(localFileName, fileText);

 			fileService.createFile(shareName, directoryName, fileName, fileText.length, function (err) {
        assert.equal(err, null);

        var callback = function (webresource) {
          assert.notEqual(webresource.headers[HeaderConstants.CONTENT_MD5], null);
        };

        fileService.on('sendingRequestEvent', callback);
        fileService.createRangesFromStream(shareName, directoryName, fileName, fs.createReadStream(localFileName), 0, fileText.length - 1, {useTransactionalMD5: true}, function(err2) {
          // Upload all data
          assert.equal(err2, null);
          fileService.removeAllListeners('sendingRequestEvent');   

	 	      fileService.getFileToText(shareName, directoryName, fileName, function (downloadErr, text, file, downloadResponse) {
		        assert.equal(downloadErr, null);
		        assert.ok(downloadResponse.isSuccessful);
		        assert.ok(file);
		        assert.equal(text, fileText);

		        done();
		      });           
        });
      });
		});

    it('should work with MD5', function (done) {
    	var fileText = "createRangesFromStreamText";
			var fileMD5 = writeFile(localFileName, fileText);
			
 			fileService.createFile(shareName, directoryName, fileName, fileText.length, function (err) {
        assert.equal(err, null);

        var callback = function (webresource) {
          assert.notEqual(webresource.headers[HeaderConstants.CONTENT_MD5], null);
        };

        fileService.on('sendingRequestEvent', callback);
        fileService.createRangesFromStream(shareName, directoryName, fileName, fs.createReadStream(localFileName), 0, fileText.length - 1, {contentMD5: fileMD5}, function(err2) {
          // Upload all data
          assert.equal(err2, null);
          fileService.removeAllListeners('sendingRequestEvent');   

	 	      fileService.getFileToText(shareName, directoryName, fileName, function (downloadErr, text, file, downloadResponse) {
		        assert.equal(downloadErr, null);
		        assert.ok(downloadResponse.isSuccessful);
		        assert.ok(file);
		        assert.equal(text, fileText);

		        done();
		      });           
        });
      });
		});
  });

	describe('clearRange', function() {
    it('should work', function (done) {
      var buffer = new Buffer(512);
      buffer.fill(0);
      buffer[0] = '1';
      writeFile(localFileName, buffer);

 			fileService.createFile(shareName, directoryName, fileName, 1024 * 1024 * 1024, function (err) {
        assert.equal(err, null);

	      fileService.createRangesFromStream(shareName, directoryName, fileName, fs.createReadStream(localFileName), 512, 512 + buffer.length - 1, function(err2) {
	        assert.equal(err2, null);

        	fileService.clearRange(shareName, directoryName, fileName, 512, 512 + buffer.length - 1, function (err) {
	        	assert.equal(err, null);

	        	fileService.listRanges(shareName, directoryName, fileName, function (error, ranges) {
		          assert.equal(error, null);
		          assert.notEqual(ranges, null);
		          assert.equal(ranges.length, 0);

		          done();
		        });
		      });
				});
      });
    });

    it('multiple ranges', function (done) {
      var buffer = new Buffer(1024);
      buffer.fill(0);
      buffer[0] = '1';
      writeFile(localFileName, buffer);

 			fileService.createFile(shareName, directoryName, fileName, 1024 * 1024 * 1024, function (err) {
        assert.equal(err, null);

	      fileService.createRangesFromStream(shareName, directoryName, fileName, fs.createReadStream(localFileName), 0, buffer.length - 1, function(err2) {
	        assert.equal(err2, null);

        	fileService.clearRange(shareName, directoryName, fileName, 512, 1023, function (err) {
	        	assert.equal(err, null);

	        	fileService.listRanges(shareName, directoryName, fileName, function (error, ranges) {
		          assert.equal(error, null);
		          assert.notEqual(ranges, null);
		          assert.equal(ranges.length, 1);
              assert.equal(ranges[0].start, 0);
              assert.equal(ranges[0].end, 511);

		          done();
		        });
		      });
				});
      });
    });
	});

	describe('listRanges', function() {
    it('should work', function (done) {
      var buffer = new Buffer(512);
      buffer.fill(0);
      buffer[0] = '1';
      writeFile(localFileName, buffer);

 			fileService.createFile(shareName, directoryName, fileName, 1024 * 1024 * 1024, function (err) {
        assert.equal(err, null);

	      fileService.createRangesFromStream(shareName, directoryName, fileName, fs.createReadStream(localFileName), 0, buffer.length - 1, function(err2) {
	        assert.equal(err2, null);

	        // Only one range present
	        fileService.listRanges(shareName, directoryName, fileName, function (error, ranges) {
	          assert.equal(error, null);
	          assert.notEqual(ranges, null);
	          assert.equal(ranges.length, 1);
	          assert.equal(ranges[0].start, 0);
	          assert.equal(ranges[0].end, buffer.length - 1);

	          done();
	        });
				});
      });
    });

    it('empty file', function (done) {
 			fileService.createFile(shareName, directoryName, fileName, 1024 * 1024 * 1024, function (err) {
        assert.equal(err, null);

        // Only one range present
        fileService.listRanges(shareName, directoryName, fileName, function (error, ranges) {
          assert.equal(error, null);
          assert.notEqual(ranges, null);
          assert.equal(ranges.length, 0);

          done();
	      });
      });
    });

    it('multiple discrete ranges', function (done) {
      var buffer = new Buffer(512);
      buffer.fill(0);
      buffer[0] = '1';
      writeFile(localFileName, buffer);

 			fileService.createFile(shareName, directoryName, fileName, 1024 * 1024 * 1024, function (err) {
        assert.equal(err, null);

	      fileService.createRangesFromStream(shareName, directoryName, fileName, fs.createReadStream(localFileName), 0, buffer.length - 1, function (err2) {
	        assert.equal(err2, null);

          fileService.createRangesFromStream(shareName, directoryName, fileName, fs.createReadStream(localFileName), 1048576, 1048576 + buffer.length - 1, function (err3) {
            assert.equal(err3, null);

            // Get ranges
            fileService.listRanges(shareName, directoryName, fileName, function (error5, ranges) {
              assert.equal(error5, null);
              assert.notEqual(ranges, null);
              assert.equal(ranges.length, 2);
              assert.equal(ranges[0].start, 0);
              assert.equal(ranges[0].end, buffer.length - 1);
              assert.equal(ranges[1].start, 1048576);
              assert.equal(ranges[1].end, 1048576 + buffer.length - 1);

              done();
            });
          });
				});
      });
    });
  });

  describe('GetFileToFile', function() {
  	var fileText = "Hello world!";

    it('should work with basic file', function(done) {
      writeFile(localFileName, fileText);
      fileService.createFileFromLocalFile(shareName, directoryName, fileName, localFileName, function (err) {
        assert.equal(err, null);
        fileService.getFileToLocalFile(shareName, directoryName, fileName, downloadFileName, function (err, file) {
          assert.equal(err, null);
          assert.ok(file);

          var exists = azureutil.pathExistsSync(downloadFileName);
          assert.equal(exists, true);

          fs.readFile(downloadFileName, function (err, text) {
            assert.equal(text, fileText);
            done();
          });
        });
      });
    });

    it('should calculate content md5', function(done) {
      fileContentMD5 = writeFile(localFileName, fileText);
      fileService.createFileFromLocalFile(shareName, directoryName, fileName, localFileName, {storeFileContentMD5: true}, function (err) {
        assert.equal(err, null);        
        var options = {disableContentMD5Validation : false};
        fileService.getFileToLocalFile(shareName, directoryName, fileName, downloadFileName, options, function (err, file) {
          assert.equal(err, null);
          assert.equal(file.contentMD5, fileContentMD5);

          var exists = azureutil.pathExistsSync(downloadFileName);
          assert.equal(exists, true);

          fs.readFile(downloadFileName, function (err, text) {
            assert.equal(text, fileText);
            done();
          });
        });
      });
    });
  });

  describe('GetFileToStream', function() {
  	var fileText = "Hello world!";

	  it('getFileToStream', function (done) {
	  	fileContentMD5 = writeFile(localFileName, fileText);
	  	var stream = fs.createReadStream(localFileName);
	    fileService.createFileFromStream(shareName, directoryName, fileName, stream, fileText.length, function (uploadError, file, uploadResponse) {
	      assert.equal(uploadError, null);
	      assert.ok(file);
	      assert.ok(uploadResponse.isSuccessful);

        fileService.getFileToStream(shareName, directoryName, fileName, fs.createWriteStream(downloadFileName), function (downloadErr, file, downloadResponse) {
	        assert.equal(downloadErr, null);
	        assert.ok(downloadResponse.isSuccessful);
	        assert.ok(file);

          var exists = azureutil.pathExistsSync(downloadFileName);
          assert.equal(exists, true);

          fs.readFile(downloadFileName, function (err, text) {
            assert.equal(text, fileText);
            done();
          });
        });
	    });
	  });

    it('should calculate content md5', function(done) {
      fileContentMD5 = writeFile(localFileName, fileText);
      var stream = fs.createReadStream(localFileName);
      fileService.createFileFromStream(shareName, directoryName, fileName, stream, fileText.length, {storeFileContentMD5: true}, function (uploadError, file, uploadResponse) {
	      assert.equal(uploadError, null);
	      assert.ok(file);
	      assert.ok(uploadResponse.isSuccessful);

        var options = {disableContentMD5Validation : false};
        fileService.getFileToStream(shareName, directoryName, fileName, fs.createWriteStream(downloadFileName), options, function(downloadErr, file, downloadResponse) {
	        assert.equal(downloadErr, null);
	        assert.ok(downloadResponse.isSuccessful);
	        assert.ok(file);
	        assert.equal(file.contentMD5, fileContentMD5);

          var exists = azureutil.pathExistsSync(downloadFileName);
          assert.equal(exists, true);

          fs.readFile(downloadFileName, function (err, text) {
            assert.equal(text, fileText);
            done();
          });
        });
      });
    });
  });

	describe('CreateFileFromText', function () {
	  it('shouldWork', function (done) {
	    var fileText = 'Hello World';
	    fileService.createFileFromText(shareName, directoryName, fileName, fileText, function (uploadError, file, uploadResponse) {
	      assert.equal(uploadError, null);
	      assert.ok(file);
	      assert.ok(uploadResponse.isSuccessful);

	      fileService.getFileToText(shareName, directoryName, fileName, function (downloadErr, text, file, downloadResponse) {
	        assert.equal(downloadErr, null);
	        assert.ok(downloadResponse.isSuccessful);
	        assert.ok(file);
	        assert.equal(text, fileText);

	        done();
	      });
	    });
	  });

	  it('strangeChars1', function (done) {
	    fileName = 'def@#abefdef& &abcde+=-';

	    var fileText = 'def@#/abef?def/& &/abcde+=-';
	    fileService.createFileFromText(shareName, directoryName, fileName, fileText, function (uploadError, file, uploadResponse) {
	      assert.equal(uploadError, null);
	      assert.ok(file);
	      assert.ok(uploadResponse.isSuccessful);

	      fileService.getFileToText(shareName, directoryName, fileName, function (downloadErr, text, file, downloadResponse) {
	        assert.equal(downloadErr, null);
	        assert.ok(downloadResponse.isSuccessful);
	        assert.ok(file);
	        assert.equal(text, fileText);

	        done();
	      });
	    });
	  });

	  it('strangeChars2', function (done) {
	    fileName = '\u2488\u2460\u216B\u3128\u3129'.toString('GB18030');

	    var fileText = '\u2488\u2460\u216B\u3128\u3129'.toString('GB18030');
	    fileService.createFileFromText(shareName, directoryName, fileName, fileText, function (uploadError, file, uploadResponse) {
	      assert.equal(uploadError, null);
	      assert.ok(file);
	      assert.ok(uploadResponse.isSuccessful);

	      fileService.getFileToText(shareName, directoryName, fileName, function (downloadErr, text, file, downloadResponse) {
	        assert.equal(downloadErr, null);
	        assert.ok(downloadResponse.isSuccessful);
	        assert.ok(file);
	        assert.equal(text, fileText);

	        done();
	      });
	    });
	  });

	  it('withBuffer', function (done) {
	    var fileText = new Buffer('Hello World');
	    fileService.createFileFromText(shareName, directoryName, fileName, fileText, function (uploadError, file, uploadResponse) {
	      assert.equal(uploadError, null);
	      assert.ok(file);
	      assert.ok(uploadResponse.isSuccessful);

	      fileService.getFileToText(shareName, directoryName, fileName, function (downloadErr, text, file, downloadResponse) {
	        assert.equal(downloadErr, null);
	        assert.ok(downloadResponse.isSuccessful);
	        assert.ok(file);
	        assert.equal(text, fileText);

	        done();
	      });
	    });
	  });

    /*it('should work with storeFileContentMD5', function (done) {
      var fileName = testutil.generateId(fileNamesPrefix, fileNames, false) + ' a';
      var fileText = 'Hello World';
      var fileMD5 = azureutil.getContentMd5(fileText);

      fileService.createFileFromText(shareName, directoryName, fileName, fileText, {storeFileContentMD5: true, contentMD5: fileMD5}, function (uploadError, file, uploadResponse) {
        assert.equal(uploadError, null);
        assert.notEqual(file, null);
        assert.equal(file.contentMD5, fileMD5);
        assert.ok(uploadResponse.isSuccessful);

        fileService.getFileToText(shareName, directoryName, fileName, function (downloadErr, fileTextResponse) {
          assert.equal(downloadErr, null);
          assert.equal(fileTextResponse, fileText);

          done();
        });
      });
    });*/
	});

  describe('CreateFileFromFile', function() {
  	var fileText = 'Hello World!';
    var zeroFileContentMD5;
    var fileContentMD5;
    before(function (done) {
      fileContentMD5 = writeFile(localFileName, fileText);
      var zeroBuffer = new Buffer(0);
      zeroFileContentMD5 = writeFile(zeroSizeFileName, zeroBuffer);
      done();
    });

    afterEach(function (done) {
      fileService.deleteFileIfExists(shareName, directoryName, fileName, function (err) {
        assert.equal(err, null);
        done();
      });
    });

    it('should work with basic file', function(done) {
      fileService.createFileFromLocalFile(shareName, directoryName, fileName, localFileName, function (err) {
        assert.equal(err, null);
        fileService.getFileProperties(shareName, directoryName, fileName, function (err, file) {
          assert.equal(file.contentMD5, undefined);

          fileService.getFileToText(shareName, directoryName, fileName, function (downloadErr, fileTextResponse) {
            assert.equal(downloadErr, null);
            assert.equal(fileTextResponse, fileText);
            done();
          });
        });
      });
    });

    it('should work with speed summary', function(done) {
      var speedSummary = fileService.createFileFromLocalFile(shareName, directoryName, fileName, localFileName, function (err) {
        assert.equal(err, null);

        fileService.getFileProperties(shareName, directoryName, fileName, function (err1, file) {
          assert.equal(err1, null);
          assert.equal(file.contentMD5, undefined);
          assert.equal(speedSummary.getTotalSize(false), fileText.length);
          assert.equal(speedSummary.getCompleteSize(false), fileText.length);
          assert.equal(speedSummary.getCompletePercent(), '100.0');
          done();
        });
      });
    });

    it('should set content md5', function(done) {
      var options = {
        storeFileContentMD5 : true,
        useTransactionalMD5 : true
      };

      fileService.createFileFromLocalFile(shareName, directoryName, fileName, localFileName, options, function (err) {
        assert.equal(err, null);

        fileService.getFileProperties(shareName, directoryName, fileName, function (getErr, file) {
          assert.equal(getErr, null);
          assert.equal(file.contentMD5, fileContentMD5);
          done();
        });
      });
    });

    it('should overwrite the existing file', function(done) {
      fileService.createFileFromText(shareName, directoryName, fileName, 'garbage', function (err) {
        assert.equal(err, null);
        fileService.createFileFromLocalFile(shareName, directoryName, fileName, localFileName, function (err) {
          assert.equal(err, null);

          fileService.getFileToText(shareName, directoryName, fileName, function (downloadErr, fileTextResponse) {
            assert.equal(downloadErr, null);
            assert.equal(fileTextResponse, fileText);
            done();
          });
        });
      });
    });

    it('should work with content type', function (done) {
      var fileOptions = { contentType: 'text' };
      fileService.createFileFromLocalFile(shareName, directoryName, fileName, localFileName, fileOptions, function (uploadError, fileResponse, uploadResponse) {
        assert.equal(uploadError, null);
        assert.notEqual(fileResponse, null);
        assert.ok(uploadResponse.isSuccessful);

        fileService.getFileProperties(shareName, directoryName, fileName, function (getFilePropertiesErr, fileGetResponse) {
          assert.equal(getFilePropertiesErr, null);
          assert.notEqual(fileGetResponse, null);
          assert.equal(fileOptions.contentType, fileGetResponse.contentType);
          done();
        });
      });
    });

    it('should work with zero size file', function(done) {
      var fileOptions = { storeFileContentMD5: true};
      fileService.createFileFromLocalFile(shareName, directoryName, fileName, zeroSizeFileName, fileOptions, function (err1) {
        assert.equal(err1, null);

        fileService.getFileProperties(shareName, directoryName, fileName, function (err2, file) {
          assert.equal(err2, null);
          assert.equal(file.contentLength, 0);
          assert.equal(file.contentMD5, zeroFileContentMD5);
          done();
        });
      });
    });

    it('should work with not existing file', function(done) {
      fileService.createFileFromLocalFile(shareName, directoryName, fileName, notExistFileName, function (err) {
        assert.notEqual(err, null);
        assert.equal(path.basename(err.path), notExistFileName);

        fileService.doesFileExist(shareName, directoryName, fileName, function (existsErr, exists) {
          assert.equal(existsErr, null);
          assert.equal(exists, false);
          done();
        });
      });
    });
  });

  describe('CreateFileFromStream', function() {
  	var fileText = 'Hello World!';
    var zeroFileContentMD5;
    var fileContentMD5;
    var len;
    var stream;

    before(function (done) {
      fileContentMD5 = writeFile(localFileName, fileText);
      var zeroBuffer = new Buffer(0);
      zeroFileContentMD5 = writeFile(zeroSizeFileName, zeroBuffer);
      done();
    });

    beforeEach(function (done) {
      len = Buffer.byteLength(fileText);
      stream = fs.createReadStream(localFileName);
      done();
    });

    afterEach(function (done) {
      fileService.deleteFileIfExists(shareName, directoryName, fileName, function(error) {
        done();
      });
    });

    it('should work with basic stream', function(done) {   var stream = fs.createReadStream(localFileName);   fileService.createFileFromStream(shareName, directoryName, fileName,
    stream, fileText.length, function (err) { assert.equal(err, null);

        fileService.getFileProperties(shareName, directoryName, fileName, function (err1, file) {
          assert.equal(err1, null);
          assert.equal(file.contentMD5, undefined);

          fileService.getFileToText(shareName, directoryName, fileName, function (downloadErr, fileTextResponse) {
            assert.equal(downloadErr, null);
            assert.equal(fileTextResponse, fileText);
            done();
          });
        });
      });
    });

    it('should work with contentMD5 in options', function(done) {
      var options = {
        contentMD5 : fileContentMD5
      };

      fileService.createFileFromStream(shareName, directoryName, fileName, stream, len, options, function (err) {
        assert.equal(err, null);
        fileService.getFileProperties(shareName, directoryName, fileName, function (err, file) {
          assert.equal(file.contentMD5, fileContentMD5);
          done();
        });
      });
    });

    it('should work with the speed summary in options', function(done) {
      var speedSummary = new azure.FileService.SpeedSummary();
      var options = {
        speedSummary : speedSummary
      };

      fileService.createFileFromStream(shareName, directoryName, fileName, stream, len, options, function (err) {
        assert.equal(err, null);
        assert.equal(speedSummary.getTotalSize(false), Buffer.byteLength(fileText));
        assert.equal(speedSummary.getCompleteSize(false), Buffer.byteLength(fileText));
        assert.equal(speedSummary.getCompletePercent(), '100.0');
        done();
      });
    });

    it('should work with content type', function (done) {
      var fileOptions = { contentType: 'text'};

      fileService.createFileFromStream(shareName, directoryName, fileName, fs.createReadStream(localFileName), fileText.length, fileOptions, function (uploadError, fileResponse, uploadResponse) {
        assert.equal(uploadError, null);
        assert.notEqual(fileResponse, null);
        assert.ok(uploadResponse.isSuccessful);

        fileService.getFileToText(shareName, directoryName, fileName, function (downloadErr, fileTextResponse) {
          assert.equal(downloadErr, null);
          assert.equal(fileTextResponse, fileText);

          fileService.getFileProperties(shareName, directoryName, fileName, function (getFilePropertiesErr, fileGetResponse) {
            assert.equal(getFilePropertiesErr, null);
            assert.notEqual(fileGetResponse, null);
            assert.equal(fileOptions.contentType, fileGetResponse.contentType);

            done();
          });
        });
      });
    });

    it('should work with parallelOperationsThreadCount in options', function(done) {
      var options = {
        parallelOperationThreadCount : 4
      };

      var buffer = new Buffer(65 * 1024 * 1024);
      buffer.fill(0);
      buffer[0] = '1';
      writeFile(localFileName, buffer);
      var stream = fs.createReadStream(localFileName);
      
      fileService.createFileFromStream(shareName, directoryName, fileName, stream, buffer.length, options, function (err) {
        assert.equal(err, null);

        fileService.getFileProperties(shareName, directoryName, fileName, function (getFilePropertiesErr, fileGetResponse) {
          assert.equal(getFilePropertiesErr, null);
          assert.notEqual(fileGetResponse, null);
          assert.equal(fileGetResponse.contentLength, buffer.length);

          done();
        });
      });
    });
  });

	describe('MD5Validation', function() {
    var callback = function (webresource) {
      if (webresource.headers[HeaderConstants.CONTENT_LENGTH]) {
        assert.notEqual(webresource.headers[HeaderConstants.CONTENT_MD5], null);
      }
    };

    it('storeFileContentMD5/useTransactionalMD5 on file', function (done) {
      var fileBuffer = new Buffer(5 * 1024 * 1024);
      fileBuffer.fill(0);
      fileBuffer[0] = '1';
      var fileMD5 = writeFile(localFileName, fileBuffer);

      var fileOptions = { storeFileContentMD5: true, useTransactionalMD5: true, contentType: 'text'};
      fileService.on('sendingRequestEvent', callback);
      fileService.createFileFromLocalFile(shareName, directoryName, fileName, localFileName, fileOptions, function (uploadError, fileResponse, uploadResponse) {
        fileService.removeAllListeners('sendingRequestEvent');
        assert.equal(uploadError, null);
        assert.notEqual(fileResponse, null);
        assert.ok(uploadResponse.isSuccessful);

        // Set disableContentMD5Validation to false explicitly.
        fileService.getFileToLocalFile(shareName, directoryName, fileName, downloadFileName, function (downloadErr, downloadResult) {
          assert.equal(downloadErr, null);
          assert.strictEqual(downloadResult.contentMD5, fileMD5);

          fileService.getFileProperties(shareName, directoryName, fileName, function (getFilePropertiesErr, fileGetResponse) {
            assert.equal(getFilePropertiesErr, null);
            assert.notEqual(fileGetResponse, null);
            assert.equal(fileOptions.contentType, fileGetResponse.contentType);

            done();
          });
        });
      });
    });
    
    it('storeFileContentMD5/useTransactionalMD5 with streams/ranges', function (done) {
      var fileBuffer = new Buffer(5 * 1024 * 1024);
      fileBuffer.fill(0);
      fileBuffer[0] = '1';
      var fileMD5 = writeFile(localFileName, fileBuffer);

      var fileOptions = { storeFileContentMD5: true, useTransactionalMD5: true, contentType: 'text'};
      fileService.on('sendingRequestEvent', callback);
      fileService.createFileFromLocalFile(shareName, directoryName, fileName, localFileName, fileOptions, function (uploadError, fileResponse, uploadResponse) {
        fileService.removeAllListeners('sendingRequestEvent');
        assert.equal(uploadError, null);
        assert.notEqual(fileResponse, null);
        assert.ok(uploadResponse.isSuccessful);

        var downloadOptions = { rangeStart: 512, rangeEnd: 1023 };
        fileService.getFileToStream(shareName, directoryName, fileName, fs.createWriteStream(downloadFileName), downloadOptions, function (downloadErr1, downloadResult1) {
          assert.equal(downloadErr1, null);
          assert.strictEqual(parseInt(downloadResult1.contentLength, 10), 512);
          assert.strictEqual(downloadResult1.contentMD5, undefined);

          downloadOptions.useTransactionalMD5 = true
          fileService.getFileToStream(shareName, directoryName, fileName, fs.createWriteStream(downloadFileName), downloadOptions, function (downloadErr2, downloadResult2) {
            assert.equal(downloadErr2, null);
            assert.strictEqual(parseInt(downloadResult2.contentLength, 10), 512);
            assert.strictEqual(downloadResult2.contentMD5, 'v2GerAzfP2jUluqTRBN+iw==');

            done();
          });
        });
      });
    });
  
    it('storeFileContentMD5/useTransactionalMD5 with text', function (done) {
      var data1 = 'Hello, World!';

      var fileOptions = { storeFileContentMD5: true, useTransactionalMD5: true};
      fileService.on('sendingRequestEvent', callback);
      fileService.createFileFromText(shareName, directoryName, fileName, data1, fileOptions, function (err) {
        fileService.removeAllListeners('sendingRequestEvent');
        assert.equal(err, null);

        fileService.getFileToText(shareName, directoryName, fileName, function (err2, content, result) {
          assert.equal(err2, null);
          assert.equal(content, 'Hello, World!');
          assert.equal(result.contentMD5, 'ZajifYh5KDgxtmS9i38K1A==');
          
          fileService.getFileProperties(shareName, directoryName, fileName, function (getFilePropertiesErr, blob) {
            assert.equal(getFilePropertiesErr, null);
            assert.equal(blob.contentMD5, 'ZajifYh5KDgxtmS9i38K1A==');
          	done();
          });
        });
      });
    });

    it('disableContentMD5Validation', function (done) {
      var fileBuffer = new Buffer(5 * 1024 * 1024);
      fileBuffer.fill(0);
      fileBuffer[0] = '1';
      var fileMD5 = writeFile(localFileName, fileBuffer);

      var fileOptions = { contentType: 'text'};
      fileService.createFileFromLocalFile(shareName, directoryName, fileName, localFileName, fileOptions, function (uploadError, fileResponse, uploadResponse) {
        assert.equal(uploadError, null);
        assert.notEqual(fileResponse, null);
        assert.ok(uploadResponse.isSuccessful);

        var setPropertiesOptions = {contentMD5: 'MDAwMDAwMDA='};
        fileService.setFileProperties(shareName, directoryName, fileName, setPropertiesOptions, function (setFilePropertiesErr) {
          assert.equal(setFilePropertiesErr, null);

          fileService.getFileToStream(shareName, directoryName, fileName, fs.createWriteStream(downloadFileName), { disableContentMD5Validation: false }, function (downloadErr) {
            assert.notEqual(downloadErr, null);
            assert.equal(downloadErr.message, util.format(SR.HASH_MISMATCH, 'MDAwMDAwMDA=', 'ndpxhuSh0PPmMvK74fkYvg=='));

            fileService.getFileToStream(shareName, directoryName, fileName, fs.createWriteStream(downloadFileName), function (downloadErr2) {
              assert.notEqual(downloadErr2, null);
              assert.equal(downloadErr2.message, util.format(SR.HASH_MISMATCH, 'MDAwMDAwMDA=', 'ndpxhuSh0PPmMvK74fkYvg=='));

              fileService.getFileToStream(shareName, directoryName, fileName, fs.createWriteStream(downloadFileName), { disableContentMD5Validation: true }, function (downloadErr3) {
                assert.equal(downloadErr3, null);

                done();
              });
            });
          });
        });
      });
    });
  });
});

function getName (prefix) {
  return prefix + guid.v1().toLowerCase();
}