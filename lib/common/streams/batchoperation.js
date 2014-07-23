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

var util = require('util');
var http = require('http');
var https = require('https');
var EventEmitter = require('events').EventEmitter;
var os = require('os');

var azureutil = require('../util/util');
var Logger = require('../diagnostics/logger');
var Constants = require('../util/constants');

var DEFAULT_OPERATION_MEMORY_USAGE = Constants.BlobConstants.DEFAULT_WRITE_BLOCK_SIZE_IN_BYTES;
var DEFAULT_GLOBAL_CONCURRENCY = 5; //Default http connection limitation for nodejs

var SystemTotalMemory = os.totalmem();
var nodeVersion = azureutil.getNodeVersion();
var enableReuseSocket = nodeVersion.major >= 0 && nodeVersion.minor >= 10;

/**
* Concurrently execute batch operations.
*/
function BatchOperation(name, options) {
  if (!options) {
    options = {};
  }

  this.name = name;
  this.logger = options.logger || new Logger(Logger.LogLevels.INFO);
  this.operationMemoryUsage = options.operationMemoryUsage || DEFAULT_OPERATION_MEMORY_USAGE;
  this.concurrency = DEFAULT_GLOBAL_CONCURRENCY;

  this._emitter = new EventEmitter();
  this._enableComplete = false;
  this._ended = false;
  this._error = null;

  //Total operations count(queued and active and connected)
  this._totalOperation = 0;

  //Action operations count(The operations which are connecting to remote or executing callback or queued for executing)
  this._activeOperation = 0;

  //Queued operations count(The operations which are connecting to remote or queued for executing)
  this._queuedOperation = 0;

  //finished operation should be removed from this array
  this._operations = [];
}

/**
* Operation state
*/
var OperationState = {
  INITED : 'inited',
  QUEUED : 'queued',
  RUNNING : 'running',
  CALLBACK : 'callback',
  ERROR : 'error'
};

BatchOperation.OperationState = OperationState;

/**
* Set batch operation concurrency
*/
BatchOperation.prototype.setConcurrency = function(concurrency) {
  if (concurrency) {
    this.concurrency = concurrency;
    http.globalAgent.maxSockets = this.concurrency;
    https.globalAgent.maxSockets = this.concurrency;
  }
};

/**
* Is the workload heavy and It can used to determine whether we could queue operations
*/
BatchOperation.prototype.IsWorkloadHeavy = function() {
  //Only support one batch operation for now.
  //In order to work with the multiple batch operation, we can use global operation track objects
  //BatchOperation acquire a bunch of operation ids from global and allocated ids to RestOperation
  //RestOperation start to run in order of id
  var sharedRequest = 1;
  if(enableReuseSocket) {
    sharedRequest = 5;
  }
  return this._activeOperation >= sharedRequest * this.concurrency ||
    (this._activeOperation >= this.concurrency && this._getApproximateMemoryUsage() > 0.5 * SystemTotalMemory);
};

/**
* get the approximate memory usage for batch operation
*/
BatchOperation.prototype._getApproximateMemoryUsage = function() {
  var currentUsage = process.memoryUsage().rss;
  var futureUsage = this._queuedOperation * this.operationMemoryUsage;
  return currentUsage + futureUsage;
};

/**
* Add a operation into batch operation
*/
BatchOperation.prototype.addOperation = function(operation) {
  this._operations.push(operation);
  operation.status = OperationState.QUEUED;
  operation.operationId = ++this._totalOperation;
  this._queuedOperation++;
  this.logger.debug(util.format('Add operation %d into batch operation %s.', operation.operationId, this.name));
  //Immediately start the idle operation if workload isn't heavy
  this._runOperation(operation);
  return this.IsWorkloadHeavy();
};

/**
* Enable batch operation complete when there is no operation to run.
*/
BatchOperation.prototype.enableComplete = function() {
  this._enableComplete = true;
  this.logger.debug(util.format('Enable batch operation %s complete', this.name));
  this._tryEmitEndEvent();
};

/**
* Add event listener
*/
BatchOperation.prototype.on = function(event, listener) {
  // only emit end if the batch has completed all operations
  if(this._ended && event === 'end') {
    listener();
  } else {
    this._emitter.on(event, listener);
  }
};

/**
* Run operation
*/
BatchOperation.prototype._runOperation = function (operation) {
  this.logger.debug(util.format('Operation %d start to run', operation.operationId));
  var cb = this.getBatchOperationCallback(operation);

  if(this._error) {
    cb(this._error);//Directly call the callback with previous error.
  } else {
    operation.run(cb);
  }

  this._activeOperation++;
};

/**
* Return an general operation call back.
* This callback is used to update the internal status and fire user's callback when operation is complete.
*/
BatchOperation.prototype.getBatchOperationCallback = function (operation) {
  var self = this;
  return function (error) {
    self._queuedOperation--;
    if (error) {
      operation.status = OperationState.ERROR;
      self.logger.debug(util.format('Operation %d failed. Error %s', operation.operationId, error));
      self._error = error;
    } else {
      operation.status = OperationState.CALLBACK;
      self.logger.debug(util.format('Operation %d succeed', operation.operationId));
    }

    operation._callbackArguments = arguments;
    self._fireOperationUserCallback(operation);

    self._tryEmitDrainEvent();
  };
};

/**
* Fire user's call back
*/
BatchOperation.prototype._fireOperationUserCallback = function (operation) {
  // fire the callback, if exists
  if(operation._userCallback) {
    this.logger.debug(util.format('Fire user call back for operation %d', operation.operationId));
    operation._fireUserCallback();
  }    

  // remove the operation from the array and decrement the counter
  var index = this._operations.indexOf(operation);
  this._operations.splice(index, 1);
  this._activeOperation--;

  // check if batch has ended and if so emit end event
  this._tryEmitEndEvent();
};

/**
* Try to emit the BatchOperation end event
* End event means all the operation and callback already finished.
*/
BatchOperation.prototype._tryEmitEndEvent = function () {
  if(this._enableComplete && this._activeOperation === 0 && this._operations.length === 0) {
    this._ended = true;
    this.logger.debug(util.format('Batch operation %s emit the end event', this.name));
    this._emitter.emit('end', this._error, null);
    return true;
  }
  return false;
};

/**
* Try to emit the drain event
*/
BatchOperation.prototype._tryEmitDrainEvent = function () {
  if(!this.IsWorkloadHeavy() || this._activeOperation < this.concurrency) {
    this._emitter.emit('drain');
    return true;
  }
  return false;
};

/**
* Rest operation in sdk
*/
function RestOperation(serviceClient, operation) {
  this.status = OperationState.Inited;
  this.operationId = -1;
  this._callbackArguments = null;

  // setup callback and args
  this._userCallback = arguments[arguments.length - 1];
  var sliceEnd = arguments.length;
  if(azureutil.objectIsFunction(this._userCallback)) {
    sliceEnd--;
  } else {
    this._userCallback = null;
  }
  var operationArguments = Array.prototype.slice.call(arguments).slice(2, sliceEnd);

  this.run = function(cb) {
    var func = serviceClient[operation];
    if(!func) {
      throw new Error(util.format('Unknown operation %s in serviceclient', operation));
    } else {
      if(!cb) cb = this._userCallback;
      operationArguments.push(cb);
      this.status = OperationState.RUNNING;
      func.apply(serviceClient, operationArguments);
      operationArguments = operation = null;
    }
  };

  this._fireUserCallback = function () {
    if(this._userCallback) {
      this._userCallback.apply(null, this._callbackArguments);
    }
  };
}

BatchOperation.RestOperation = RestOperation;

module.exports = BatchOperation;
