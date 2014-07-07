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
var HttpConstants = Constants.HttpConstants;

var shares = [];
var shareNamesPrefix = 'share-';

var fileService;
var shareName;

describe('FileShare', function () {
  before(function (done) {
    fileService = azure.createFileService()
      .withFilter(new azure.ExponentialRetryPolicyFilter());

    done();
  });

  beforeEach(function (done) {
    shareName = getName(shareNamesPrefix);
    done();
  });

  afterEach(function (done) {
    fileService.deleteShareIfExists(shareName, function (deleteError) {
      assert.equal(deleteError, null);
      done();
    });
  });

  describe('doesShareExist', function () {
    it('should work', function (done) {
      fileService.doesShareExist(shareName, function (existsError, exists) {
        assert.equal(existsError, null);
        assert.strictEqual(exists, false);

        fileService.createShare(shareName, function (createError, share1, createShareResponse) {
          assert.equal(createError, null);
          assert.notEqual(share1, null);
          assert.equal(createShareResponse.statusCode, HttpConstants.HttpResponseCodes.Created);

          fileService.doesShareExist(shareName, function (existsError, exists) {
            assert.equal(existsError, null);
            assert.strictEqual(exists, true);
            done();
          });
        });
      });
    });
  });

  describe('createShare', function () {
    it('should detect incorrect share names', function (done) {
      assert.throws(function () { fileService.createShare(null, function () { }); },
        /Required argument share for function createShare is not defined/);

      assert.throws(function () { fileService.createShare('', function () { }); },
        /Required argument share for function createShare is not defined/);

      assert.throws(function () { fileService.createShare('as', function () { }); },
        /Share name must be between 3 and 63 characters long./);

      assert.throws(function () { fileService.createShare('a--s', function () { }); },
        /Share name format is incorrect./);

      assert.throws(function () { fileService.createShare('cont-', function () { }); },
        /Share name format is incorrect./);

      assert.throws(function () { fileService.createShare('conTain', function () { }); },
        /Share name format is incorrect./);

      done();
    });

    it('should work', function (done) {
      fileService.createShare(shareName, function (createError, share1, createShareResponse) {
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

          fileService.deleteShare(shareName, function (deleteError) {
              assert.equal(deleteError, null);
              done();
            });
        });
      });
    });
  });

  describe('createShareIfNotExists', function() {
    it('should create a share if not exists', function (done) {
      fileService.createShareIfNotExists(shareName, function (createError, created) {
        assert.equal(createError, null);
        assert.equal(created, true);

        fileService.doesShareExist(shareName, function (existsError, exists) {
          assert.equal(existsError, null);
          assert.equal(exists, true);

          fileService.createShareIfNotExists(shareName, function (createError2, created2) {
            assert.equal(createError2, null);
            assert.equal(created2, false);

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
        Error
      );

      done();
    });
  });

  describe('deleteShareIfExists', function() {
    it('should delete a share if exists', function (done) {
      fileService.doesShareExist(shareName, function(existsError, exists){
        assert.equal(existsError, null);
        assert.strictEqual(exists, false);

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

              fileService.doesShareExist(shareName, function(existsError, exists){
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
      assert.throws(function () { fileService.deleteShareIfExists('name'); },
        Error
      );
      done();
    });
  });

  describe('getShareProperties', function () {
    it('should work', function (done) {
      fileService.createShareIfNotExists(shareName, function (createError, created) {
        assert.equal(createError, null);
        assert.equal(created, true);

        var metadata = { 'color': 'blue' };
        fileService.setShareMetadata(shareName, metadata, function (setMetadataError, setMetadataResult, setMetadataResponse) {
          assert.equal(setMetadataError, null);
          assert.ok(setMetadataResponse.isSuccessful);

          fileService.getShareProperties(shareName, function (getError, share2, getResponse) {
            assert.equal(getError, null);
            assert.notEqual(share2, null);
            assert.notEqual(null, share2.requestId);
            assert.strictEqual(share2.metadata.color, metadata.color);

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
      fileService.createShareIfNotExists(shareName, function (createError, created) {
        assert.equal(createError, null);
        assert.equal(created, true);

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
  });

  describe('setShareMetadataThrows', function () {
    it('should work', function (done) {
      function setShareMetadata(shareName, metadata) {
        fileService.setShareMetadata(shareName, metadata, function(){});
      }

      assert.throws( function() { setShareMetadata(shareName, {'' : 'value1'}); },
        function (err) {return (err instanceof Error) && err.message === SR.METADATA_KEY_INVALID});
      assert.throws( function() { setShareMetadata(shareName, {' ' : 'value1'}); },
        function (err) {return (err instanceof Error) && err.message === SR.METADATA_KEY_INVALID});
      assert.throws( function() { setShareMetadata(shareName, {'\n\t' : 'value1'}); },
        function (err) {return (err instanceof Error) && err.message === SR.METADATA_KEY_INVALID});

      assert.throws( function() { setShareMetadata(shareName, {'key1' : null}); },
        function (err) {return (err instanceof Error) && err.message === SR.METADATA_VALUE_INVALID});
      assert.throws( function() { setShareMetadata(shareName, {'key1' : ''}); },
        function (err) {return (err instanceof Error) && err.message === SR.METADATA_VALUE_INVALID});
      assert.throws( function() { setShareMetadata(shareName, {'key1' : '\n\t'}); },
        function (err) {return (err instanceof Error) && err.message === SR.METADATA_VALUE_INVALID});
      assert.throws( function() { setShareMetadata(shareName, {'key1' : ' '}); },
        function (err) {return (err instanceof Error) && err.message === SR.METADATA_VALUE_INVALID});

      done();
    });
  });

  describe('listShares', function () {
    it('shouldWork', function (done) {
      var shareName1 = getName(shareNamesPrefix);
      var metadata1 = {
        color: 'orange',
        sharenumber: '01',
        somemetadataname: 'SomeMetadataValue'
      };

      var shareName2 = getName(shareNamesPrefix);
      var metadata2 = {
        color: 'pink',
        sharenumber: '02',
        somemetadataname: 'SomeMetadataValue'
      };

      var shareName3 = getName(shareNamesPrefix);
      var metadata3 = {
        color: 'brown',
        sharenumber: '03',
        somemetadataname: 'SomeMetadataValue'
      };

      var shareName4 = getName(shareNamesPrefix);
      var metadata4 = {
        color: 'blue',
        sharenumber: '04',
        somemetadataname: 'SomeMetadataValue'
      };

      var validateAndDeleteShares = function (shares, entries) {
        shares.forEach(function (share) {
          if (share.name == shareName1) {
            assert.equal(share.metadata.color, metadata1.color);
            assert.equal(share.metadata.sharenumber, metadata1.sharenumber);
            assert.equal(share.metadata.somemetadataname, metadata1.somemetadataname);
            entries.push(share.name);

            fileService.deleteShare(share.name, function (deleteError1) {
              assert.equal(null, deleteError1);
            });
          }
          else if (share.name == shareName2) {
            assert.equal(share.metadata.color, metadata2.color);
            assert.equal(share.metadata.sharenumber, metadata2.sharenumber);
            assert.equal(share.metadata.somemetadataname, metadata2.somemetadataname);
            entries.push(share.name);

            fileService.deleteShare(share.name, function (deleteError2) {
              assert.equal(null, deleteError2);
            });
          }
          else if (share.name == shareName3) {
            assert.equal(share.metadata.color, metadata3.color);
            assert.equal(share.metadata.sharenumber, metadata3.sharenumber);
            assert.equal(share.metadata.somemetadataname, metadata3.somemetadataname);
            entries.push(share.name);

            fileService.deleteShare(share.name, function (deleteError3) {
              assert.equal(null, deleteError3);
            });
          }
          else if (share.name == shareName4) {
            assert.equal(share.metadata.color, metadata4.color);
            assert.equal(share.metadata.sharenumber, metadata4.sharenumber);
            assert.equal(share.metadata.somemetadataname, metadata4.somemetadataname);
            entries.push(share.name);

            fileService.deleteShare(share.name, function (deleteError4) {
              assert.equal(null, deleteError4);
            });
          }
        });

        return entries;
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

              shares.length = 0;
              listShares(shareNamesPrefix, options, null, function () {
                var entries = [];
                validateAndDeleteShares(shares, entries);
                assert.equal(entries.length, 4);
                done();
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
          shares.push.apply(shares, result.entries);
          var token = result.continuationToken;
          if(token) {
            listSharesWithoutPrefix(options, token, callback);
          }
          else {
            callback();
          }
        });
      };

      listSharesWithoutPrefix(null, null, function () {
        done();
      });
    });

    it('strangePrefix', function (done) {
      shares.length = 0;
      listShares('中文', null, null, function () {
        assert.equal(shares.length, 0);
        done();
      });
    });
  });
});

function listShares (prefix, options, token, callback) {
  fileService.listSharesSegmentedWithPrefix(prefix, token, options, function(error, result) {
    assert.equal(error, null);
    shares.push.apply(shares, result.entries);
    var token = result.continuationToken;
    if(token) {
      listShares(prefix, options, token, callback);
    }
    else {
      callback();
    }
  });
}

function getName (prefix){
  return prefix + guid.v1().toLowerCase();
}