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

var Constants = require('../util/constants');
var HeaderConstants = Constants.HeaderConstants;

/**
* Creates a new TokenSigner object.
*
* @constructor
* @param {TokenCredential} tokenCredential The token credential, such as containing an OAuth access token.
*/
function TokenSigner (tokenCredential) {
  this.tokenCredential = tokenCredential;
}

/**
* Signs a request with the Authentication header.
*
* @param {WebResource}      webResource The webresource to be signed.
* @param {function(error)}  callback    The callback function.
*/
TokenSigner.prototype.signRequest = function (webResource, callback) {
  webResource.withHeader(HeaderConstants.AUTHORIZATION, 'Bearer ' + this.tokenCredential.get());
  callback(null);
};

module.exports = TokenSigner;