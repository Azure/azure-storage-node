// 
// Copyright (c) Microsoft and contributors.  All rights reserved.
// 
// Licensed under the Apache License, Version 2.0 (the 'License');
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//   http://www.apache.org/licenses/LICENSE-2.0
// 
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an 'AS IS' BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// 
// See the License for the specific language governing permissions and
// limitations under the License.
// 
var assert = require('assert');

var testutil = require('../framework/util');
var azure = testutil.libRequire('azure-storage');
var Constants = azure.Constants;
var StorageUtilities = azure.StorageUtilities;

var blobService;
var queueService;
var tableService;

describe('ServiceStats', function () {
  before(function (done) {
    blobService = azure.createBlobService()
      .withFilter(new azure.ExponentialRetryPolicyFilter());
    blobService.defaultLocationMode = StorageUtilities.LocationMode.SECONDARY_ONLY;

    queueService = azure.createQueueService()
      .withFilter(new azure.ExponentialRetryPolicyFilter());
    queueService.defaultLocationMode = StorageUtilities.LocationMode.SECONDARY_ONLY;

    tableService = azure.createTableService()
      .withFilter(new azure.ExponentialRetryPolicyFilter());
    tableService.defaultLocationMode = StorageUtilities.LocationMode.SECONDARY_ONLY;

    done();
  });

  describe('get service stats', function () {   
    it('blob service', function (done) {
      blobService.getServiceStats(function (error, serviceStats){
        assert.strictEqual(error, null);
        verifyServiceStats(serviceStats);
        done();
      });
    });

    it('queue service', function (done) {
      queueService.getServiceStats(function (error, serviceStats){
        verifyServiceStats(serviceStats);
        done();
      });
    });

    it('table service', function (done) {
      tableService.getServiceStats(function (error, serviceStats){
        verifyServiceStats(serviceStats);
        done();
      });
    });
  });
});

function verifyServiceStats (serviceStats){
	assert.notEqual(serviceStats, null);
	assert.notEqual(serviceStats.GeoReplication, null);
	assert.notEqual(serviceStats.GeoReplication.Status, null);

	if(serviceStats.GeoReplication.LastSyncTime !== 'undefined'){
		assert.strictEqual(serviceStats.GeoReplication.Status, 'live');
	} else {
		assert.ok(serviceStats.GeoReplication.Status === 'bootstrap' || serviceStats.GeoReplication.Status === 'unavailable');
	}
}
