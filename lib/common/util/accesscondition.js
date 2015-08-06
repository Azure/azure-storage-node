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

// Expose 'AccessCondition'.

/**
* Defines constants, enums, and utility functions for use with storage access condition.
* @namespace
*/

'use strict';

var constants = require('./constants');

exports = module.exports;

/**
* Constructs an empty access condition.
*
* @return {object} An empty AccessCondition object
*/
exports.generateEmptyCondition = function () {
  return {};
};

/**
* Constructs an access condition such that an operation will be performed only if the resource does not exist on the service
*
* Setting this access condition modifies the request to include the HTTP If-None-Match conditional header

* @return {object} An AccessCondition object that represents a condition that checks for nonexistence
*/
exports.generateIfNotExistsCondition = function () {
  var accessCondition = {};
  accessCondition[constants.HeaderConstants.IF_NONE_MATCH] = '*';
  return accessCondition;
};

/**
* Constructs an access condition such that an operation will be performed only if the resource exists on the service
*
* Setting this access condition modifies the request to include the HTTP If-Match conditional header

* @return {object} An AccessCondition object that represents a condition that checks for existence
*/
exports.generateIfExistsCondition = function () {
  var accessCondition = {};
  accessCondition[constants.HeaderConstants.IF_MATCH] = '*';
  return accessCondition;
};

/**
* Constructs an access condition such that an operation will be performed only if the resource's ETag value 
* does not match the specified ETag value
*
* Setting this access condition modifies the request to include the HTTP If-None-Match conditional header
*
* @param  {string} etag                    The ETag value to check against the resource's ETag
* @return {object}                         An AccessCondition object that represents the If-None-Match condition
*/
exports.generateIfNoneMatchCondition = function (etag) {
  var accessCondition = {};
  accessCondition[constants.HeaderConstants.IF_NONE_MATCH] = etag;
  return accessCondition;
};

/**
* Constructs an access condition such that an operation will be performed only if the resource's ETag value
* matches the specified ETag value
*
* Setting this access condition modifies the request to include the HTTP If-Match conditional header
*
* @param  {string} etag                    The ETag value to check against the resource's ETag
* @return {object}                         An AccessCondition object that represents the If-Match condition
*/
exports.generateIfMatchCondition = function (etag) {
  var accessCondition = {};
  accessCondition[constants.HeaderConstants.IF_MATCH] = etag;
  return accessCondition;
};

/**
* Constructs an access condition such that an operation will be performed only if the resource has been
* modified since the specified time
*
* Setting this access condition modifies the request to include the HTTP If-Modified-Since conditional header
*
* @param  {Date|string}  time              A date object specifying the time since which the resource must have been modified
* @return {object}                         An AccessCondition object that represents the If-Modified-Since condition
*/
exports.generateIfModifiedSinceCondition = function (time) {
  var accessCondition = {};
  accessCondition[constants.HeaderConstants.IF_MODIFIED_SINCE] = time instanceof Date ? time.toUTCString() : time;
  return accessCondition;
};

/**
* Constructs an access condition such that an operation will be performed only if the resource has not been
* modified since the specified time
*
* Setting this access condition modifies the request to include the HTTP If-Unmodified-Since conditional header
*
* @param  {Date|string}    time            A date object specifying the time since which the resource must have not been modified
* @return {object}                         An AccessCondition object that represents the If-Unmodified-Since condition
*/
exports.generateIfNotModifiedSinceCondition = function (time) {
  var accessCondition = {};
  accessCondition[constants.HeaderConstants.IF_UNMODIFIED_SINCE] = time instanceof Date ? time.toUTCString() : time;
  return accessCondition;
};