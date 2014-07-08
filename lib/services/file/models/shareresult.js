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
var Constants = require('./../../../common/common').Constants;
var HeaderConstants = Constants.HeaderConstants;

function ShareResult(name) {
  this.name = name;
}

ShareResult.parse = function (shareXml) {
  var shareResult = new ShareResult();
  for (var propertyName in shareXml) {
    if (shareXml.hasOwnProperty(propertyName)) {
      if (propertyName === 'Properties' || propertyName === 'Metadata') {
        shareResult[propertyName.toLowerCase()] = { };
        for (var subPropertyName in shareXml[propertyName]) {
          if (shareXml[propertyName].hasOwnProperty(subPropertyName)) {
            shareResult[propertyName.toLowerCase()][subPropertyName.toLowerCase()] = shareXml[propertyName][subPropertyName];
          }
        }
      } else {
        shareResult[propertyName.toLowerCase()] = shareXml[propertyName];
      }
    }
  }

  return shareResult;
};

ShareResult.prototype.getPropertiesFromHeaders = function (headers) {
  var self = this;

  var setSharePropertyFromHeaders = function (shareProperty, headerProperty) {
    if (!self[shareProperty] && headers[headerProperty.toLowerCase()]) {
      self[shareProperty] = headers[headerProperty.toLowerCase()];
    }
  };

  setSharePropertyFromHeaders('etag', HeaderConstants.ETAG);
  setSharePropertyFromHeaders('lastModified', HeaderConstants.LAST_MODIFIED);
  setSharePropertyFromHeaders('requestId', HeaderConstants.REQUEST_ID_HEADER);
};

module.exports = ShareResult;