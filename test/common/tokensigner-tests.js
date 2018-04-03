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

var assert = require('assert');

// Test includes
var testutil = require('../framework/util');

// Lib includes
var azure = testutil.libRequire('azure-storage');
var WebResource = azure.WebResource;
var Constants = azure.Constants;
var HeaderConstants = Constants.HeaderConstants;

var TokenSigner = testutil.libRequire('common/signing/tokensigner');
var TokenCredential = testutil.libRequire('common/models/tokencredential');

describe('tokensigner-tests', function () {
  it('SignRequest', function () {
    var token = new TokenCredential('abc');
    var signer = new TokenSigner(token);

    var webResource = WebResource.get('container');
    signer.signRequest(webResource, function () {
      assert.equal(webResource.headers[HeaderConstants.AUTHORIZATION], 'Bearer abc');
    });

    token.set('def');
    signer.signRequest(webResource, function () {
      assert.equal(webResource.headers[HeaderConstants.AUTHORIZATION], 'Bearer def');
    });
  });
});