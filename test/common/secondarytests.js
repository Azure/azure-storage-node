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
var Constants = azure.Constants;
var StorageUtilities = azure.StorageUtilities;
var SR = testutil.libRequire('common/util/sr');
var RetryPolicyFilter = azure.RetryPolicyFilter;

var hostName = process.env['AZURE_STORAGE_ACCOUNT'];
var testPrimaryHost = 'http://'+ hostName + '.blob.core.windows.net';
var testSecondaryHost = 'http://'+ hostName + '-secondary.blob.core.windows.net';
var blobService;
var blobServiceWithFilter;

var container = 'secondarytestscontainer';

describe('SecondaryTests', function () {
  beforeEach(function (done) {
    blobService = azure.createBlobService();
    done();
  });

  describe('locationModeWithMissingHost', function () {
    it('should throw when locationMode is not limited to PRIMARY_ONLY when blobService does not have a secondary host', function (done) {
      var host = {
        primaryHost: testPrimaryHost
      };

      blobService.host = host;

      var options = {
        locationMode: StorageUtilities.LocationMode.SECONDARY_ONLY
      };

      assert.throws(function () { blobService.getContainerProperties(container, options, function () { }); },
        function (err) {return (err instanceof Error) && err.message === SR.STORAGE_HOST_MISSING_LOCATION});

      options.locationMode = StorageUtilities.LocationMode.SECONDARY_THEN_PRIMARY;
      assert.throws(function () { blobService.getContainerProperties(container, options, function () { }); },
        function (err) {return (err instanceof Error) && err.message === SR.STORAGE_HOST_MISSING_LOCATION});

      options.locationMode = StorageUtilities.LocationMode.PRIMARY_THEN_SECONDARY;
      assert.throws(function () { blobService.getContainerProperties(container, options, function () { }); },
        function (err) {return (err instanceof Error) && err.message === SR.STORAGE_HOST_MISSING_LOCATION});

      done();
    });
  });

  describe('multiLocationRetriesBlob', function() {
  	it('should download container properties', function (done) {

			var downloadContainerProperties = function (optionsLocationMode, serviceLocationMode, callback) {
				blobServiceWithFilter.defaultLocationMode = serviceLocationMode;

				var options = {
					locationMode: optionsLocationMode
				};

				blobServiceWithFilter.getContainerProperties(container, options, function(err) {
					assert.equal('NotFound', err.code);
					assert.equal(404, err.statusCode);
					callback();
				});
			};

			this.count = 0;
			this.initialLocation = Constants.StorageLocation.PRIMARY;
			this.locationList = [];
			var self = this;

			var callback = function (webresource) {
				var location = (self.count === 0) ? self.initialLocation : self.locationList[self.count - 1];
				if(location === Constants.StorageLocation.PRIMARY) {
					assert.equal(true, webresource.uri.indexOf('-secondary') === -1);
				}
				else {
					assert.equal(false, webresource.uri.indexOf('-secondary') === -1);
				}
				self.count++;
			};

			setRetryPolicy(0);

			blobServiceWithFilter.on('sendingRequestEvent', callback);

			downloadContainerProperties(StorageUtilities.LocationMode.PRIMARY_ONLY, StorageUtilities.LocationMode.PRIMARY_ONLY, function() {
				self.count = 0;
				downloadContainerProperties(undefined, StorageUtilities.LocationMode.PRIMARY_ONLY, function() {
					self.count = 0;
					self.initialLocation = Constants.StorageLocation.SECONDARY;
					downloadContainerProperties(StorageUtilities.LocationMode.SECONDARY_ONLY, StorageUtilities.LocationMode.SECONDARY_ONLY, function() {
						self.count = 0;
						downloadContainerProperties(undefined, StorageUtilities.LocationMode.SECONDARY_ONLY, function() {
							self.count = 0;
							self.initialLocation = Constants.StorageLocation.PRIMARY;
							downloadContainerProperties(StorageUtilities.LocationMode.PRIMARY_THEN_SECONDARY, StorageUtilities.LocationMode.PRIMARY_THEN_SECONDARY, function() {
								self.count = 0;
								downloadContainerProperties(undefined, StorageUtilities.LocationMode.PRIMARY_THEN_SECONDARY, function() {
									self.count = 0;
									self.initialLocation = Constants.StorageLocation.SECONDARY;
									downloadContainerProperties(StorageUtilities.LocationMode.SECONDARY_THEN_PRIMARY, StorageUtilities.LocationMode.SECONDARY_THEN_PRIMARY, function() {
										self.count = 0;
										downloadContainerProperties(undefined, StorageUtilities.LocationMode.SECONDARY_THEN_PRIMARY, function() {
											setRetryPolicy(3);
											self.count = 0;
											self.initialLocation = Constants.StorageLocation.PRIMARY;
											self.locationList = [Constants.StorageLocation.SECONDARY, Constants.StorageLocation.PRIMARY, Constants.StorageLocation.PRIMARY];
											downloadContainerProperties(StorageUtilities.LocationMode.PRIMARY_THEN_SECONDARY, StorageUtilities.LocationMode.PRIMARY_THEN_SECONDARY, function() {
												self.count = 0;
												self.locationList = [Constants.StorageLocation.PRIMARY, Constants.StorageLocation.PRIMARY, Constants.StorageLocation.PRIMARY];
												downloadContainerProperties(StorageUtilities.LocationMode.PRIMARY_ONLY, StorageUtilities.LocationMode.PRIMARY_ONLY, function() {
													self.count = 0;
													self.initialLocation = Constants.StorageLocation.SECONDARY;
													self.locationList = [Constants.StorageLocation.PRIMARY, Constants.StorageLocation.PRIMARY, Constants.StorageLocation.PRIMARY];
													downloadContainerProperties(StorageUtilities.LocationMode.SECONDARY_THEN_PRIMARY, StorageUtilities.LocationMode.SECONDARY_THEN_PRIMARY, function() {
														self.count = 0;
														self.initialLocation = Constants.StorageLocation.SECONDARY;
														self.locationList = [Constants.StorageLocation.SECONDARY, Constants.StorageLocation.SECONDARY, Constants.StorageLocation.SECONDARY];
														downloadContainerProperties(StorageUtilities.LocationMode.SECONDARY_ONLY, StorageUtilities.LocationMode.SECONDARY_ONLY, function() {
															done();
														});
													});
												});
											});
										});
									});
								});
							});
						});
					});
				});
			});
		});
	});
  
  function setRetryPolicy (retryCount) {

		var retryOnContainerBeingDeleted = new RetryPolicyFilter();
		retryOnContainerBeingDeleted.retryCount = retryCount;
		retryOnContainerBeingDeleted.retryInterval = 1000;

		retryOnContainerBeingDeleted.shouldRetry = function(statusCode, retryData) {
			var retryInfo = {
				retryInterval: this.retryInterval,
				retryable: retryData.retryCount < this.retryCount
			};

			return retryInfo;
		};

		blobServiceWithFilter = blobService.withFilter(retryOnContainerBeingDeleted);
  }

});

