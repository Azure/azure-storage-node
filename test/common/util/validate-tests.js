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

var testutil = require('../../framework/util');
var Validate = testutil.libRequire('common/util/validate');

describe('validator-tests', function () {
  it('isValidEnumValue should work', function (done) {
    Validate.isValidEnumValue('a', ['a', 'b', 'c']).should.be.ok;
    (function() {
      Validate.isValidEnumValue('d', ['a', 'b', 'c']);
    }).should.throw('Invalid value: d. Options are: a,b,c.');
    done();
  });
  
  it('isValidUri should work', function (done) {
    Validate.isValidUri('http://www.microsoft.com').should.be.ok;
    Validate.isValidUri('http://www.microsoft.com').should.equal(true);
    (function() {
      Validate.isValidUri('something');
    }).should.throw('The provided URI "something" is invalid.');
    done();
  });
  
  it('isValidHost should work', function (done) {
    Validate.isValidHost('http://www.microsoft.com').should.be.ok;
    (function() {
      Validate.isValidHost('something');
    }).should.throw('The provided URI "something" is invalid.');
    done();
  });
  
  it('isValidUuid should work', function (done) {
    Validate.isValidUuid('3c9c1238-ea95-4f57-842d-66012ff4b503').should.be.ok;
    (function() {
      Validate.isValidUuid('something');
    }).should.throw('The value is not a valid UUID format.');
    done();
  });

  it('isBase64Encoded should work', function (done) {
    Validate.isBase64Encoded('AhlzsbLRkjfwObuqff3xrhB2yWJNh1EMptmcmxFJ6fvPTVX3PZXwrG2YtYWf5DPMVgNsteKStM5iBLlknYFVoA==').should.be.ok;
    var key = '__A&*INVALID-@Key';
    (function() {
      Validate.isBase64Encoded(key);
    }).should.throw('The provided account key ' + key + ' is not a valid base64 string.');
    done();
  });
  
  it('isValidFunction should work', function (done) {
    var test = function () {};
    Validate.isValidFunction(test).should.equal(true);
    (function() {
      Validate.isValidFunction('something', 'testFunc');
    }).should.throw('testFunc must be specified.');
    done();
  });
  
  it('containerNameIsValid should work', function (done) {
    Validate.containerNameIsValid('aaaaaa').should.equal(true);
    Validate.containerNameIsValid('$root').should.equal(true);
    Validate.containerNameIsValid('$logs').should.equal(true);
    (function() {
      Validate.containerNameIsValid('');
    }).should.throw('Container name must be a non empty string.');
    (function() {
      Validate.containerNameIsValid('aa');
    }).should.throw('Container name must be between 3 and 63 characters long.');
    (function() {
      Validate.containerNameIsValid('a[b]');
    }).should.throw('Container name format is incorrect.');
    done();
  });
  
  it('blobNameIsValid should work', function (done) {
    Validate.blobNameIsValid('aaaaaa', 'bbbbbb').should.equal(true);
    Validate.blobNameIsValid('$logs', 'a/b/c').should.equal(true);
    Validate.blobNameIsValid('$logs', '@#$%').should.equal(true);
    (function() {
      Validate.blobNameIsValid('aaaaaa', '');
    }).should.throw('Blob name is not specified.');
    (function() {
      Validate.blobNameIsValid('$root', 'a/b/c');
    }).should.throw('Blob name format is incorrect.');
    done();
  });
  
  it('shareNameIsValid should work', function (done) {
    Validate.shareNameIsValid('aaaaaa').should.equal(true);
    (function() {
      Validate.shareNameIsValid('');
    }).should.throw('Share name must be a non empty string.');
    (function() {
      Validate.shareNameIsValid('aa');
    }).should.throw('Share name must be between 3 and 63 characters long.');
    (function() {
      Validate.shareNameIsValid('a[b]');
    }).should.throw('Share name format is incorrect.');
    done();
  });
  
  it('queueNameIsValid should work', function (done) {
    Validate.queueNameIsValid('aaaaaa').should.equal(true);
    (function() {
      Validate.queueNameIsValid('');
    }).should.throw('Queue name must be a non empty string.');
    (function() {
      Validate.queueNameIsValid('aa');
    }).should.throw('Queue name must be between 3 and 63 characters long.');
    (function() {
      Validate.queueNameIsValid('a[b]');
    }).should.throw('Queue name format is incorrect.');
    done();
  });
  
  it('tableNameIsValid should work', function (done) {
    Validate.tableNameIsValid('aaaaaa').should.equal(true);
    Validate.tableNameIsValid('$MetricsCapacityBlob').should.equal(true);
    Validate.tableNameIsValid('$MetricsHourPrimaryTransactionsBlob').should.equal(true);
    Validate.tableNameIsValid('$MetricsHourPrimaryTransactionsQueue').should.equal(true);
    Validate.tableNameIsValid('$MetricsHourPrimaryTransactionsTable').should.equal(true);
    Validate.tableNameIsValid('$MetricsMinutePrimaryTransactionsBlob').should.equal(true);
    Validate.tableNameIsValid('$MetricsMinutePrimaryTransactionsQueue').should.equal(true);
    Validate.tableNameIsValid('$MetricsMinutePrimaryTransactionsTable').should.equal(true);
    Validate.tableNameIsValid('$MetricsHourSecondaryTransactionsBlob').should.equal(true);
    Validate.tableNameIsValid('$MetricsHourSecondaryTransactionsQueue').should.equal(true);
    Validate.tableNameIsValid('$MetricsHourSecondaryTransactionsTable').should.equal(true);
    Validate.tableNameIsValid('$MetricsMinuteSecondaryTransactionsBlob').should.equal(true);
    Validate.tableNameIsValid('$MetricsMinuteSecondaryTransactionsQueue').should.equal(true);
    Validate.tableNameIsValid('$MetricsMinuteSecondaryTransactionsTable').should.equal(true);
    (function() {
      Validate.tableNameIsValid('');
    }).should.throw('Table name must be a non empty string.');
    (function() {
      Validate.tableNameIsValid('aa');
    }).should.throw('Table name must be between 3 and 63 characters long.');
    (function() {
      Validate.tableNameIsValid('a[b]');
    }).should.throw('Table name format is incorrect.');
    done();
  });
  
  it('pageRangesAreValid should work', function (done) {
    Validate.pageRangesAreValid(512, 1023, 1024 * 1024).should.equal(true);
    (function() {
      Validate.pageRangesAreValid(1, 1023, 1024 * 1024).should.equal(true);
    }).should.throw('Start byte offset must be a modulus of 512.');
    (function() {
      Validate.pageRangesAreValid(0, 1024, 1024 * 1024).should.equal(true);
    }).should.throw('End byte offset must be a modulus of 512 minus 1.');
    (function() {
      Validate.pageRangesAreValid(0, 1024 * 1024 + 511, 1024 * 1024);
    }).should.throw('Page blob size cant be larger than ' + (1024 * 1024) + ' bytes.');
    done();
  });
  
  it('blobTypeIsValid should work', function (done) {
    Validate.blobTypeIsValid('BlockBlob').should.be.ok;
    Validate.blobTypeIsValid('PageBlob').should.be.ok;
    Validate.blobTypeIsValid('AppendBlob').should.be.ok;
    (function() {
      Validate.blobTypeIsValid('something');
    }).should.throw('Invalid value: something. Options are: BlockBlob,PageBlob,AppendBlob.');
    done();
  });
  
  it('shareACLIsValid should work', function (done) {
    Validate.shareACLIsValid(null).should.be.ok;
    (function() {
      Validate.shareACLIsValid('share');
    }).should.throw('The access type is not supported.');
    (function() {
      Validate.shareACLIsValid('file');
    }).should.throw('The access type is not supported.');
    done();
  });
  
  it('shareQuotaIsValid should work', function (done) {
    Validate.shareQuotaIsValid(null).should.be.ok;
    (function() {
      Validate.shareQuotaIsValid(-1);
    }).should.throw('The share quota value, in GB, must be greater than 0.');
    done();
  });
});