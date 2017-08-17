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

// Lib includes
var testutil = require('../../framework/util');
var azure = testutil.libRequire('azure-storage');
var azureutil = testutil.libRequire('/common/util/util');
var blobutil = azure.BlobUtilities;
var TestSuite = require('../../framework/test-suite');

var containerNamesPrefix = 'archive-cont-';
var blobNamesPrefix = 'archive-blob-';
var rehydrate2hot = 'rehydrate-pending-to-hot';
var rehydrate2cool = 'rehydrate-pending-to-cool';

var blobAccountLRSConnectionString = process.env.AZURE_STORAGE_CONNECTION_STRING_BLOB_ACCOUNT_LRS;
var premiumAccountConnectionString = process.env.AZURE_STORAGE_CONNECTION_STRING_PREMIUM_ACCOUNT;
var blobAccountLRSConnectionStringEnabled = !azureutil.IsNullOrEmptyOrUndefinedOrWhiteSpace(blobAccountLRSConnectionString);
var premiumAccountConnectionStringEnabled = !azureutil.IsNullOrEmptyOrUndefinedOrWhiteSpace(premiumAccountConnectionString);

var blockBlobSuite = new TestSuite('blob-archive-blockblob-tests');
var pageBlobSuite = new TestSuite('blob-archive-pageblob-tests');

var runBlockBlobSuite = blobAccountLRSConnectionStringEnabled || (!blobAccountLRSConnectionStringEnabled && blockBlobSuite.isPlayback());
var runPageBlobSuite = premiumAccountConnectionStringEnabled || (!premiumAccountConnectionStringEnabled && pageBlobSuite.isPlayback());
var runBlockBlobCase = runBlockBlobSuite ? it : it.skip;
var runPageBlobCase = runPageBlobSuite ? it : it.skip;

var blobService;
var containerName;
var blobName;

describe('BlobArchive', function () {
  describe('Archive tests for page blobs in a premium storage account', function () {
    before(function (done) {
      if (!runPageBlobSuite) {
        done();
      } else {
        if (pageBlobSuite.isMocked) {
          pageBlobSuite.POLL_REQUEST_INTERVAL = 0;
        }

        pageBlobSuite.setupSuite(function () {
          premiumAccountConnectionString = process.env.AZURE_STORAGE_CONNECTION_STRING_PREMIUM_ACCOUNT;
          blobService = azure.createBlobService(premiumAccountConnectionString).withFilter(new azure.ExponentialRetryPolicyFilter());
          done();
        });
      }
    });

    after(function (done) {
      if (!runPageBlobSuite) {
        done();
      } else {
        pageBlobSuite.teardownSuite(done);          
      }
    });

    beforeEach(function (done) {
      if (!runPageBlobSuite) {
        done();
      } else {
        pageBlobSuite.setupTest(function () {
          containerName = pageBlobSuite.getName(containerNamesPrefix).toLowerCase();
          blobService.createContainerIfNotExists(containerName, function (createError, container) {
            assert.equal(createError, null);
            assert.notEqual(container, null);

            blobName = pageBlobSuite.getName(blobNamesPrefix).toLowerCase();
            blobService.createPageBlob(containerName, blobName, 0, function (uploadError, uploadResponse) {
              assert.equal(uploadError, null);
              assert.ok(uploadResponse.isSuccessful);
              done();
            });
          });
        });
      }
    });

    afterEach(function (done) {
      if (!runPageBlobSuite) {
        done();
      } else {
        blobService.deleteContainerIfExists(containerName, function (err, exist, res) {
          assert.equal(err, null);
          pageBlobSuite.teardownTest(done);
        });
      }
    });

    runPageBlobCase('Shoud return inferred tier property', function (done) {
      blobService.getBlobProperties(containerName, blobName, function (err, properties, resp) {
        assert.equal(err, null);
        assert.equal(properties.accessTierInferred, true);
        done();
      });
    });

    runPageBlobCase('setBlobTier should work setting higher tier for a page blob but not for lower tier', function (done) {
      blobService.setBlobTier(containerName, blobName, blobutil.BlobTier.PremiumPageBlobTier.P4, function (err, resp) {
        assert.equal(err, null);

        blobService.getBlobProperties(containerName, blobName, function (err, properties, resp) {
          assert.equal(err, null);
          assert.equal(properties.accessTier, blobutil.BlobTier.PremiumPageBlobTier.P4);

          blobService.listBlobsSegmented(containerName, null, function (err, results, resp) {
            assert.equal(err, null);
            assert.equal(results.entries.length, 1);
            assert.equal(results.entries[0].accessTier, blobutil.BlobTier.PremiumPageBlobTier.P4);

            blobService.setBlobTier(containerName, blobName, blobutil.BlobTier.PremiumPageBlobTier.P6, function (err, resp) {
              assert.equal(err, null);

              blobService.getBlobProperties(containerName, blobName, function (err, properties, resp) {
                assert.equal(true, (properties.accessTier === blobutil.BlobTier.PremiumPageBlobTier.P6));

                blobService.setBlobTier(containerName, blobName, blobutil.BlobTier.PremiumPageBlobTier.P4, function (err, resp) {
                  assert.notEqual(err, null);

                  blobService.getBlobProperties(containerName, blobName, function (err, properties, resp) {
                    assert.equal(properties.accessTier, blobutil.BlobTier.PremiumPageBlobTier.P6);
                    done();
                  });
                });
              });
            });
          });
        });
      });
    });

    runPageBlobCase('createPageBlob should work with setting page blob tier', function (done) {
      blobName += 'temp';
      blobService.createPageBlob(containerName, blobName, 0, { blobTier: blobutil.BlobTier.PremiumPageBlobTier.P10 }, function (uploadError, uploadResponse) {
        assert.equal(uploadError, null);
        assert.ok(uploadResponse.isSuccessful);

        blobService.getBlobProperties(containerName, blobName, function (err, properties, resp) {
          assert.equal(true, (properties.accessTier === blobutil.BlobTier.PremiumPageBlobTier.P10));
          done();
        });
      });
    });

    runPageBlobCase('createPageBlob should not work with setting small tier for large size blob', function (done) {
      blobName += 'temp';
      blobService.createPageBlob(containerName, blobName, 1024 * 1024 * 1024 * 512, { blobTier: blobutil.BlobTier.PremiumPageBlobTier.P4 }, function (uploadError, uploadResponse) {
        assert.notEqual(uploadError, null);
        done();
      });
    });

    runPageBlobCase('createPageBlob should not work with setting block blob tier for page blob', function (done) {
      blobName += 'temp';
      blobService.createPageBlob(containerName, blobName, 0, { blobTier: 'HOT' }, function (uploadError, uploadResponse) {
        assert.notEqual(uploadError, null);
        done();
      });
    });

    runPageBlobCase('createPageBlobFromLocalFile should work with setting page blob tier', function (done) {
      var localFileName = blobName + '.tmp';
      fs.writeFileSync(localFileName, Buffer.alloc(1024 * 1024 * 4, 'e'));

      blobService.createPageBlobFromLocalFile(containerName, blobName, localFileName, { blobTier: blobutil.BlobTier.PremiumPageBlobTier.P10 }, function (uploadError, result, uploadResponse) {
        assert.equal(uploadError, null);
        assert.ok(uploadResponse.isSuccessful);

        blobService.getBlobProperties(containerName, blobName, function (err, properties, resp) {
          assert.equal(true, (properties.accessTier === blobutil.BlobTier.PremiumPageBlobTier.P10));
          fs.unlinkSync(localFileName);
          done();
        });
      });
    });

    runPageBlobCase('createPageBlobFromStream should work with setting page blob tier', function (done) {
      var localFileName = blobName + '.tmp';
      fs.writeFileSync(localFileName, Buffer.alloc(1024 * 1024 * 4, 'e'));
      var readStream = fs.createReadStream(localFileName);

      blobService.createPageBlobFromStream(containerName, blobName, readStream, 1024 * 1024 * 4, { blobTier: blobutil.BlobTier.PremiumPageBlobTier.P20 }, function (uploadError, result, uploadResponse) {
        assert.equal(uploadError, null);
        assert.ok(uploadResponse.isSuccessful);

        blobService.getBlobProperties(containerName, blobName, function (err, properties, resp) {
          assert.equal(true, (properties.accessTier === blobutil.BlobTier.PremiumPageBlobTier.P20));
          fs.unlinkSync(localFileName);
          done();
        });
      });
    });

    runPageBlobCase('createWriteStreamToNewPageBlob should work with setting page blob tier', function (done) {
      var localFileName = blobName + '.tmp';
      fs.writeFileSync(localFileName, Buffer.alloc(1024 * 1024 * 4, 'e'));
      var readStream = fs.createReadStream(localFileName);

      var writeStream = blobService.createWriteStreamToNewPageBlob(containerName, blobName, 1024 * 1024 * 4, { blobTier: blobutil.BlobTier.PremiumPageBlobTier.P30 }, function (uploadError, result, uploadResponse) {
        assert.equal(uploadError, null);
        assert.ok(uploadResponse.isSuccessful);

        blobService.getBlobProperties(containerName, blobName, function (err, properties, resp) {
          assert.equal(true, (properties.accessTier === blobutil.BlobTier.PremiumPageBlobTier.P30));
          fs.unlinkSync(localFileName);
          done();
        });
      });

      readStream.pipe(writeStream);
    });

    runPageBlobCase('copyBlob should work with setting tier for page blob', function (done) {
      var copiedBlobName = blobName + 'copied';
      var sourceBlobUri = blobService.getUrl(containerName, blobName);

      blobService.startCopyBlob(sourceBlobUri, containerName, copiedBlobName, { blobTier: blobutil.BlobTier.PremiumPageBlobTier.P20 }, function (err, result, response) {
        setTimeout(function () {
          blobService.getBlobProperties(containerName, copiedBlobName, function (err, properties, resp) {
            assert.equal(true, (properties.accessTier === blobutil.BlobTier.PremiumPageBlobTier.P20));
            done();
          });
        }, 3000);
      });
    });
  }); // inner describe ends
}); // outer describe ends