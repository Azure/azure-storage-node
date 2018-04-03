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

/**
* Creates a new TokenCredential object.
* @class
* The TokenCredential class is used to store the access token string.
* 
* @constructor
* @param {string} token The access token, such as an OAuth access token in string type.
*
* @example
* var azure = require('azure-storage');
* var tokenCredential = new azure.TokenCredential('myOAuthAccessToken');
* var blobService = azure.createBlobServiceWithTokenCredential('https://account.blob.core.windows.net', tokenCredential);
* tokenCredential.set('updatedOAuthAccessToken');
*/
function TokenCredential (token) {
  this.token = token;
}

/**
* Get current access token.
*
* @return {string} The current access token in string type.
*/
TokenCredential.prototype.get = function () {
  return this.token;
};

/**
* Renew the access token.
*
* @param {string} token The new access token in string.
*/
TokenCredential.prototype.set = function (token) {
  this.token = token;
};

module.exports = TokenCredential;