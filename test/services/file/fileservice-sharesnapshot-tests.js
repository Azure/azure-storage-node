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
var fs = require('fs');

// Lib includes
var testutil = require('../../framework/util');
var SR = testutil.libRequire('common/util/sr');
var TestSuite = require('../../framework/test-suite');
var errors = testutil.libRequire('common/errors/errors');
var ArgumentError = errors.ArgumentError;
var ArgumentNullError = errors.ArgumentNullError;
var TimeoutError = errors.TimeoutError;
var StorageError = errors.StorageError;

var azure = testutil.libRequire('azure-storage');

var Constants = azure.Constants;
var FileUtilities = azure.FileUtilities;
var HttpConstants = Constants.HttpConstants;

var shareNamesPrefix = 'share-test-snapshot-';

var fileService;
var shareName;
var directoryName = 'testdirectoryforsharesnapshot';
var directoryName2 = 'testdirectoryforsharesnapshot2';
var fileName = 'testfileforsharesnapshot';
var fileName2 = 'testfileforsharesnapshot2';
var fileText = 'testfiletext';
var fileTextUpdated = 'testfiletextupdated';
var downloadFileName = 'fileservice_snapshottest_download.tmp';

var shareSnapshotId;

var baseShareMetadata = {
    'basem1': 'baseV1',
    'basem2': 'baseV2',
    'basem3': 'baseV3',
};

var shareSnapshotMetadata = {
    'snapshotm1': 'snapshotV1',
    'snapshotm2': 'snapshotV2',
    'snapshotm3': 'snapshotV3',
};

var directoryMetadata = {
    'dirmetadata1': 'value1',
    'dirmetadata2': 'value2',
    'dirmetadata3': 'value3',
};

var directoryMetadataUpdated = {
    'dirmetadata1updated': 'value1updated',
    'dirmetadata2updated': 'value2updated',
    'dirmetadata3updated': 'value3updated',
};

var fileMetadata = {
    'filemetadata1': 'value1',
    'filemetadata2': 'value2',
    'filemetadata3': 'value3',
};
var fileMetadataUpdated = {
    'filemetadata1updated': 'value1updated',
    'filemetadata2updated': 'value2updated',
    'filemetadata3updated': 'value3updated',
};

var fileContentType = 'filecontentype';
var fileContentTypeUpdated = 'filecontentypeupdated';

var suite = new TestSuite('fileservice-sharesnapshot-tests');
var runOrSkip = suite.isMocked ? it.skip : it;
var timeout = (suite.isRecording || !suite.isMocked) ? 30000 : 10;

describe('FileShare', function () {
  before(function (done) {
    if (suite.isMocked) {
      testutil.POLL_REQUEST_INTERVAL = 0;
    }
    shareName = suite.getName(shareNamesPrefix);
    suite.setupSuite(function () {
      fileService = azure.createFileService().withFilter(new azure.ExponentialRetryPolicyFilter());
      done();
    });
  });

  after(function (done) {
    try { fs.unlinkSync(downloadFileName); } catch (e) {}
    suite.teardownSuite(done);
  });

  beforeEach(function (done) {
    suite.setupTest(done);
  });

  afterEach(function (done) {
    suite.teardownTest(done);
  });

  describe('createShare', function () {
    it('Prepare the base share', function (done) {
      fileService.createShare(shareName, { metadata: baseShareMetadata }, function (error, result) {
        assert.equal(error, null);

        fileService.createDirectory(shareName, directoryName, {metadata: directoryMetadata}, function (error, result) {
          assert.equal(error, null);

          fileService.createFileFromText(shareName, directoryName, fileName, fileText, {contentSettings: {contentType: fileContentType}, metadata: fileMetadata}, function (error, result) {
            assert.equal(error, null);
            done();
          });
        });
      });
    });
  });

  describe('createShareSnapshot', function () {
    it('should work', function (done) {
      fileService.createShareSnapshot(shareName, { metadata: shareSnapshotMetadata }, function (error, result) {
        assert.equal(error, null);
        assert.notEqual(result, null);

        shareSnapshotId = result;

        // Update the base share properties after creating the share snapshot
        fileService.setShareProperties(shareName, {quota: 2560}, function (error, result) {
            assert.equal(error, null);

            // update the directory metadata in the base share
            fileService.setDirectoryMetadata(shareName, directoryName, directoryMetadataUpdated, function (error, result) {
                assert.equal(error, null);

                // Update the existing file content
                fileService.createFileFromText(shareName, directoryName, fileName, fileTextUpdated, function (error, result) {
                    assert.equal(error, null);

                    fileService.setFileProperties(shareName, directoryName, fileName, {contentType: fileContentTypeUpdated}, function (error, result) {
                        assert.equal(error, null);

                        fileService.setFileMetadata(shareName, directoryName, fileName, fileMetadataUpdated, function (error, result) {
                            assert.equal(error, null);

                            // Create a new directory which does not exist in the share snapshot
                            fileService.createDirectory(shareName, directoryName2, function (error, result) {
                                assert.equal(error, null);
                                
                                // Create a new file which does not exist in the share snapshot
                                fileService.createFileFromText(shareName, directoryName2, fileName2, fileTextUpdated, function (error, result) {
                                    assert.equal(error, null);
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

  describe('listShares', function () {
    it('include snapshot should work', function (done) {
        listShares(null, {include: 'snapshots'}, null, function (shares) {
           var testShares = shares.filter(function(element){
               return element.name == shareName;
           });

           assert.equal(2, testShares.length);

           var baseShare = testShares.find(function (element) {
                return !element.snapshot;
           });
           var shareSnapshot = testShares.find(function (element) {
                return element.snapshot;
           });
           assert.notEqual(baseShare, null);
           assert.notEqual(shareSnapshot, null);
           assert.equal(shareSnapshot.snapshot, shareSnapshotId);

           done();
        });
    });

    it('include no snapshot should work', function (done) {
        listShares(null, null, null, function (shares) {
           var testShares = shares.filter(function(element){
               return element.name == shareName;
           });

           assert.equal(1, testShares.length);
           done();
        });
    });
  });

  describe('getShareProperties & getShareMetadata', function () {
    it('get base share properties should work', function (done) {
        fileService.getShareProperties(shareName, null, function (error, result) {
            assert.equal(result.name, shareName);
            assert.equal(result.quota, 2560);
            assert.equal(result.metadata['basem1'], baseShareMetadata['basem1']);
            assert.equal(result.metadata['basem2'], baseShareMetadata['basem2']);
            assert.equal(result.metadata['basem3'], baseShareMetadata['basem3']);
            done();
        });
    });

    it('get share snapshot properties should work', function (done) {
        fileService.getShareProperties(shareName, {shareSnapshotId: shareSnapshotId}, function (error, result) {
            assert.equal(result.name, shareName);
            assert.equal(result.quota, 5120);
            assert.equal(result.metadata['snapshotm1'], shareSnapshotMetadata['snapshotm1']);
            assert.equal(result.metadata['snapshotm2'], shareSnapshotMetadata['snapshotm2']);
            assert.equal(result.metadata['snapshotm3'], shareSnapshotMetadata['snapshotm3']);
            done();
        });
    });

    it('get base share metadata should work', function (done) {
        fileService.getShareMetadata(shareName, null, function (error, result) {
            assert.equal(result.name, shareName);

            assert.equal(result.metadata['basem1'], baseShareMetadata['basem1']);
            assert.equal(result.metadata['basem2'], baseShareMetadata['basem2']);
            assert.equal(result.metadata['basem3'], baseShareMetadata['basem3']);
            done();
        });
    });

    it('get share snapshot metadata should work', function (done) {
        fileService.getShareMetadata(shareName, {shareSnapshotId: shareSnapshotId}, function (error, result) {
            assert.equal(result.name, shareName);
            assert.equal(result.metadata['snapshotm1'], shareSnapshotMetadata['snapshotm1']);
            assert.equal(result.metadata['snapshotm2'], shareSnapshotMetadata['snapshotm2']);
            assert.equal(result.metadata['snapshotm3'], shareSnapshotMetadata['snapshotm3']);
            done();
        });
    });
  });
  
  describe('doesShareExist', function () {
    it('should work with share snapshot', function (done) {
        fileService.doesShareExist(shareName, {shareSnapshotId: shareSnapshotId}, function (error, result) {
            assert.equal(result.exists, true);
            assert.equal(result.name, shareName);
            assert.equal(result.quota, 5120);
            done();
        });
    });
  });

  describe('doesDirectoryExist', function () {
    it('should work with base share', function (done) {
        fileService.doesDirectoryExist(shareName, directoryName, function (error, result) {
            assert.equal(error, null);
            assert.equal(result.exists, true);
            assert.equal(result.name, directoryName);

            fileService.doesDirectoryExist(shareName, directoryName2, function (error, result) {
                assert.equal(error, null);
                assert.equal(result.exists, true);
                assert.equal(result.name, directoryName2);
                done();
            });
        });
    });

    it('should work with share snapshot', function (done) {
        fileService.doesDirectoryExist(shareName, directoryName, {shareSnapshotId: shareSnapshotId}, function (error, result) {
            assert.equal(error, null);
            assert.equal(result.exists, true);
            assert.equal(result.name, directoryName);

            fileService.doesDirectoryExist(shareName, directoryName2, {shareSnapshotId: shareSnapshotId}, function (error, result) {
                assert.equal(error, null);
                assert.equal(result.exists, false);
                done();
            });
        });
    });
  });

  describe('listFilesAndDirectoriesSegmented', function () {
      it('should work with base share', function (done) {
          fileService.listFilesAndDirectoriesSegmented(shareName, '', null, function (error, result) {
              assert.equal(error, null);
              assert.equal(result.entries.directories.length, 2);
              done();
          });
      });
      
      it('should work with share snapshot', function (done) {
          fileService.listFilesAndDirectoriesSegmented(shareName, '', null, {shareSnapshotId: shareSnapshotId}, function (error, result) {
              assert.equal(error, null);
              assert.equal(result.entries.directories.length, 1);
              done();
          });
      });
  });

  describe('getDirectoryProperties', function () {
      it('should work with base share', function (done) {
        fileService.getDirectoryProperties(shareName, directoryName, function (error, result) {
            assert.equal(error, null);
            assert.equal(result.name, directoryName);            
            assert.equal(result.metadata['dirmetadata1updated'], directoryMetadataUpdated['dirmetadata1updated']);
            assert.equal(result.metadata['dirmetadata2updated'], directoryMetadataUpdated['dirmetadata2updated']);
            assert.equal(result.metadata['dirmetadata3updated'], directoryMetadataUpdated['dirmetadata3updated']);
            done();
        });
      });

      it('should work with share snapshot', function (done) {
        fileService.getDirectoryProperties(shareName, directoryName, {shareSnapshotId: shareSnapshotId}, function (error, result) {
            assert.equal(error, null);
            assert.equal(result.name, directoryName);            
            assert.equal(result.metadata['dirmetadata1'], directoryMetadata['dirmetadata1']);
            assert.equal(result.metadata['dirmetadata2'], directoryMetadata['dirmetadata2']);
            assert.equal(result.metadata['dirmetadata3'], directoryMetadata['dirmetadata3']);
            done();
        });
      });
  });

  describe('getDirectoryMetadata', function () {
      it('should work with base share', function (done) {
        fileService.getDirectoryMetadata(shareName, directoryName, function (error, result) {
            assert.equal(error, null);
            assert.equal(result.name, directoryName);            
            assert.equal(result.metadata['dirmetadata1updated'], directoryMetadataUpdated['dirmetadata1updated']);
            assert.equal(result.metadata['dirmetadata2updated'], directoryMetadataUpdated['dirmetadata2updated']);
            assert.equal(result.metadata['dirmetadata3updated'], directoryMetadataUpdated['dirmetadata3updated']);
            done();
        });
      });

      it('should work with share snapshot', function (done) {
        fileService.getDirectoryMetadata(shareName, directoryName, {shareSnapshotId: shareSnapshotId}, function (error, result) {
            assert.equal(error, null);
            assert.equal(result.name, directoryName);            
            assert.equal(result.metadata['dirmetadata1'], directoryMetadata['dirmetadata1']);
            assert.equal(result.metadata['dirmetadata2'], directoryMetadata['dirmetadata2']);
            assert.equal(result.metadata['dirmetadata3'], directoryMetadata['dirmetadata3']);
            done();
        });
      });
  });

  describe('getUrl', function () {
    it('should work with base share', function (done) {
        var fileUrl = fileService.getUrl(shareName, directoryName, fileName, 'q=faketoken', true /*primary*/, '2017-03-15T09:18:00.0000000Z' /*shareSnapshotId*/);
        var parsedUrl = url.parse(fileUrl);
        assert.strictEqual(parsedUrl.query, 'q=faketoken&sharesnapshot=2017-03-15T09%3A18%3A00.0000000Z');
        done();
    });

    it('should work with share snapshot', function (done) {
        var fileUrl = fileService.getUrl(shareName, directoryName, fileName, 'q=faketoken', true /*primary*/, null /*shareSnapshotId*/);
        var parsedUrl = url.parse(fileUrl);
        assert.strictEqual(parsedUrl.query, 'q=faketoken');
        done();
    });
  });

  describe('getFileProperties', function () {
    it('should work with base share', function (done) {
        var fileUrl = fileService.getFileProperties(shareName, directoryName, fileName, function (error, result) {
            assert.equal(error, null);
            assert.equal(result.contentSettings.contentType, fileContentTypeUpdated);
            done();
        });
    });

    it('should work with share snapshot', function (done) {
        var fileUrl = fileService.getFileProperties(shareName, directoryName, fileName, {shareSnapshotId: shareSnapshotId}, function (error, result) {
            assert.equal(error, null);
            assert.equal(result.contentSettings.contentType, fileContentType);
            done();
        });
    });
  });

  describe('getFileMetadata', function () {
    it('should work with base share', function (done) {
        var fileUrl = fileService.getFileMetadata(shareName, directoryName, fileName, function (error, result) {
            assert.equal(error, null);
            assert.equal(result.metadata['filemetadata1updated'], fileMetadataUpdated['filemetadata1updated']);
            assert.equal(result.metadata['filemetadata2updated'], fileMetadataUpdated['filemetadata2updated']);
            assert.equal(result.metadata['filemetadata3updated'], fileMetadataUpdated['filemetadata3updated']);
            done();
        });
    });

    it('should work with share snapshot', function (done) {
        var fileUrl = fileService.getFileMetadata(shareName, directoryName, fileName, {shareSnapshotId: shareSnapshotId}, function (error, result) {
            assert.equal(error, null);
            assert.equal(result.metadata['filemetadata1'], fileMetadata['filemetadata1']);
            assert.equal(result.metadata['filemetadata2'], fileMetadata['filemetadata2']);
            assert.equal(result.metadata['filemetadata3'], fileMetadata['filemetadata3']);
            done();
        });
    });
  });

  describe('doesFileExist', function () {
    it('should work with base share', function (done) {
        fileService.doesFileExist(shareName, directoryName2, fileName2, function (error, result) {
            assert.equal(error, null);
            assert.equal(result.exists, true);
            done();
        });
    });

    it('should work with share snapshot', function (done) {
        fileService.doesFileExist(shareName, directoryName2, fileName2, {shareSnapshotId: shareSnapshotId}, function (error, result) {
            assert.equal(error, null);
            assert.equal(result.exists, false);
            
            fileService.doesFileExist(shareName, directoryName, fileName, {shareSnapshotId: shareSnapshotId}, function (error, result) {
                assert.equal(error, null);
                assert.equal(result.exists, true);
                
                done();
            });
        });
    });
  });

  describe('listRanges', function () {
      it('should work with base share', function (done) {
          fileService.listRanges(shareName, directoryName, fileName, function (error, ranges) {
              assert.equal(error, null);
              assert.equal(ranges.length, 1);
              assert.equal(ranges[0].start, 0);
              assert.equal(ranges[0].end, Buffer.byteLength(fileTextUpdated) - 1);
              done();
          });
      });

      it('should work with share snapshot', function (done) {
          fileService.listRanges(shareName, directoryName, fileName, {shareSnapshotId: shareSnapshotId}, function (error, ranges) {
              assert.equal(error, null);
              assert.equal(ranges.length, 1);
              assert.equal(ranges[0].start, 0);
              assert.equal(ranges[0].end, Buffer.byteLength(fileText) - 1);
              done();
          });
      });
  });

  describe('getFileToText', function () {
      it('should work with base share', function (done) {
        fileService.getFileToText(shareName, directoryName2, fileName2, function (error, text) {
            assert.equal(error, null);
            assert.equal(text, fileTextUpdated);
            done();
        });
      });

      it('should work with share snapshot', function (done) {
        fileService.getFileToText(shareName, directoryName, fileName, {shareSnapshotId, shareSnapshotId}, function (error, text) {
            assert.equal(error, null);
            assert.equal(text, fileText);
            done();
        });
      });
  });

  describe('getFileToStream', function () {
      it('should work with base share', function (done) {
          fileService.getFileToStream(shareName, directoryName, fileName, fs.createWriteStream(downloadFileName), function (error, result, response) {
            assert.equal(error, null);
            assert.ok(response.isSuccessful);
            assert.ok(result);
            assert.equal(result.share, shareName);
            assert.equal(result.directory, directoryName);
            assert.equal(result.name, fileName);

            
            var exists = fs.existsSync(downloadFileName);
            assert.equal(exists, true);

            fs.readFile(downloadFileName, function (error, text) {
                assert.equal(text, fileTextUpdated);
                done();
            });
          });
      });
      
      it('should work with share snapshot', function (done) {
          fileService.getFileToStream(shareName, directoryName, fileName, fs.createWriteStream(downloadFileName), {shareSnapshotId: shareSnapshotId}, function (error, result, response) {
            assert.equal(error, null);
            assert.ok(response.isSuccessful);
            assert.ok(result);
            assert.equal(result.share, shareName);
            assert.equal(result.directory, directoryName);
            assert.equal(result.name, fileName);

            
            var exists = fs.existsSync(downloadFileName);
            assert.equal(exists, true);

            fs.readFile(downloadFileName, function (error, text) {
                assert.equal(text, fileText);
                done();
            });
          });
      });
  });

  describe('deleteShare', function () {
    it('delete share with snapshot should fail by default', function (done) {
        fileService.deleteShare(shareName, function(error, result) {
            assert.notEqual(error, null);
            done();
        });
    });

    it('delete share snapshot only should work', function (done) {
        fileService.deleteShare(shareName, {shareSnapshotId: shareSnapshotId}, function(error, result) {
            assert.equal(error, null);

            fileService.getShareProperties(shareName, {shareSnapshotId: shareSnapshotId}, function(error, result) {
                // Snapshot should not exist any more
                assert.notEqual(error, null);
                done();
            });
        });
    });

    it('delete share include snapshots should work', function (done) {
        // Create another snapshot and forcely delete the share
        fileService.createShareSnapshot(shareName, function (error, result) {
            assert.equal(error, null);
            fileService.deleteShare(shareName, { deleteSnapshots: FileUtilities.ShareSnapshotDeleteOptions.SHARE_AND_SNAPSHOTS }, function(error, result) {
                assert.equal(error, null);

                fileService.getShareProperties(shareName, function(error, result) {
                    // Share should not exist any more
                    assert.notEqual(error, null);
                    done();
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