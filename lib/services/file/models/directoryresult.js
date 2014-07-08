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

// Module dependencies.
var HeaderConstants = require('./../../../common/common').Constants.HeaderConstants;

function DirectoryResult(name) {
  this.name = name;
}

DirectoryResult.parse = function (dirXml) {
  return new DirectoryResult(dirXml.Name);
};

DirectoryResult.prototype.getPropertiesFromHeaders = function (headers) {
  var self = this;

  var setDirectoryPropertyFromHeaders = function (directoryProperty, headerProperty) {
    if (!self[directoryProperty] && headers[headerProperty.toLowerCase()]) {
      self[directoryProperty] = headers[headerProperty.toLowerCase()];
    }
  };

  setDirectoryPropertyFromHeaders('etag', HeaderConstants.ETAG);
  setDirectoryPropertyFromHeaders('lastModified', HeaderConstants.LAST_MODIFIED);
  setDirectoryPropertyFromHeaders('requestId', HeaderConstants.REQUEST_ID_HEADER);
};

module.exports = DirectoryResult;