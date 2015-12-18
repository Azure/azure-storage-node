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

// Test includes
var testutil = require('../../framework/util');

// Lib includes
var util = testutil.libRequire('common/util/util');
var speedSummary = testutil.libRequire('common/streams/speedsummary');

describe('util-tests', function() {
  it('should be an empty object', function (done) {
    assert.equal(util.objectIsEmpty(null), true);
    assert.equal(util.objectIsEmpty({}), true);
    assert.equal(util.objectIsEmpty({ a: '1' }), false);
    assert.equal(util.objectIsEmpty({ a: '1', b: '2' }), false);

    done();
  });

  it('should be a string', function (done) {
    assert.equal(util.objectIsString(''), true);
    assert.equal(util.objectIsString('hi'), true);
    assert.equal(util.objectIsString(null), false);
    assert.equal(util.objectIsString({}), false);
    assert.equal(util.objectIsString({ a: '1' }), false);

    done();
  });

  it('should be an empty string', function (done) {
    assert.equal(util.stringIsEmpty(''), true);
    assert.equal(util.stringIsEmpty(null), true);
    assert.equal(util.stringIsEmpty(undefined), true);
    assert.equal(util.stringIsEmpty('a'), false);
    assert.equal(util.stringIsEmpty(' '), false);

    done();
  });

  it('should start with', function (done) {
    assert.equal(util.stringStartsWith('test', 't'), true);
    assert.equal(util.stringStartsWith('test', 'e'), false);
    assert.equal(util.stringStartsWith('test', ''), true);
    assert.equal(util.stringStartsWith('test', null), true);
    assert.equal(util.stringStartsWith('test', 'T'), false);

    done();
  });

  it('should end with', function (done) {
    assert.equal(util.stringEndsWith('test', 't'), true);
    assert.equal(util.stringEndsWith('test', 'e'), false);
    assert.equal(util.stringEndsWith('test', ''), true);
    assert.equal(util.stringEndsWith('test', null), true);
    assert.equal(util.stringEndsWith('test', 'T'), false);

    done();
  });

  it('keys counting works', function (done) {
    // int positives
    assert.equal(util.objectKeysLength({ }), 0);
    assert.equal(util.objectKeysLength(null), 0);
    assert.equal(util.objectKeysLength({ prop1: 1 }), 1);
    assert.equal(util.objectKeysLength({ prop1: 1, prop2: 2 }), 2);

    done();
  });

  it('In array case insensitive', function (done) {
    // int positives
    assert.ok(util.inArrayInsensitive('a', [ 'a', 'b', 'c']));
    assert.ok(util.inArrayInsensitive('A', [ 'a', 'b', 'c']));
    assert.ok(!util.inArrayInsensitive('d', [ 'a', 'b', 'c']));

    done();
  });

  it('Get value case insensitive', function (done) {
    // int positives
    assert.equal('b1', util.tryGetValueInsensitive('B', { 'a': 'a1', 'b': 'b1', 'c': 'c1' }));
    assert.equal('b1', util.tryGetValueInsensitive('b', { 'a': 'a1', 'b': 'b1', 'c': 'c1' }));
    assert.equal(undefined, util.tryGetValueInsensitive('D', { 'a': 'a1', 'b': 'b1', 'c': 'c1' }));
    assert.equal('something', util.tryGetValueInsensitive('D', { 'a': 'a1', 'b': 'b1', 'c': 'c1' }, 'something'));

    done();
  });

  it('Get property from object', function (done) {
    // int positives
    assert.equal(util.tryGetValueChain({a: { b: { c: 'd' }}}, [ 'a', 'b', 'c' ]), 'd');
    assert.equal(util.tryGetValueChain({a: { b: { c: 'd' }}}, [ 'a', 'b', 'k' ]), null);
    assert.equal(util.tryGetValueChain(null, [ 'a', 'b', 'k' ]), null);

    done();
  });
});

describe('speed-summary-tests', function() {
  it('getElapsedSeconds should work', function (done) {
    var summary = new speedSummary('test');
    assert.equal(summary.getElapsedSeconds(true), '00:00:00');
    assert.equal(summary.getElapsedSeconds(false), 0);
    done();
  });
  
  it('getCompletePercent should work', function (done) {
    var summary = new speedSummary('test');
    summary.totalSize = 100;
    summary.completeSize = 1;
    assert.equal(summary.getCompletePercent(2).toString(), '1.00');
    done();
  });
  
  it('getAverageSpeed should work', function (done) {
    var summary = new speedSummary('test');
    summary.totalSize = 100;
    summary.completeSize = 10;
    console.log(summary.getAverageSpeed(false));
    assert.equal(summary.getAverageSpeed(true), '10.00B/S');
    assert.equal(summary.getAverageSpeed(false).toString(), '10');
    done();
  });
  
  it('getSpeed should work', function (done) {
    var summary = new speedSummary('test');
    summary.totalSize = 100;
    summary.completeSize = 15;
    assert.equal(summary.getSpeed(true), '0B/S');
    assert.equal(summary.getSpeed(false).toString(), '0');
    done();
  });
  
  it('increment should work', function (done) {
    var summary = new speedSummary('test');
    summary.totalSize = 100;
    summary.completeSize = 15;
    assert.equal(summary.increment(10), 25);
    done();
  });
  
  it('getAutoIncrementFunction should work', function (done) {
    var summary = new speedSummary('test');
    summary.totalSize = 100;
    summary.completeSize = 15;
    var increase = summary.getAutoIncrementFunction(10);
    increase();
    assert.equal(summary.getCompleteSize(false), 25);
    done();
  });
  
  it('getTotalSize should work', function (done) {
    var summary = new speedSummary('test');
    summary.totalSize = 100;
    assert.equal(summary.getTotalSize(true), '100.00B');
    assert.equal(summary.getTotalSize(false), 100);
    done();
  });
  
  it('getCompleteSize should work', function (done) {
    var summary = new speedSummary('test');
    summary.totalSize = 100;
    summary.completeSize = 15;
    var increase = summary.getAutoIncrementFunction(10);
    increase();
    assert.equal(summary.getCompleteSize(false), 25);
    increase();
    assert.equal(summary.getCompleteSize(true), '35.00B');
    done();
  });
});