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

var should = require('should');
var assert = require('assert');

var testutil = require('../../framework/util');
var Validate = require('../../../lib/common/util/validate');

describe('validator-tests', function () {
  it('isValidEnumValue should work', function (done) {
    Validate.isValidEnumValue('a', ['a', 'b', 'c']).should.be.ok;
    assert.throws(
      function() {
        Validate.isValidEnumValue('d', ['a', 'b', 'c']);
      },
      function(err) {
        return (err instanceof RangeError) && err.message === 'Invalid value: d. Options are: a,b,c.';
      }
    );
    done();
  });
  
  it('isValidUri should work', function (done) {
    Validate.isValidUri('http://www.microsoft.com').should.be.ok;
    Validate.isValidUri('http://www.microsoft.com').should.equal(true);
    assert.throws(
      function() {
        Validate.isValidUri('something');
      },
      function(err) {
        return (err instanceof URIError) && err.message == 'The provided URI "something" is invalid.' 
      }
    );
    done();
  });
  
  it('isValidHost should work', function (done) {
    Validate.isValidHost('http://www.microsoft.com').should.be.ok;
    assert.throws(
      function() {
        Validate.isValidHost('something');
      },
      function(err) {
        return (err instanceof URIError) && err.message == 'The provided URI "something" is invalid.' 
      }
    );
    done();
  });
  
  it('isValidUuid should work', function (done) {
    Validate.isValidUuid('3c9c1238-ea95-4f57-842d-66012ff4b503').should.be.ok;
    assert.throws(
      function() {
        Validate.isValidUuid('something');
      },
      function(err) {
        return (err instanceof SyntaxError) && err.message == 'The value is not a valid UUID format.' 
      }
    );
    done();
  });

  it('isBase64Encoded should work', function (done) {
    Validate.isBase64Encoded('AhlzsbLRkjfwObuqff3xrhB2yWJNh1EMptmcmxFJ6fvPTVX3PZXwrG2YtYWf5DPMVgNsteKStM5iBLlknYFVoA==').should.be.ok;
    var key = '__A&*INVALID-@Key';
    assert.throws(
      function() {
        Validate.isBase64Encoded(key);
      },
      function(err) {
        return (err instanceof SyntaxError) && err.message == 'The provided account key ' + key + ' is not a valid base64 string.'
      }
    );
    done();
  });
  
  it('isValidFunction should work', function (done) {
    var test = function () {};
    Validate.isValidFunction(test).should.equal(true);
    assert.throws(
      function() {
        Validate.isValidFunction('something', 'testFunc');
      },
      function(err) {
        return (err instanceof TypeError) && err.message === 'testFunc specified should be a function.';
      }
    );
    done();
  });
  
  it('containerNameIsValid should work', function (done) {
    Validate.containerNameIsValid('aaaaaa').should.equal(true);
    Validate.containerNameIsValid('$root').should.equal(true);
    Validate.containerNameIsValid('$web').should.equal(true);
    Validate.containerNameIsValid('$logs').should.equal(true);
    assert.throws(
      function() {
        Validate.containerNameIsValid('');
      },
      function(err) {
        return (typeof err.name === 'undefined' || err.name === 'ArgumentNullError') && err.message === 'Container name must be a non empty string.';
      }
    );
    assert.throws(
      function() {
        Validate.containerNameIsValid('aa');
      },
      function(err) {
        return (typeof err.name === 'undefined' || err.name === 'ArgumentError') && err.message === 'Container name must be between 3 and 63 characters long.';
      }
    );
    assert.throws(
      function() {
        Validate.containerNameIsValid('a[b]');
      },
      function(err) {
        return (err instanceof SyntaxError) && err.message === 'Container name format is incorrect.'; 
      }
    );
    done();
  });
  
  it('blobNameIsValid should work', function (done) {
    Validate.blobNameIsValid('aaaaaa', 'bbbbbb').should.equal(true);
    Validate.blobNameIsValid('$logs', 'a/b/c').should.equal(true);
    Validate.blobNameIsValid('$logs', '@#$%').should.equal(true);
    assert.throws(
      function() {
        Validate.blobNameIsValid('aaaaaa', '');
      },
      function(err) {
        return (typeof err.name === 'undefined' || err.name === 'ArgumentNullError') && err.message === 'Blob name is not specified.';
      }
    );
    assert.throws(
      function() {
        Validate.blobNameIsValid('$root', 'a/b/c');
      },
      function(err) {
        return (err instanceof SyntaxError) && err.message === 'Blob name format is incorrect.'; 
      }
    );
    done();
  });
  
  it('shareNameIsValid should work', function (done) {
    Validate.shareNameIsValid('aaaaaa').should.equal(true);
    assert.throws(
      function() {
        Validate.shareNameIsValid('');
      },
      function(err) {
        return (typeof err.name === 'undefined' || err.name === 'ArgumentNullError') && err.message === 'Share name must be a non empty string.';
      }
    );
    assert.throws(
      function() {
        Validate.shareNameIsValid('aa');
      },
      function(err) {
        return (typeof err.name === 'undefined' || err.name === 'ArgumentError') && err.message === 'Share name must be between 3 and 63 characters long.';
      }
    );
    assert.throws(
      function() {
        Validate.shareNameIsValid('a[b]');
      },
      function(err) {
        return (err instanceof SyntaxError) && err.message === 'Share name format is incorrect.';
      }
    );
    done();
  });
  
  it('queueNameIsValid should work', function (done) {
    Validate.queueNameIsValid('aaaaaa').should.equal(true);
    assert.throws(
      function() {
        Validate.queueNameIsValid('');
      },
      function(err) {
        return (typeof err.name === 'undefined' || err.name === 'ArgumentNullError') && err.message === 'Queue name must be a non empty string.';
      }
    );
    assert.throws(
      function() {
        Validate.queueNameIsValid('aa');
      },
      function(err) {
        return (typeof err.name === 'undefined' || err.name === 'ArgumentError') && err.message === 'Queue name must be between 3 and 63 characters long.';
      }
    );
    assert.throws(
      function() {
        Validate.queueNameIsValid('a[b]');
      },
      function(err) {
        return (err instanceof SyntaxError) && err.message === 'Queue name format is incorrect.'; 
      }
    );
    done();
  });
  
  it('tableNameIsValid should work', function (done) {
    Validate.tableNameIsValid('aaaaaa').should.equal(true);
    Validate.tableNameIsValid('$MetricsCapacityBlob').should.equal(true);
    Validate.tableNameIsValid('$MetricsHourPrimaryTransactionsBlob').should.equal(true);
    Validate.tableNameIsValid('$MetricsHourPrimaryTransactionsQueue').should.equal(true);
    Validate.tableNameIsValid('$MetricsHourPrimaryTransactionsTable').should.equal(true);
    Validate.tableNameIsValid('$MetricsHourPrimaryTransactionsFile').should.equal(true);
    Validate.tableNameIsValid('$MetricsMinutePrimaryTransactionsBlob').should.equal(true);
    Validate.tableNameIsValid('$MetricsMinutePrimaryTransactionsQueue').should.equal(true);
    Validate.tableNameIsValid('$MetricsMinutePrimaryTransactionsTable').should.equal(true);
    Validate.tableNameIsValid('$MetricsMinutePrimaryTransactionsFile').should.equal(true);
    Validate.tableNameIsValid('$MetricsHourSecondaryTransactionsBlob').should.equal(true);
    Validate.tableNameIsValid('$MetricsHourSecondaryTransactionsQueue').should.equal(true);
    Validate.tableNameIsValid('$MetricsHourSecondaryTransactionsTable').should.equal(true);
    Validate.tableNameIsValid('$MetricsHourSecondaryTransactionsFile').should.equal(true);
    Validate.tableNameIsValid('$MetricsMinuteSecondaryTransactionsBlob').should.equal(true);
    Validate.tableNameIsValid('$MetricsMinuteSecondaryTransactionsQueue').should.equal(true);
    Validate.tableNameIsValid('$MetricsMinuteSecondaryTransactionsTable').should.equal(true);
    Validate.tableNameIsValid('$MetricsMinuteSecondaryTransactionsFile').should.equal(true);
    assert.throws(
      function() {
        Validate.tableNameIsValid('');
      },
      function(err) {
        return (typeof err.name === 'undefined' || err.name === 'ArgumentNullError') && err.message === 'Table name must be a non empty string.'; 
      }
    );
    assert.throws(
      function() {
        Validate.tableNameIsValid('aa');
      },
      function(err) {
        return (typeof err.name === 'undefined' || err.name === 'ArgumentError') && err.message === 'Table name must be between 3 and 63 characters long.';
      }
    );
    assert.throws(
      function() {
        Validate.tableNameIsValid('a[b]');
      },
      function(err) {
        return (err instanceof SyntaxError) && err.message === 'Table name format is incorrect.'; 
      }
    );
    done();
  });
  
  it('pageRangesAreValid should work', function (done) {
    Validate.pageRangesAreValid(512, 1023, 1024 * 1024).should.equal(true);
    assert.throws(
      function() {
        Validate.pageRangesAreValid(1, 1023, 1024 * 1024).should.equal(true);
      },
      function(err) {
        return (err instanceof RangeError) && err.message === 'Start byte offset must be a multiple of 512.';
      }
    );
    assert.throws(
      function() {
        Validate.pageRangesAreValid(0, 1024, 1024 * 1024).should.equal(true);
      },
      function(err) {
        return (err instanceof RangeError) && err.message === 'End byte offset must be a multiple of 512 minus 1.';
      }
    );
    assert.throws(
      function() {
        Validate.pageRangesAreValid(0, 1024 * 1024 + 511, 1024 * 1024);
      },
      function(err) {
        return (err instanceof RangeError) && err.message === 'Page blob size cannot be larger than ' + (1024 * 1024) + ' bytes.';
      }
    );
    done();
  });
  
  it('blobTypeIsValid should work', function (done) {
    Validate.blobTypeIsValid('BlockBlob').should.be.ok;
    Validate.blobTypeIsValid('PageBlob').should.be.ok;
    Validate.blobTypeIsValid('AppendBlob').should.be.ok;
    assert.throws(
      function() {
        Validate.blobTypeIsValid('something');
      },
      function(err) {
        return (err instanceof RangeError) && err.message === 'Invalid value: something. Options are: BlockBlob,PageBlob,AppendBlob.';
      }
    );
    done();
  });
  
  it('shareACLIsValid should work', function (done) {
    Validate.shareACLIsValid(null).should.be.ok;
    assert.throws(
      function() {
        Validate.shareACLIsValid('share');
      },
      function(err) {
        return (typeof err.name === 'undefined' || err.name === 'ArgumentError') && err.message === 'The access type is not supported.';
      }
    );
    assert.throws(
      function() {
        Validate.shareACLIsValid('file');
      },
      function(err) {
        return (typeof err.name === 'undefined' || err.name === 'ArgumentError') && err.message === 'The access type is not supported.';
      }
    );
    done();
  });
  
  it('shareQuotaIsValid should work', function (done) {
    Validate.shareQuotaIsValid(null).should.be.ok;
    assert.throws(
      function() {
      Validate.shareQuotaIsValid(-1);
      },
      function(err) {
      return (err instanceof RangeError) && err.message === 'The share quota value, in GB, must be greater than 0.';
      }
    );
    done();
  });
});