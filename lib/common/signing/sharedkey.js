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
var qs = require('querystring');

var azureutil = require('../util/util');
var HmacSha256Sign = require('./hmacsha256sign');
var SR = require('../util/sr');

var Constants = require('../util/constants');
var HeaderConstants = Constants.HeaderConstants;
var QueryStringConstants = Constants.QueryStringConstants;
var HeaderConstants = Constants.HeaderConstants;
var CompatibleVersionConstants = Constants.CompatibleVersionConstants;

/**
* Creates a new SharedKey object.
*
* @constructor
* @param {string} storageAccount    The storage account.
* @param {string} storageAccessKey  The storage account's access key.
* @param {bool}   usePathStyleUri   Boolean value indicating if the path, or the hostname, should include the storage account.
*/
function SharedKey(storageAccount, storageAccessKey, usePathStyleUri) {
  this.storageAccount = storageAccount;
  this.storageAccessKey = storageAccessKey;
  this.usePathStyleUri = usePathStyleUri;
  this.signer = new HmacSha256Sign(storageAccessKey);
}

/**
* Signs a request with the Authentication header.
*
* @param {WebResource} The webresource to be signed.
* @param {function(error)}  callback  The callback function.
* @return {undefined}
*/
SharedKey.prototype.signRequest = function (webResource, callback) {
  var getvalueToAppend = function (value, headerName) {
    if (azureutil.objectIsNull(value) || azureutil.objectIsNull(value[headerName])) {
      return '\n';
    } else {
      return value[headerName] + '\n';
    }
  };

  var stringToSign =
    webResource.method + '\n' +
    getvalueToAppend(webResource.headers, HeaderConstants.CONTENT_ENCODING) +
    getvalueToAppend(webResource.headers, HeaderConstants.CONTENT_LANGUAGE) +
    getvalueToAppend(webResource.headers, HeaderConstants.CONTENT_LENGTH) +
    getvalueToAppend(webResource.headers, HeaderConstants.CONTENT_MD5) +
    getvalueToAppend(webResource.headers, HeaderConstants.CONTENT_TYPE) +
    getvalueToAppend(webResource.headers, HeaderConstants.DATE) +
    getvalueToAppend(webResource.headers, HeaderConstants.IF_MODIFIED_SINCE) +
    getvalueToAppend(webResource.headers, HeaderConstants.IF_MATCH) +
    getvalueToAppend(webResource.headers, HeaderConstants.IF_NONE_MATCH) +
    getvalueToAppend(webResource.headers, HeaderConstants.IF_UNMODIFIED_SINCE) +
    getvalueToAppend(webResource.headers, HeaderConstants.RANGE) +
    this._getCanonicalizedHeaders(webResource) +
    this._getCanonicalizedResource(webResource);

  var signature = this.signer.sign(stringToSign);

  webResource.withHeader(HeaderConstants.AUTHORIZATION, 'SharedKey ' + this.storageAccount + ':' + signature);
  callback(null);
};

/*
* Retrieves the webresource's canonicalized resource string.
* @param {WebResource} webResource The webresource to get the canonicalized resource string from.
* @return {string} The canonicalized resource string.
*/
SharedKey.prototype._getCanonicalizedResource = function (webResource) {
  var path = '/';
  if (webResource.path) {
    path = webResource.path;
  }

  var canonicalizedResource = '/' + this.storageAccount + path;

  // Get the raw query string values for signing
  var queryStringValues = webResource.queryString;

  // Build the canonicalized resource by sorting the values by name.
  if (queryStringValues) {
    var paramNames = [];
    Object.keys(queryStringValues).forEach(function (n) {
      paramNames.push(n);
    });

    paramNames = paramNames.sort();
    Object.keys(paramNames).forEach(function (name) {
      canonicalizedResource += '\n' + paramNames[name] + ':' + queryStringValues[paramNames[name]];
    });
  }

  return canonicalizedResource;
};

/*
* Constructs the Canonicalized Headers string.
*
* To construct the CanonicalizedHeaders portion of the signature string,
* follow these steps: 1. Retrieve all headers for the resource that begin
* with x-ms-, including the x-ms-date header. 2. Convert each HTTP header
* name to lowercase. 3. Sort the headers lexicographically by header name,
* in ascending order. Each header may appear only once in the
* string. 4. Unfold the string by replacing any breaking white space with a
* single space. 5. Trim any white space around the colon in the header. 6.
* Finally, append a new line character to each canonicalized header in the
* resulting list. Construct the CanonicalizedHeaders string by
* concatenating all headers in this list into a single string.
*
* @param {object} The webresource object.
* @return {string} The canonicalized headers.
*/
SharedKey.prototype._getCanonicalizedHeaders = function (webResource) {
  // Build canonicalized headers
  var canonicalizedHeaders = '';
  if (webResource.headers) {
    var canonicalizedHeadersArray = [];
    for (var header in webResource.headers) {
      if (header.indexOf(HeaderConstants.PREFIX_FOR_STORAGE_HEADER) === 0) {
        canonicalizedHeadersArray.push(header);
      }
    }

    canonicalizedHeadersArray.sort();

    _.each(canonicalizedHeadersArray, function (currentHeader) {
      var value = webResource.headers[currentHeader];
      if (!azureutil.IsNullOrEmptyOrUndefinedOrWhiteSpace(value)) {
        canonicalizedHeaders += currentHeader.toLowerCase() + ':' + value + '\n';
      }
    });
  }

  return canonicalizedHeaders;
};

/**
* Generates the query string for a shared access signature signing.
*
* @this {SharedAccessSignature}
* @param {string}                     path                                          The path to the resource.
* @param {object}                     sharedAccessPolicy                            The shared access policy.
* @param {string}                     [sharedAccessPolicy.Id]                       The signed identifier.
* @param {SharedAccessPermissions}    sharedAccessPolicy.AccessPolicy.Permissions   The permission type.
* @param {date}                       [sharedAccessPolicy.AccessPolicy.Start]       The time at which the Shared Access Signature becomes valid.
* @param {date}                       sharedAccessPolicy.AccessPolicy.Expiry        The time at which the Shared Access Signature becomes expired.
* @param {string}                     sasVersion                                    A string indicating the desired SAS Version to use, in storage service version format. Value must be 2012-02-12 or later.
* @parma {ResourceTypes}              [args.resourceType]                           The resource type, if the resource is a blob or container.  Null if the resource is a queue or table.
* @parma {ResourceTypes}              [args.tableName]                              The table name, if the resource is a table.  Null if the resource is a blob orqueue.
* @parma {ResourceTypes}              [args.queryString]                            The query string, if additional parameters are desired.
* @param {object}                     [args.headers]                                The optional header values to set for a blob returned wth this SAS.
* @param {string}                     [args.headers.CacheControl]                   The value of the Cache-Control response header to be returned when this SAS is used.
* @param {string}                     [args.headers.ContentType]                    The value of the Content-Type response header to be returned when this SAS is used.
* @param {string}                     [args.headers.ContentEncoding]                The value of the Content-Encoding response header to be returned when this SAS is used.
* @param {string}                     [args.headers.ContentLanguage]                The value of the Content-Language response header to be returned when this SAS is used.
* @param {string}                     [args.headers.ContentDisposition]             The value of the Content-Disposition response header to be returned when this SAS is used.
* @return {object} The shared access signature query string.
*/
SharedKey.prototype.generateSignedQueryString = function (path, sharedAccessPolicy, sasVersion, args) {
  var addIfNotNull = function (queryString, name, value) {
    if (!azureutil.objectIsNull(name) && !azureutil.objectIsNull(value)) {
      queryString[name] = value;
    }
  };

  var validateVersion = function (sasVersion) {
    // validate and add version
    if (azureutil.objectIsNull(sasVersion)) {
      return HeaderConstants.TARGET_STORAGE_VERSION;
    } else {
      var values = _.values(CompatibleVersionConstants);
      if (values.some(function(version) {
        return version.toLowerCase() === sasVersion.toLowerCase();
      })) {
        return sasVersion;
      } else {
        throw new Error(azureutil.stringFormat(SR.INVALID_SAS_VERSION, sasVersion, values));
      }
    }
  };

  var formatAccessPolicyDates = function (accessPolicy) {
    if (!azureutil.objectIsNull(accessPolicy.Start)) {
      if (!_.isDate(accessPolicy.Start)) {
        accessPolicy.Start = new Date(accessPolicy.Start);
      }
 
      accessPolicy.Start = azureutil.truncatedISO8061Date(accessPolicy.Start);
    }

    if (!azureutil.objectIsNull(accessPolicy.Expiry)) {
      if (!_.isDate(accessPolicy.Expiry)) {
        accessPolicy.Expiry = new Date(accessPolicy.Expiry);
      }

      accessPolicy.Expiry = azureutil.truncatedISO8061Date(accessPolicy.Expiry);
    }
  };

  // set up optional args
  var queryString;
  var resourceType;
  var headers;
  var tableName;
  
  if(args) {
    queryString = args.queryString;
    resourceType = args.resourceType;
    tableName = args.tableName;
    headers = args.headers;
  }

  if(!queryString) {
    queryString = {};
  }

  // add shared access policy params
  if (sharedAccessPolicy.AccessPolicy) {
    formatAccessPolicyDates(sharedAccessPolicy.AccessPolicy);

    addIfNotNull(queryString, QueryStringConstants.SIGNED_START, sharedAccessPolicy.AccessPolicy.Start);
    addIfNotNull(queryString, QueryStringConstants.SIGNED_EXPIRY, sharedAccessPolicy.AccessPolicy.Expiry);
    addIfNotNull(queryString, QueryStringConstants.SIGNED_PERMISSIONS, sharedAccessPolicy.AccessPolicy.Permissions);

    // tables only
    addIfNotNull(queryString, QueryStringConstants.STARTPK, sharedAccessPolicy.AccessPolicy.StartPk);
    addIfNotNull(queryString, QueryStringConstants.ENDPK, sharedAccessPolicy.AccessPolicy.EndPk);
    addIfNotNull(queryString, QueryStringConstants.STARTRK, sharedAccessPolicy.AccessPolicy.StartRk);
    addIfNotNull(queryString, QueryStringConstants.ENDRK, sharedAccessPolicy.AccessPolicy.EndRk);
  }

  // validate and add version
  var validatedSASVersionString = validateVersion(sasVersion);
  addIfNotNull(queryString, QueryStringConstants.SIGNED_VERSION, validatedSASVersionString);

  // add signed identifier
  addIfNotNull(queryString, QueryStringConstants.SIGNED_IDENTIFIER, sharedAccessPolicy.Id);

  // blobs only
  addIfNotNull(queryString, QueryStringConstants.SIGNED_RESOURCE, resourceType);
  if (headers) {
    addIfNotNull(queryString, QueryStringConstants.CACHE_CONTROL, headers.cacheControl);
    addIfNotNull(queryString, QueryStringConstants.CONTENT_TYPE, headers.contentType);
    addIfNotNull(queryString, QueryStringConstants.CONTENT_ENCODING, headers.contentEncoding);
    addIfNotNull(queryString, QueryStringConstants.CONTENT_LANGUAGE, headers.contentLanguage);
    addIfNotNull(queryString, QueryStringConstants.CONTENT_DISPOSITION, headers.contentDisposition);
  }

  // tables only
  addIfNotNull(queryString, QueryStringConstants.TABLENAME, tableName);

  // add signature
  addIfNotNull(queryString, QueryStringConstants.SIGNATURE, this._generateSignature(path, sharedAccessPolicy, validatedSASVersionString, {resourceType: resourceType, headers: headers, tableName: tableName}));

  return qs.stringify(queryString);
};

/**
* Generates the shared access signature for a resource.
*
* @this {SharedAccessSignature}
* @param {string}                     path                                          The path to the resource.
* @param {object}                     sharedAccessPolicy                            The shared access policy.
* @param {string}                     [sharedAccessPolicy.Id]                       The signed identifier.
* @param {SharedAccessPermissions}    sharedAccessPolicy.AccessPolicy.Permissions   The permission type.
* @param {date}                       [sharedAccessPolicy.AccessPolicy.Start]       The time at which the Shared Access Signature becomes valid.
* @param {date}                       sharedAccessPolicy.AccessPolicy.Expiry        The time at which the Shared Access Signature becomes expired.
* @param {string}                     sasVersion                                    A string indicating the desired SAS Version to use, in storage service version format. Value must be 2012-02-12 or later.
* @parma {ResourceTypes}              [args.resourceType]                           The resource type, if the resource is a blob or container.  Null if the resource is a queue or table.
* @parma {ResourceTypes}              [args.tableName]                              The table name, if the resource is a table.  Null if the resource is a blob or queue.
* @param {object}                     [args.headers]                                The optional header values to set for a blob returned wth this SAS.
* @param {string}                     [args.headers.CacheControl]                   The value of the Cache-Control response header to be returned when this SAS is used.
* @param {string}                     [args.headers.ContentType]                    The value of the Content-Type response header to be returned when this SAS is used.
* @param {string}                     [args.headers.ContentEncoding]                The value of the Content-Encoding response header to be returned when this SAS is used.
* @param {string}                     [args.headers.ContentLanguage]                The value of the Content-Language response header to be returned when this SAS is used.
* @param {string}                     [args.headers.ContentDisposition]             The value of the Content-Disposition response header to be returned when this SAS is used.
* @return {string} The shared access signature.
*/
SharedKey.prototype._generateSignature = function (path, sharedAccessPolicy, sasVersion, args) {
  var getvalueToAppend = function (value, noNewLine) {
    var returnValue = '';
    if (!azureutil.objectIsNull(value)) {
      returnValue = value;
    }

    if (noNewLine !== true) {
      returnValue += '\n';
    }

    return returnValue;
  };

  // set up optional args
  var resourceType;
  var tableName;
  var headers;
  if(args) {
    resourceType = args.resourceType;
    tableName = args.tableName;
    headers = args.headers;
  }

  // Add leading slash to path
  if (path.substr(0, 1) !== '/') {
    path = '/' + path;
  }

  var canonicalizedResource = '/' + this.storageAccount + path;
  var stringToSign = getvalueToAppend(sharedAccessPolicy.AccessPolicy ? sharedAccessPolicy.AccessPolicy.Permissions : '') +
      getvalueToAppend(sharedAccessPolicy.AccessPolicy ? sharedAccessPolicy.AccessPolicy.Start : '') +
      getvalueToAppend(sharedAccessPolicy.AccessPolicy ? sharedAccessPolicy.AccessPolicy.Expiry : '') +
      getvalueToAppend(canonicalizedResource) +
      getvalueToAppend(sharedAccessPolicy.Id) +
      sasVersion;

  if(sasVersion == CompatibleVersionConstants.FEBRUARY_2012) {
    if(headers) {
      throw new Error(SR.INVALID_HEADERS);
    }
  } else if (resourceType) {
    stringToSign += '\n' +
    getvalueToAppend(headers ? headers.cacheControl : '') +
    getvalueToAppend(headers ? headers.contentDisposition : '') +
    getvalueToAppend(headers ? headers.contentEncoding : '') +
    getvalueToAppend(headers ? headers.contentLanguage : '') +
    getvalueToAppend(headers ? headers.contentType : '', true);
  }

  if(tableName) {
    stringToSign += '\n' + 
    getvalueToAppend(sharedAccessPolicy.AccessPolicy ? sharedAccessPolicy.AccessPolicy.StartPk : '') +
    getvalueToAppend(sharedAccessPolicy.AccessPolicy ? sharedAccessPolicy.AccessPolicy.StartRk : '') +
    getvalueToAppend(sharedAccessPolicy.AccessPolicy ? sharedAccessPolicy.AccessPolicy.EndPk : '') +
    getvalueToAppend(sharedAccessPolicy.AccessPolicy ? sharedAccessPolicy.AccessPolicy.EndRk : '', true);
  }

  return this.signer.sign(stringToSign);
};

module.exports = SharedKey;