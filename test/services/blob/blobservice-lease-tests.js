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
if (testutil.isBrowser()) {
  var azure = AzureStorage.Blob;
} else {
  var azure = require('../../../');
}

var TestSuite = require('../../framework/test-suite');

var containerNamesPrefix = 'lease-cont-';
var blobNamesPrefix = 'lease-blob-';
var proposedLeaseIdGuid = '1340f45c-1de0-4e83-a9c5-aea5237f194c';

var suite = new TestSuite('blobservice-lease-tests');

var blobService;
var containerName;
var blobName;

describe('BlobServiceLeasing', function () {
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
    containerName = suite.getName(containerNamesPrefix).toLowerCase();
    suite.setupTest(function () {
      blobService.createContainerIfNotExists(containerName, function (createError, container) {
        assert.equal(createError, null);
        assert.notEqual(container, null);
        blobName = suite.getName(blobNamesPrefix).toLowerCase();
        var blobText = 'lease-test-blob';
        blobService.createBlockBlobFromText(containerName, blobName, blobText, function (uploadError, blob, uploadResponse) {
          assert.equal(uploadError, null);
          assert.notEqual(blob, null);
          assert.ok(uploadResponse.isSuccessful);
          done();
        });
      });
    });
  });

  afterEach(function (done) {
    var options = {
      leaseBreakPeriod: 0
    };

    blobService.breakLease(containerName, null, options, function(leaseError){
      blobService.deleteContainer(containerName, function (deleteError) {
        assert.equal(deleteError, null);
        suite.teardownTest(done);
      });
    });
  });

  describe('acquireBlobLease', function () {
    it('should work without options specified', function (done) {
      // Acquire a lease
      blobService.acquireLease(containerName, blobName, function (leaseError, lease, leaseResponse) {
        assert.equal(leaseError, null);
        assert.notEqual(lease, null);
        assert.ok(lease.id);
        assert.notEqual(lease.etag, null);
        assert.notEqual(lease.lastModified, null);

        assert.notEqual(leaseResponse, null);
        assert.ok(leaseResponse.isSuccessful);

        // Second lease should not be possible
        blobService.acquireLease(containerName, blobName, function (leaseError, lease, leaseResponse) {
          assert.equal(leaseError.code, 'LeaseAlreadyPresent');
          assert.equal(lease, null);
          assert.equal(leaseResponse.isSuccessful, false);

          // Delete should not be possible
          blobService.deleteBlob(containerName, blobName, function (deleteError, deleteResponse) {
            assert.equal(deleteError.code, 'LeaseIdMissing');
            assert.equal(deleteResponse.isSuccessful, false);
            done();
          });
        });
      });
    });

    it('should work with options specified', function (done) {
      // Acquire a lease
      var options = {
        leaseDuration: 30,
        proposedLeaseId: proposedLeaseIdGuid
      };

      blobService.acquireLease(containerName, blobName, options, function (leaseError, lease, leaseResponse) {
        assert.equal(leaseError, null);
        assert.notEqual(lease, null);
        assert.strictEqual(lease.id, options.proposedLeaseId);
        assert.notEqual(lease.etag, null);
        assert.notEqual(lease.lastModified, null);

        assert.notEqual(leaseResponse, null);
        assert.ok(leaseResponse.isSuccessful);
        done();
        });
      });
    });

  describe('renewBlobLease', function () {
    it('should work', function (done) {
      // Acquire a lease
      var leaseId;
      blobService.acquireLease(containerName, blobName, function (leaseError, lease, leaseResponse) {
        leaseId = lease.id;
        blobService.renewLease(containerName, blobName, leaseId, function(leaseError, lease, leaseResponse){
          assert.equal(leaseError, null);
          assert.notEqual(lease, null);
          assert.strictEqual(lease.id, leaseId);
          assert.notEqual(lease.etag, null);
          assert.notEqual(lease.lastModified, null);

          assert.notEqual(leaseResponse, null);
          assert.ok(leaseResponse.isSuccessful);
          done();
        });
      });
    });
  });

  describe('changeBlobLease', function () {
    it('should work', function (done) {
      // Acquire a lease
      var leaseId;
      blobService.acquireLease(containerName, blobName, function (leaseError, lease, leaseResponse) {
        leaseId = lease.id;
        blobService.changeLease(containerName, blobName, leaseId, proposedLeaseIdGuid, function(leaseError, lease, leaseResponse){
          assert.equal(leaseError, null);
          assert.notEqual(lease, null);
          assert.strictEqual(lease.id, proposedLeaseIdGuid);
          assert.notEqual(lease.etag, null);
          assert.notEqual(lease.lastModified, null);

          assert.notEqual(leaseResponse, null);
          assert.ok(leaseResponse.isSuccessful);
          done();
        });
      });
    });
  });

  describe('releaseBlobLease', function () {
    it('should work', function (done) {
      // Acquire a lease
      var leaseId;
      blobService.acquireLease(containerName, blobName, function (leaseError, lease, leaseResponse) {
        leaseId = lease.id;
        blobService.releaseLease(containerName, blobName, leaseId, function(leaseError, lease, leaseResponse){
          assert.equal(leaseError, null);
          assert.notEqual(leaseResponse, null);
          assert.ok(leaseResponse.isSuccessful);
          assert.notEqual(lease.etag, null);
          assert.notEqual(lease.lastModified, null);

          // should be able to immediately acquire lease
          blobService.acquireLease(containerName, blobName, function (leaseError, lease, leaseResponse) {
            assert.equal(leaseError, null);
            assert.notEqual(lease, null);
            assert.ok(lease.id);

            assert.notEqual(leaseResponse, null);
            assert.ok(leaseResponse.isSuccessful);
            done();
          });
        });
      });
    });
  });

  describe('breakBlobLease', function () {
    it('should work without options specified', function (done) {
      // Acquire a lease
      var leaseId;
      blobService.acquireLease(containerName, blobName, function (leaseError, lease, leaseResponse) {
        leaseId = lease.id;
        blobService.breakLease(containerName, blobName, function(leaseError, lease, leaseResponse){
          assert.equal(leaseError, null);
          assert.notEqual(lease, null);
          assert.strictEqual(lease.time, 0);
          assert.notEqual(leaseResponse, null);
          assert.ok(leaseResponse.isSuccessful);
          assert.notEqual(lease.etag, null);
          assert.notEqual(lease.lastModified, null);

          // should be able to immediately acquire lease
          blobService.acquireLease(containerName, blobName, function (leaseError, lease, leaseResponse) {
            assert.equal(leaseError, null);
            assert.notEqual(lease, null);
            assert.notEqual(leaseResponse, null);
            assert.ok(leaseResponse.isSuccessful);
            done();
          });
        });
      });
    });

    it('should work with options specified', function (done) {
      // Acquire a lease
      var options = {
        leaseDuration: 30,
        proposedLeaseId: proposedLeaseIdGuid
      };

      var leaseId;
      blobService.acquireLease(containerName, blobName, options, function (leaseError, lease, leaseResponse) {
        leaseId = lease.id;
        assert.equal(leaseError, null);
        assert.notEqual(lease, null);
        assert.strictEqual(lease.id, options.proposedLeaseId);

        assert.notEqual(leaseResponse, null);
        assert.ok(leaseResponse.isSuccessful);

        options = { leaseBreakPeriod: 5 };
        blobService.breakLease(containerName, blobName, options, function(leaseError, lease, leaseResponse){
          assert.equal(leaseError, null);
          assert.notEqual(lease, null);
          assert.ok(lease.time);

          assert.notEqual(leaseResponse, null);
          assert.ok(leaseResponse.isSuccessful);
          done();
        });
      });
    });

    it('should work with 0s specified', function (done) {
      // Acquire a lease
      var options = {
        leaseDuration: 30,
        proposedLeaseId: proposedLeaseIdGuid
      }
      var leaseId;
      blobService.acquireLease(containerName, blobName, options, function (leaseError, lease, leaseResponse) {
        leaseId = lease.id;
        assert.equal(leaseError, null);
        assert.notEqual(lease, null);
        assert.strictEqual(lease.id, options.proposedLeaseId);

        assert.notEqual(leaseResponse, null);
        assert.ok(leaseResponse.isSuccessful);

        options = { leaseBreakPeriod: 0 };

        blobService.breakLease(containerName, blobName, options, function(leaseError, lease, leaseResponse){
          assert.equal(leaseError, null);
          assert.notEqual(lease, null);
          assert.strictEqual(lease.time, 0);

          assert.notEqual(leaseResponse, null);
          assert.ok(leaseResponse.isSuccessful);

          // should be able to immediately acquire new lease
          blobService.acquireLease(containerName, blobName, function (leaseError, lease, leaseResponse) {
            assert.equal(leaseError, null);
            assert.notEqual(lease, null);
            assert.ok(lease.id);

            assert.notEqual(leaseResponse, null);
            assert.ok(leaseResponse.isSuccessful);
            done();
          });
        });
      });
    });
  });

  describe('acquireContainerLease', function () {
    it('should work without options specified', function (done) {
      // Acquire a lease
      blobService.acquireLease(containerName, null, function (leaseError, lease, leaseResponse) {
        assert.equal(leaseError, null);
        assert.notEqual(lease, null);
        assert.ok(lease.id);
        assert.notEqual(lease.etag, null);
        assert.notEqual(lease.lastModified, null);

        assert.notEqual(leaseResponse, null);
        assert.ok(leaseResponse.isSuccessful);

        // Second lease should not be possible
        blobService.acquireLease(containerName, null, function (leaseError, lease, leaseResponse) {
          assert.equal(leaseError.code, 'LeaseAlreadyPresent');
          assert.equal(lease, null);
          assert.equal(leaseResponse.isSuccessful, false);

          // Delete should not be possible
          blobService.deleteContainer(containerName, function (deleteError, deleteResponse) {
            assert.equal(deleteError.code, 'LeaseIdMissing');
            assert.equal(deleteResponse.isSuccessful, false);
            done();
          });
        });
      });
    });

    it('should work with options specified', function (done) {
      // Acquire a lease
      var options = {
        leaseDuration: 30,
        proposedLeaseId: proposedLeaseIdGuid
      };

      blobService.acquireLease(containerName, null, options, function (leaseError, lease, leaseResponse) {
        assert.equal(leaseError, null);
        assert.notEqual(lease, null);
        assert.strictEqual(lease.id, options.proposedLeaseId);

        assert.notEqual(leaseResponse, null);
        assert.ok(leaseResponse.isSuccessful);
        done();
      });
    });
  });

  describe('leaseWithAppendFromText', function () {
    it('should work without options specified', function (done) {
      var tempAppendBlobName = suite.getName(blobNamesPrefix).toLowerCase();

      blobService.createAppendBlobFromText(containerName, tempAppendBlobName, "CreateText", function (createErr, out) {
        assert.equal(createErr, null);

        blobService.acquireLease(containerName, tempAppendBlobName, function (leaseError, lease, leaseResponse) {
          assert.equal(leaseError, null);
          assert.notEqual(lease, null);
          assert.ok(lease.id);
          assert.notEqual(lease.etag, null);
          assert.notEqual(lease.lastModified, null);
          assert.notEqual(leaseResponse, null);
          assert.ok(leaseResponse.isSuccessful);

          var option = {leaseId: lease.id};

          blobService.appendFromText(containerName, tempAppendBlobName, "AppendText", option, function (appendErr) {
            assert.equal(appendErr, null);
            blobService.getBlobToText(containerName, tempAppendBlobName, function (getErr, blobText, blobResult, response) {
              assert.equal(getErr, null);
              assert.ok(response.isSuccessful);
              assert.notEqual(blobResult, null);
              assert.equal(blobText, "CreateTextAppendText");
              done();
            });
          });
        });
      });
    });
  });

  describe('leaseWithResizePageBlob', function () {
    it('should work without options specified', function (done) {
      var tempAppendBlobName = suite.getName(blobNamesPrefix).toLowerCase();

      blobService.createPageBlob(containerName, tempAppendBlobName, 1024, function (createErr) {
        assert.equal(createErr, null);

        blobService.acquireLease(containerName, tempAppendBlobName, function (acquireErr, lease) {
          assert.equal(acquireErr, null);
          assert.ok(lease.id);

          var option = {leaseId: lease.id};

          blobService.getBlobProperties(containerName, tempAppendBlobName, function (getErr, blob) { //Do not set lease Id by design.
            assert.equal(getErr, null);
            assert.equal(blob.contentLength, 1024);

            blobService.resizePageBlob(containerName, tempAppendBlobName, 2048, option, function (resizeErr) {
              assert.equal(resizeErr, null);

              blobService.getBlobProperties(containerName, tempAppendBlobName, option, function (getErr, blob) { // set lease Id.
                assert.equal(getErr, null);
                assert.equal(blob.contentLength, 2048);
                done();
              });
            });
          });
        });
      });
    });
  });

  describe('renewContainerLease', function () {
    it('should work', function (done) {
      // Acquire a lease
      var leaseId;
      blobService.acquireLease(containerName, null, function (leaseError, lease, leaseResponse) {
        leaseId = lease.id;
        blobService.renewLease(containerName, null, leaseId, function(leaseError, lease, leaseResponse){
          assert.equal(leaseError, null);
          assert.notEqual(lease, null);
          assert.strictEqual(lease.id, leaseId);
          assert.notEqual(lease.etag, null);
          assert.notEqual(lease.lastModified, null);

          assert.notEqual(leaseResponse, null);
          assert.ok(leaseResponse.isSuccessful);
          done();
        });
      });
    });
  });

  describe('changeContainerLease', function () {
    it('should work', function (done) {
      // Acquire a lease
      var leaseId;
      blobService.acquireLease(containerName, null, function (leaseError, lease, leaseResponse) {
        leaseId = lease.id;
        blobService.changeLease(containerName, null, leaseId, proposedLeaseIdGuid, function(leaseError, lease, leaseResponse){
          assert.equal(leaseError, null);
          assert.notEqual(lease, null);
          assert.strictEqual(lease.id, proposedLeaseIdGuid);
          assert.notEqual(lease.etag, null);
          assert.notEqual(lease.lastModified, null);

          assert.notEqual(leaseResponse, null);
          assert.ok(leaseResponse.isSuccessful);
          done();
        });
      });
    });
  });

  describe('releaseContainerLease', function () {
    it('should work', function (done) {
      // Acquire a lease
      var leaseId;
      blobService.acquireLease(containerName, null, function (leaseError, lease, leaseResponse) {
        leaseId = lease.id;
        blobService.releaseLease(containerName, null, leaseId, function(leaseError, lease, leaseResponse){
          assert.equal(leaseError, null);

          assert.notEqual(leaseResponse, null);
          assert.ok(leaseResponse.isSuccessful);

          // should be able to immediately acquire lease
          blobService.acquireLease(containerName, null, function (leaseError, lease, leaseResponse) {
            assert.equal(leaseError, null);
            assert.notEqual(lease, null);
            assert.ok(lease.id);

            assert.notEqual(leaseResponse, null);
            assert.ok(leaseResponse.isSuccessful);
            done();
          });
        });
      });
    });
  });

  describe('breakContainerLease', function () {
    it('should work without options specified', function (done) {
      // Acquire a lease
      var leaseId;
      blobService.acquireLease(containerName,null,  function (leaseError, lease, leaseResponse) {
        leaseId = lease.id;
        blobService.breakLease(containerName, null, function(leaseError, lease, leaseResponse){
          assert.equal(leaseError, null);
          assert.notEqual(lease, null);
          assert.strictEqual(lease.time, 0);
          assert.notEqual(lease.etag, null);
          assert.notEqual(lease.lastModified, null);
          
          assert.notEqual(leaseResponse, null);
          assert.ok(leaseResponse.isSuccessful);

          // should be able to immediately acquire lease
          blobService.acquireLease(containerName, null, function (leaseError, lease, leaseResponse) {
            assert.equal(leaseError, null);
            assert.notEqual(lease, null);

            assert.notEqual(leaseResponse, null);
            assert.ok(leaseResponse.isSuccessful);
            done();
          });
        });
      });
    });

    it('should work with options specified', function (done) {
      // Acquire a lease
      var options = {
        leaseDuration: 30,
        proposedLeaseId: proposedLeaseIdGuid
      }
      var leaseId;
      blobService.acquireLease(containerName, null, options, function (leaseError, lease, leaseResponse) {
        leaseId = lease.id;
        assert.equal(leaseError, null);
        assert.notEqual(lease, null);
        assert.strictEqual(lease.id, options.proposedLeaseId);

        assert.notEqual(leaseResponse, null);
        assert.ok(leaseResponse.isSuccessful);

        options = {
          leaseBreakPeriod: 5
        };
        blobService.breakLease(containerName, null, options, function(leaseError, lease, leaseResponse){
          assert.equal(leaseError, null);
          assert.notEqual(lease, null);
          assert.ok(lease.time);

          assert.notEqual(leaseResponse, null);
          assert.ok(leaseResponse.isSuccessful);
          done();
        });
      });
    });

    it('should work with 0s specified', function (done) {
      // Acquire a lease
      var options = {
        leaseDuration: 30,
        proposedLeaseId: proposedLeaseIdGuid
      }
      var leaseId;
      blobService.acquireLease(containerName, null, options, function (leaseError, lease, leaseResponse) {
        leaseId = lease.id;
        assert.equal(leaseError, null);
        assert.notEqual(lease, null);
        assert.strictEqual(lease.id, options.proposedLeaseId);

        assert.notEqual(leaseResponse, null);
        assert.ok(leaseResponse.isSuccessful);

        options = {
          leaseBreakPeriod: 0
        };
        
        blobService.breakLease(containerName, null, options, function(leaseError, lease, leaseResponse){
          assert.equal(leaseError, null);
          assert.notEqual(lease, null);
          assert.strictEqual(lease.time, 0);

          assert.notEqual(leaseResponse, null);
          assert.ok(leaseResponse.isSuccessful);

          // should be able to immediately acquire new lease
          blobService.acquireLease(containerName, null, function (leaseError, lease, leaseResponse) {
            assert.equal(leaseError, null);
            assert.notEqual(lease, null);
            assert.ok(lease.id);

            assert.notEqual(leaseResponse, null);
            assert.ok(leaseResponse.isSuccessful);
            done();
          });
        });
      });
    });
  });
}); // outer describe end