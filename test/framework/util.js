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

var _ = require('underscore');
var fs = require('fs');

var exports = module.exports;

/**
* Generates an unique identifier using a prefix, based on a currentList and repeatable or not depending on the isMocked flag.
*
* @param {string} prefix          The prefix to use in the identifier.
* @param {array}  currentList     The current list of identifiers.
* @param {bool}   isMocked        Boolean flag indicating if the test is mocked or not.
* @return {string} A new unique identifier.
*/
exports.generateId = function (prefix, currentList, isMocked) {
  if (!currentList) {
    currentList = [];
  }

  while (true) {
    var newNumber;
    if (isMocked) {
      // Predictable
      newNumber = prefix + (currentList.length + 1);
      currentList.push(newNumber);

      return newNumber;
    } else {
      // Random
      newNumber = prefix + Math.floor(Math.random() * 10000);
      if (currentList.indexOf(newNumber) === -1) {
        currentList.push(newNumber);

        return newNumber;
      }
    }
  }
};

exports.randomFromTo = function (from, to) {
  return Math.floor(Math.random() * (to - from + 1) + from);
};

exports.libFolder = function () {
  return process.env['AZURE_LIB_PATH'] ? process.env['AZURE_LIB_PATH'] : 'lib';
};

exports.libRequire = function (path) {
  return require('../../' + exports.libFolder() + '/' + path);
};

exports.getCertificateKey = function () {
  if (process.env['AZURE_CERTIFICATE_KEY']) {
    return process.env['AZURE_CERTIFICATE_KEY'];
  } else if (process.env['AZURE_CERTIFICATE_KEY_FILE']) {
    return fs.readFileSync(process.env['AZURE_CERTIFICATE_KEY_FILE']).toString();
  }

  return null;
};

// Helper function to save & restore the contents of the
// process environment variables for a test
exports.withEnvironment = function (values, testFunction) {
  var keys = Object.keys(values);
  var originalValues = keys.map(function (key) { return process.env[key]; } );
  _.extend(process.env, values);
  try {
    testFunction();
  } finally {
    _.zip(keys, originalValues).forEach(function (oldVal) {
      if (_.isUndefined(oldVal[1])) {
        delete process.env[oldVal[0]];
      } else {
        process.env[oldVal[0]] = oldVal[1];
      }
    });
  }
};

// Writes content to a temporary file that gets deleted
// at the end of the test. File writes are synchronous

exports.withTempFileSync = function (content, action) {
  var path = exports.generateId('temp') + '.tmp';
  fs.writeFileSync(path, content);
  try {
    action(path);
  } finally {
    fs.unlinkSync(path);
  }
};

// Writes content to a temporary file that gets
// deleted when the 'done' callback is executed.
// Similar to withTempFileSync, but for async
// tests. The file operations themselves are done
// synchronously.

exports.withTempFile = function (content, action) {
  var path = exports.generateId('temp') + '.tmp';
  fs.writeFileSync(path, content);
  action(path, function () {
    fs.unlinkSync(path);
  });
};

exports.isBrowser = function () {
  return typeof window === 'object';
}

// Mock a Browser file with specified name and size

exports.getBrowserFile = function (name, size) {
  function getRandomFilledBinaryArray (size) {
    var uint8Arr = new Uint8Array(size);
    for (var j = 0; j < size; j++) {
        uint8Arr[j] = Math.floor(Math.random() * 256);
    }
    return uint8Arr;
  };

  var binary = getRandomFilledBinaryArray(size);
  
  // IE11 & Edge doesn't support create File using var file = new File([binary], name);
  // We leverage Blob() to mock a File

  var file = new Blob([binary]);
  file.name = name;
  return file;
};

// Used in mocha testing only, to indicate coresponding test case cannot run under mocking
exports.itSkipMock = function (isMocked) {
  return isMocked ? it.skip : it;
};

// Used in mocha testing only, to indicate coresponding test case cannot run under browsers
exports.itSkipBrowser = function () {
  return exports.isBrowser() ? it.skip : it;
};

// Used in mocha testing only, to indicate coresponding test case cannot run under mocking and browsers
exports.itSkipMockAndBrowser = function (isMocked) {
  return exports.isBrowser() ? it.skip : exports.itSkipMock(isMocked);
}

exports.getQueueService = function (azure) {
  if (exports.isBrowser()) {
    var account = process.env['AZURE_ACCOUNT'];
    var host = "https://" + account + ".queue.core.windows.net";
    var sas = process.env['AZURE_SAS'];
    return azure.createQueueServiceWithSas(host, sas);
  } else {
    var connectionString = process.env['AZURE_STORAGE_CONNECTION_STRING'];
    return azure.createQueueService(connectionString).withFilter(new azure.ExponentialRetryPolicyFilter());    
  }
};

exports.getTableService = function (azure) {
  if (exports.isBrowser()) {
    var account = process.env['AZURE_ACCOUNT'];
    var host = "https://" + account + ".table.core.windows.net";
    var sas = process.env['AZURE_SAS'];
    return azure.createTableServiceWithSas(host, sas);
  } else {
    var connectionString = process.env['AZURE_STORAGE_CONNECTION_STRING'];
    return azure.createTableService(connectionString).withFilter(new azure.ExponentialRetryPolicyFilter());    
  }
};

exports.getFileService = function (azure) {
  if (exports.isBrowser()) {
    var account = process.env['AZURE_ACCOUNT'];
    var host = "https://" + account + ".file.core.windows.net";
    var sas = process.env['AZURE_SAS'];
    return azure.createFileServiceWithSas(host, sas);
  } else {
    var connectionString = process.env['AZURE_STORAGE_CONNECTION_STRING'];
    return azure.createFileService(connectionString).withFilter(new azure.ExponentialRetryPolicyFilter());    
  }
};

exports.getBlobService = function (azure, connectionStringEnv) {
  if (exports.isBrowser()) {
    var account = process.env['AZURE_ACCOUNT'];
    var host = "https://" + account + ".blob.core.windows.net";
    var sas = process.env['AZURE_SAS'];
    return azure.createBlobServiceWithSas(host, sas);
  } else {
    var connectionString = process.env[connectionStringEnv || 'AZURE_STORAGE_CONNECTION_STRING'];
    return azure.createBlobService(connectionString).withFilter(new azure.ExponentialRetryPolicyFilter());    
  }
};

exports.polyfillArrayFind = function () {
  // https://tc39.github.io/ecma262/#sec-array.prototype.find
  if (!Array.prototype.find && exports.isBrowser()) {
    Object.defineProperty(Array.prototype, 'find', {
      value: function(predicate) {
      // 1. Let O be ? ToObject(this value).
        if (this == null) {
          throw new TypeError('"this" is null or not defined');
        }

        var o = Object(this);

        // 2. Let len be ? ToLength(? Get(O, "length")).
        var len = o.length >>> 0;

        // 3. If IsCallable(predicate) is false, throw a TypeError exception.
        if (typeof predicate !== 'function') {
          throw new TypeError('predicate must be a function');
        }

        // 4. If thisArg was supplied, let T be thisArg; else let T be undefined.
        var thisArg = arguments[1];

        // 5. Let k be 0.
        var k = 0;

        // 6. Repeat, while k < len
        while (k < len) {
          // a. Let Pk be ! ToString(k).
          // b. Let kValue be ? Get(O, Pk).
          // c. Let testResult be ToBoolean(? Call(predicate, T, « kValue, k, O »)).
          // d. If testResult is true, return kValue.
          var kValue = o[k];
          if (predicate.call(thisArg, kValue, k, o)) {
            return kValue;
          }
          // e. Increase k by 1.
          k++;
        }

        // 7. Return undefined.
        return undefined;
      },
      configurable: true,
      writable: true
    });
  }
}