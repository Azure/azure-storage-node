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
var _ = require('underscore');

var azureCommon = require('./../../../common/common');
var azureutil = azureCommon.util;
var Constants = azureCommon.Constants;
var HeaderConstants = Constants.HeaderConstants;

function FileResult(share, directory, name) {
  this.share = share;
  this.directory = directory;
  this.name = name;
}

FileResult.parse = function (entryXml) {
  var listResult = new FileResult();
  for (var propertyName in entryXml) {
    if (propertyName === 'Properties') {
      listResult[propertyName.toLowerCase()] = { };
      for (var subPropertyName in entryXml[propertyName]) {
        if (entryXml[propertyName].hasOwnProperty(subPropertyName)) {
          listResult[propertyName.toLowerCase()][subPropertyName.toLowerCase()] = entryXml[propertyName][subPropertyName];
        }
      }
    } else {
      listResult[propertyName.toLowerCase()] = entryXml[propertyName];
    }
  }

  return listResult;
};

var responseHeaders = {
  'acceptRanges': 'ACCEPT_RANGES',

  'contentType': 'CONTENT_TYPE',
  'contentEncoding': 'CONTENT_ENCODING',
  'contentLanguage': 'CONTENT_LANGUAGE',
  'contentMD5': 'CONTENT_MD5',
  'cacheControl': 'CACHE_CONTROL',
  'contentRange': 'CONTENT_RANGE',
  'contentLength': 'CONTENT_LENGTH',
  'contentDisposition': 'CONTENT_DISPOSITION'
};

FileResult.prototype.getPropertiesFromHeaders = function (headers, content) {
  var self = this;
  var setFilePropertyFromHeaders = function (fileProperty, headerProperty) {
    if (!self[fileProperty] && headers[headerProperty.toLowerCase()]) {
      self[fileProperty] = headers[headerProperty.toLowerCase()];
    }
  };

  setFilePropertyFromHeaders('etag', HeaderConstants.ETAG);
  setFilePropertyFromHeaders('lastModified', HeaderConstants.LAST_MODIFIED);
  setFilePropertyFromHeaders('requestId', HeaderConstants.REQUEST_ID_HEADER);   

  if (content) {
     _.chain(responseHeaders).pairs().each(function (pair) {
      var property = pair[0];
      var header = HeaderConstants[pair[1]];
      setFilePropertyFromHeaders(property, header);
    });   
   } 
};

/**
* This method sets the HTTP headers and is used by all methods except setFileProperties and createFile. 
* Those methods will set the x-ms-* headers using setProperties.
*/
FileResult.setHeaders = function (webResource, options) {
  var setHeaderProperty = function (headerProperty, fileProperty) {
    if (options[fileProperty]) {
      webResource.withHeader(headerProperty, options[fileProperty]);
    }
  };

  if (options) {
    // Content-MD5
    setHeaderProperty(HeaderConstants.CONTENT_MD5, 'contentMD5');

    // Content-Length
    setHeaderProperty(HeaderConstants.CONTENT_LENGTH, 'contentLength');

    // Range
    if (!azureutil.objectIsNull(options.rangeStart)) {
      var range = 'bytes=' + options.rangeStart + '-';

      if (!azureutil.objectIsNull(options.rangeEnd)) {
        range += options.rangeEnd;
      }

      webResource.withHeader(HeaderConstants.STORAGE_RANGE_HEADER, range);
    }   
  }
};

/**
* This method sets the x-ms-* headers and is used by setFileProperties and createFile. 
* All other methods will set the regular HTTP headers using setHeaders.
*/
FileResult.setProperties = function (webResource, options) {
  var setHeaderProperty = function (headerProperty, fileProperty) {
    if (options[fileProperty]) {
      webResource.withHeader(headerProperty, options[fileProperty]);
    }
  };

  if (options) {
    // Content-Type
    setHeaderProperty(HeaderConstants.CONTENT_TYPE_HEADER, 'contentType');

    // Content-Encoding
    setHeaderProperty(HeaderConstants.CONTENT_ENCODING_HEADER, 'contentEncoding');

    // Content-MD5
    setHeaderProperty(HeaderConstants.CONTENT_MD5_HEADER, 'contentMD5');

    // Content-Language
    setHeaderProperty(HeaderConstants.CONTENT_LANGUAGE_HEADER, 'contentLanguage');

    // Content-Disposition
    setHeaderProperty(HeaderConstants.CONTENT_DISPOSITION_HEADER, 'contentDisposition');

    // Cache-Control
    setHeaderProperty(HeaderConstants.CACHE_CONTROL_HEADER, 'cacheControl');

    // Content-Length
    setHeaderProperty(HeaderConstants.CONTENT_LENGTH_HEADER, 'contentLength');

    if (options.metadata) {
      webResource.addOptionalMetadataHeaders(options.metadata);
    }
  }
};

module.exports = FileResult;