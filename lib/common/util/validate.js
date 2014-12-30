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
var util = require('util');

var constants = require('./../util/constants');
var blobConstants = constants.BlobConstants;
var azureutil = require('./util');
var SR = require('./sr');
var check = require('validator');

exports = module.exports;

function initCallback(callbackParam, resultsCb) {
  var fail;
  if (callbackParam) {
    fail = function (err) {
      callbackParam(new Error(err));
      return false;
    };
  } else {
    fail = function (err) {
      throw new Error(err);
    };
    callbackParam = function () {};
  }

  resultsCb(fail, callbackParam);
}

/**
* Checks if the given value is a valid enumeration or not.
*
* @param {object} value     The value to validate.
* @param {object} list      The enumeration values.
* @return {boolean}
*/
exports.isValidEnumValue = function (value, list, callback) {
  var fail;
  
  initCallback(callback, function (f, cb) {
    fail = f;
    callback = cb;
  });

  if (!list.some(function (current) {
    return current.toLowerCase() === value.toLowerCase();
  })) {
    return fail(util.format( 'Invalid value: %s. Options are: %s.', value, list));
  }

  callback();
  return true;
};

/**
* Creates a anonymous function that check if the given uri is valid or not.
*
* @param {string} uri     The uri to validate.
* @return {boolean}
*/
exports.isValidUri = function (uri) {
  if (!check.isURL(uri)){
    throw new Error('The provided URI "' + uri + '" is invalid.');
  }
  return true;
};

/**
* Checks if the given host is valid or not.
*
* @param {string|object} host     The host to validate.
* @return {boolean}
*/
exports.isValidHost= function (host) {
  if (azureutil.objectIsNull(host)) {
    throw new Error(SR.STORAGE_HOST_LOCATION_REQUIRED);
  } else {
    var storageHost = {};
    storageHost.primaryHost = _.isString(host) ? host : host.primaryHost;
    if (storageHost.primaryHost && !check.isURL(storageHost.primaryHost)){
      throw new Error('The provided URI "' + storageHost.primaryHost + '" is invalid.');
    }

    storageHost.secondaryHost = _.isString(host) ? undefined : host.secondaryHost;
    if (storageHost.secondaryHost && !check.isURL(storageHost.secondaryHost)){
      throw new Error('The provided URI "' + storageHost.secondaryHost + '" is invalid.');
    }

    if (!storageHost.primaryHost && !storageHost.secondaryHost) {
      throw new Error(SR.STORAGE_HOST_LOCATION_REQUIRED);
    }
  } 

  return true;
};

/**
* Checks if the given value is a valid UUID or not.
*
* @param {string|object} uuid     The uuid to validate.
* @return {boolean}
*/
exports.isValidUuid = function(uuid, callback) {
  var validUuidRegex = /^[a-zA-Z0-9]{8}\-[a-zA-Z0-9]{4}\-[a-zA-Z0-9]{4}\-[a-zA-Z0-9]{4}\-[a-zA-Z0-9]{12}$/;

  var fail;

  initCallback(callback, function (f, cb) {
    fail = f;
    callback = cb;
  });

  if (!validUuidRegex.test(uuid)) {
    return fail('The value is not a valid UUID format.');
  }
};

/**
* Creates a anonymous function that check if a given key is base 64 encoded.
*
* @param {string} key The key to validate.
* @return {function}
*/
exports.isBase64Encoded = function (key) {
  var isValidBase64String = key.match(/^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{4}|[A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{2}==)$/);

  if (isValidBase64String) {
    return true;
  } else {
    throw new Error('The provided account key ' + key + ' is not a valid base64 string.');
  }
};

/**
* Validates a function.
*
* @param {object} function The function to validate.
* @return {function}
*/
exports.isValidFunction = function (functionObject, functionName) {
  if (!functionObject || !_.isFunction(functionObject)) {
    throw new Error(functionName + ' must be specified.');
  }
};

var getNameError = function(name) {
  // checks if name is null, undefined or empty
  if (azureutil.stringIsEmpty(name)) {
    return '%s name must be a non empty string.';
  }

  // check if name is between 3 and 63 characters
  if (name.length < 3 || name.length > 63) {
    return '%s name must be between 3 and 63 characters long.';
  }

  // check if name follows naming rules
  if (name.match(/^([a-z0-9]+(-[a-z0-9]+)*)$/) === null) {
    return '%s name format is incorrect.';
  }

  return null;
};

/**
* Validates a container name.
*
* @param {string} containerName The container name.
* @return {undefined}
*/
exports.containerNameIsValid = function (containerName, callback) {
  var fail;
  initCallback(callback, function (f, cb) {
    fail = f;
    callback = cb;
  });

  var nameErrorString = getNameError(containerName);

  if (!nameErrorString || containerName.match(/^(\$root|\$logs)$/)) {
    callback();
    return true;
  } else {
    return fail(util.format(nameErrorString, 'Container'));
  }
};

/**
* Validates a blob name.
*
* @param {string} containerName The container name.
* @param {string} blobname      The blob name.
* @return {undefined}
*/
exports.blobNameIsValid = function (containerName, blobName, callback) {
  var fail;
  
  initCallback(callback, function (f, cb) {
    fail = f;
    callback = cb;
  });
  
  if (!blobName) {
    return fail('Blob name is not specified.');
  }
  
  if (containerName === '$root' && blobName.indexOf('/') !== -1) {
    return fail('Blob name format is incorrect.');
  }
  
  callback();
  return true;
};

/**
* Validates a share name.
*
* @param {string} shareName The share name.
* @return {undefined}
*/
exports.shareNameIsValid = function (shareName, callback) {
  var fail;
  initCallback(callback, function (f, cb) {
    fail = f;
    callback = cb;
  });

  var nameErrorString = getNameError(shareName);

  if (!nameErrorString) {
    callback();
    return true;
  } else {
    return fail(util.format(nameErrorString, 'Share'));
  }
};

/**
* Validates a queue name.
*
* @param {string} queueName The queue name.
* @return {undefined}
*/
exports.queueNameIsValid = function (queueName, callback) {
  var fail;

  initCallback(callback, function (f, cb) {
    fail = f;
    callback = cb;
  });

  var nameErrorString = getNameError(queueName);

  if (!nameErrorString) {
    callback();
    return true;
  } else {
    return fail(util.format(nameErrorString, 'Queue'));
  }
};

/**
* Validates a table name.
*
* @param {string} table  The table name.
* @return {undefined}
*/
exports.tableNameIsValid = function (table, callback) {
  var fail;

  initCallback(callback, function (f, cb) {
    fail = f;
    callback = cb;
  });

  if (azureutil.stringIsEmpty(table)) {
    return fail('Table name must be a non empty string.');
  }

  if (table.length < 3 || table.length > 63) {
    return fail('Table name must be between 3 and 63 characters long.');
  }

  if(table.toLowerCase() == 'tables') {
    return fail('Table name cannot be \'Tables\'.');
  }

  if (table.match(/^([A-Za-z][A-Za-z0-9]{2,62})$/) !== null || table === '$MetricsCapacityBlob' || table.match(/^(\$Metrics(HourPrimary|MinutePrimary|HourSecondary|MinuteSecondary)?(Transactions)(Blob|Queue|Table))$/) !== null) 
  {
    callback();
    return true;
  } else {
    return fail('Table name format is incorrect.');
  }
};

/**
* Validates page ranges.
*
* @param {int} rangeStart             The range starting position.
* @param {int} rangeEnd               The range ending position.
* @param {int} writeBlockSizeInBytes  The block size.
* @return {undefined}
*/
exports.pageRangesAreValid = function (rangeStart, rangeEnd, writeBlockSizeInBytes, callback) {
  var fail;

  initCallback(callback, function (f, cb) {
    fail = f;
    callback = cb;
  });

  if (rangeStart % 512 !== 0) {
    return fail('Start byte offset must be a modulus of 512.');
  }

  var size = null;
  if (!azureutil.objectIsNull(rangeEnd)) {
    if ((rangeEnd + 1) % 512 !== 0) {
      return fail('End byte offset must be a modulus of 512 minus 1.');
    }

    size = (rangeEnd - rangeStart) + 1;
    if (size > this.writeBlockSizeInBytes) {
      return fail('Page blob size cant be larger than ' + writeBlockSizeInBytes + ' bytes.');
    }
  }
  
  callback();
  return true;
};

/**
* Validates a blob type.
*
* @param {string} type  The type name.
* @return {undefined}
*/
exports.blobTypeIsValid = function (type, callback) {
  var getEnumValues = function (obj) {
    var values = [];
    for (var prop in obj) {
      if (obj.hasOwnProperty(prop)) {
        values.push(obj[prop]);
      }
    }
    return values;
  };
  
  return this.isValidEnumValue(type, getEnumValues(blobConstants.BlobTypes), callback);
};

// common functions for validating arguments

function throwMissingArgument(name, func) {
  throw new Error('Required argument ' + name + ' for function ' + func + ' is not defined');
}

function ArgumentValidator(functionName) {
  this.func = functionName;
}

_.extend(ArgumentValidator.prototype, {
  string: function (val, name) {
    this.exists(val, name);
    if (typeof val != 'string') {
      throw new Error('Parameter ' + name + ' for function ' + this.func + ' should be a non-empty string');
    }
  },

  stringAllowEmpty: function (val, name) {
    if (typeof val != 'string') {
      throwMissingArgument(name, this.func);
    }
  },

  object: function (val, name) {
    this.exists(val, name);
    if (typeof val != 'object') {
      throw new Error('Parameter ' + name + ' for function ' + this.func + ' should be an object');
    }
  },

  exists: function (val, name) {
    if (!val) {
      throwMissingArgument(name, this.func);
    }
  },

  function: function (val, name) {
    this.exists(val, name);
    if (typeof val !== 'function') {
      throw new Error('Parameter ' + name + ' for function ' + this.func + ' should be a function');
    }
  },

  value: function (val, name) {
    if (!val && val !== 0) {
      throwMissingArgument(name, this.func);
    }
  },

  nonEmptyArray: function (val, name) {
    if (!val || val.length === 0) {
      throw new Error('Required array argument ' + name + ' for function ' + this.func + ' is either not defined or empty');
    }
  },

  callback: function (val) {
    this.exists(val, 'callback');
    this.function(val, 'callback');
  },

  test: function (predicate, message) {
    if (!predicate()) {
      throw new Error(message + ' in function ' + this.func);
    }
  },

  tableNameIsValid: exports.tableNameIsValid,
  containerNameIsValid: exports.containerNameIsValid,
  shareNameIsValid: exports.shareNameIsValid,
  blobNameIsValid: exports.blobNameIsValid,
  pageRangesAreValid: exports.pageRangesAreValid,
  queueNameIsValid: exports.queueNameIsValid,
  blobTypeIsValid: exports.blobTypeIsValid,
  isValidEnumValue: exports.isValidEnumValue
});

function validateArgs(functionName, validationRules) {
  var validator = new ArgumentValidator(functionName);
  validationRules(validator);
}

exports.ArgumentValidator = ArgumentValidator;
exports.validateArgs = validateArgs;