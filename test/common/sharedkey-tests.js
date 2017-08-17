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
var qs = require('querystring');

// Test includes
var testutil = require('../framework/util');

// Lib includes
var azure = testutil.libRequire('azure-storage');
var WebResource = azure.WebResource;
var Constants = azure.Constants;
var StorageServiceClientConstants = Constants.StorageServiceClientConstants;
var QueryStringConstants = Constants.QueryStringConstants;
var HeaderConstants = Constants.HeaderConstants;
var AccountSasConstants = Constants.AccountSasConstants;

var SharedKey = testutil.libRequire('common/signing/sharedkey');

var sharedkey;

describe('sharedkey-tests', function () {
  before(function (done) {
    sharedkey = new SharedKey(StorageServiceClientConstants.DEVSTORE_STORAGE_ACCOUNT, StorageServiceClientConstants.DEVSTORE_STORAGE_ACCESS_KEY, false);

    done();
  });

  it('SignRequest', function (done) {
    var webResource = WebResource.get('container');
    webResource.withQueryOption(QueryStringConstants.RESTYPE, 'container');
    webResource.withHeader(HeaderConstants.CONTENT_TYPE, '');
    webResource.withHeader(HeaderConstants.STORAGE_VERSION, HeaderConstants.TARGET_STORAGE_VERSION);
    webResource.withHeader(HeaderConstants.MS_DATE, 'Fri, 23 Sep 2011 01:37:34 GMT');

    sharedkey.signRequest(webResource, function () {
      assert.equal(webResource.headers[HeaderConstants.AUTHORIZATION], 'SharedKey devstoreaccount1:phWLwBDQmLRuhOCKblR0+k6+6N/EpF236K5KID6VXx8=');

      done();
    });
  });
  
  it('generateAccountSignedQueryString', function(done){
    var sharedAccessPolicy = {
      AccessPolicy: {
        Services: AccountSasConstants.Services.BLOB,
        ResourceTypes: AccountSasConstants.Resources.SERVICE,
        Permissions: AccountSasConstants.Permissions.READ,
        Protocols: AccountSasConstants.Protocols.HTTPSONLY,
        IPAddressOrRange: '168.1.5.60-168.1.5.70',
        Start: new Date('February 16, 2016 12:00:00 am GMT'),
        Expiry: new Date('February 16, 2016 12:30:00 am GMT')
      }
    };
      
    var sharedAccessSignature = sharedkey.generateAccountSignedQueryString(sharedAccessPolicy);
    
    assert.notEqual(sharedAccessSignature, null);
    var sasQueryString = qs.parse(sharedAccessSignature);

    assert.equal(sasQueryString[QueryStringConstants.SIGNED_SERVICES], sharedAccessPolicy.AccessPolicy.Services);
    assert.equal(sasQueryString[QueryStringConstants.SIGNED_RESOURCE_TYPES], sharedAccessPolicy.AccessPolicy.ResourceTypes);
    assert.equal(sasQueryString[QueryStringConstants.SIGNED_PERMISSIONS], sharedAccessPolicy.AccessPolicy.Permissions);
    assert.equal(sasQueryString[QueryStringConstants.SIGNED_START], sharedAccessPolicy.AccessPolicy.Start);
    assert.equal(sasQueryString[QueryStringConstants.SIGNED_EXPIRY], sharedAccessPolicy.AccessPolicy.Expiry);
    assert.equal(sasQueryString[QueryStringConstants.SIGNED_PROTOCOL], sharedAccessPolicy.AccessPolicy.Protocols);
    assert.equal(sasQueryString[QueryStringConstants.SIGNED_IP], sharedAccessPolicy.AccessPolicy.IPAddressOrRange);
    assert.equal(sasQueryString[QueryStringConstants.SIGNED_VERSION], HeaderConstants.TARGET_STORAGE_VERSION);
    assert.equal(sasQueryString[QueryStringConstants.SIGNATURE], '4J76vq0uIO2nuRsgVPA2bJiKdKTmDfeghzumaLhOPas=');

    done();
  });
});