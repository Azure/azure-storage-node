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
var _ = require('underscore');
var extend = require('extend');

var testutil = require('../framework/util');
var TestSuite = require('../framework/test-suite');

if (testutil.isBrowser()) {
  var azure = extend({}, AzureStorage.Blob, AzureStorage.Table, AzureStorage.Queue, AzureStorage.File);
} else {
  var azure = require('../../');
}

var Constants = azure.Constants;
var HeaderConstants = Constants.HeaderConstants;
var ServiceTypes = Constants.ServiceType;

var suite = new TestSuite('serviceproperty-tests');
var timeout = (suite.isRecording || !suite.isMocked) ? 30000 : 10;

var blobService;
var queueService;
var tableService;
var fileService;

describe('ServiceProperties', function () {
  before(function (done) {
    if (suite.isMocked) {
      testutil.POLL_REQUEST_INTERVAL = 0;
    }
    suite.setupSuite(function () {
      blobService = azure.createBlobService(process.env['AZURE_STORAGE_CONNECTION_STRING']).withFilter(new azure.ExponentialRetryPolicyFilter());
      queueService = azure.createQueueService(process.env['AZURE_STORAGE_CONNECTION_STRING']).withFilter(new azure.ExponentialRetryPolicyFilter());
      tableService = azure.createTableService(process.env['AZURE_STORAGE_CONNECTION_STRING']).withFilter(new azure.ExponentialRetryPolicyFilter());
      fileService = azure.createFileService(process.env['AZURE_STORAGE_CONNECTION_STRING']).withFilter(new azure.ExponentialRetryPolicyFilter());
      done();
    });
  });

  after(function (done) {
    suite.teardownSuite(done);
  });

  beforeEach(function (done) {
    suite.setupTest(done);
  });

   afterEach(function (done) {
    suite.teardownTest(done);
  });

  describe('fullServiceProperties', function () {   
    it('should get/set complete blob service properties', function (done) {
      var serviceProperties = defaultServiceProperties(ServiceTypes.Blob);
      fullServicePropertiesTest(blobService, serviceProperties, done);
    });

    it('should get/set complete queue service properties', function (done) {
      var serviceProperties = defaultServiceProperties(ServiceTypes.Queue);      
      fullServicePropertiesTest(queueService, serviceProperties, done);
    });

    it('should get/set complete table service properties', function (done) {
      var serviceProperties = defaultServiceProperties(ServiceTypes.Table);     
      fullServicePropertiesTest(tableService, serviceProperties, done);
    });
    
    it('should get/set complete file service properties', function (done) {
      var serviceProperties = defaultServiceProperties(ServiceTypes.File);
      fullServicePropertiesTest(fileService, serviceProperties, done);
    });
  });

  describe('defaultServiceProperties', function () {   
    it('should write default blob service properties', function (done) {
      var serviceProperties = emptyServiceProperties(ServiceTypes.Blob);
      baseServicePropertiesTest(blobService, ServiceTypes.Blob, serviceProperties, done);
    });

    it('should write default queue service properties', function (done) {
      var serviceProperties = emptyServiceProperties(ServiceTypes.Queue);
      baseServicePropertiesTest(queueService, ServiceTypes.Queue, serviceProperties, done);
    });

    it('should write default table service properties', function (done) {
      var serviceProperties = emptyServiceProperties(ServiceTypes.Table);
      baseServicePropertiesTest(tableService, ServiceTypes.Table, serviceProperties, done);
    });
    
    it('should write default file service properties', function (done) {
      var serviceProperties = emptyServiceProperties(ServiceTypes.File);
      baseServicePropertiesTest(fileService, ServiceTypes.File, serviceProperties, done);
    });
  });

  describe('overwriteServiceProperties', function () { 
  // the service requires one or more service property children so an empty Cors tag is present
    it('should overwrite with empty blob service properties', function (done) {
      var serviceProperties = mostlyNullServiceProperties();
      overwriteServicePropertiesTest(blobService, serviceProperties, done);
    });

    it('should overwrite with empty queue service properties', function (done) {
      var serviceProperties = mostlyNullServiceProperties();      
      overwriteServicePropertiesTest(queueService, serviceProperties, done);
    });

    it('should overwrite with empty table service properties', function (done) {
      var serviceProperties = mostlyNullServiceProperties();     
      overwriteServicePropertiesTest(tableService, serviceProperties, done);
    });
    
    it('should overwrite with empty file service properties', function (done) {
      var serviceProperties = mostlyNullServiceProperties();
      overwriteServicePropertiesTest(fileService, serviceProperties, done);
    });
  });
});

function fullServicePropertiesTest(service, serviceProperties, done){
  service.setServiceProperties(serviceProperties, function (error) {
    assert.equal(error, null);
    var inner = function(){    
      service.getServiceProperties(function (error2, serviceProperties2) {
        assert.equal(error2, null);
        assertServicePropertiesEqual(serviceProperties2, serviceProperties);
        done();
      });
    };
    setTimeout(inner, timeout);
  });
}

function overwriteServicePropertiesTest(service, serviceProperties, done){
  service.getServiceProperties(function(error1, serviceProperties1){
    assert.equal(error1, null);
    service.setServiceProperties(serviceProperties, function (error2) {
      assert.equal(error2, null);
      var inner = function(){
        service.getServiceProperties(function (error3, serviceProperties2) {
          assert.equal(error3, null);
          serviceProperties1.Cors = {};
          assertServicePropertiesEqual(serviceProperties2, serviceProperties1);
          done();
        });
      };
      setTimeout(inner, timeout);
    });
  });
}

function baseServicePropertiesTest(service, serviceType, serviceProperties, done){
  var expectedServiceProperties = baseServiceProperties(serviceType);
  service.setServiceProperties(serviceProperties, function (error) {
    assert.equal(error, null);
    var inner = function(){
      service.getServiceProperties(function (error2, serviceProperties2) {
        assert.equal(error2, null);
        assertServicePropertiesEqual(serviceProperties2, expectedServiceProperties);
        done();
      });
    };
    setTimeout(inner, timeout);
  });
}

function assertServicePropertiesEqual(serviceProperties1, serviceProperties2){
  assert.deepEqual(serviceProperties2.Logging, serviceProperties1.Logging);
  assert.deepEqual(serviceProperties2.HourMetrics, serviceProperties1.HourMetrics);
  assert.deepEqual(serviceProperties2.MinuteMetrics, serviceProperties1.MinuteMetrics);

  sortCorsRuleArrays(serviceProperties1);
  sortCorsRuleArrays(serviceProperties2);
  assert.deepEqual(serviceProperties2.Cors, serviceProperties1.Cors);
}

function sortCorsRuleArrays(serviceProperties){
  if(serviceProperties && serviceProperties.Cors && serviceProperties.Cors.CorsRule){
    var rules = serviceProperties.Cors.CorsRule;
    rules.forEach(function(rule){
      if(rule.AllowedOrigins){
        rule.AllowedOrigins.sort();
      }

      if(rule.AllowedMethods){
        rule.AllowedMethods.sort();
      }

      if(rule.AllowedHeaders){
        rule.AllowedHeaders.sort();
      }

      if(rule.ExposedHeaders){
        rule.ExposedHeaders.sort();
      }
    });
  }
} 

function defaultServiceProperties(serviceType){
  var serviceProperties = {};
  
  if (serviceType != ServiceTypes.File) {
    serviceProperties.Logging = {};
    serviceProperties.Logging.Version = '1.0';
    serviceProperties.Logging.Delete = true;
    serviceProperties.Logging.Read = true;
    serviceProperties.Logging.Write = true;
    serviceProperties.Logging.RetentionPolicy = {};
    serviceProperties.Logging.RetentionPolicy.Enabled = true;
    serviceProperties.Logging.RetentionPolicy.Days = 1;
  }
  
  serviceProperties.HourMetrics = {};
  serviceProperties.HourMetrics.Enabled = true;
  serviceProperties.HourMetrics.Version = '1.0';
  serviceProperties.HourMetrics.IncludeAPIs = true;
  serviceProperties.HourMetrics.RetentionPolicy = {};
  serviceProperties.HourMetrics.RetentionPolicy.Enabled = true;
  serviceProperties.HourMetrics.RetentionPolicy.Days = 1;
  
  serviceProperties.MinuteMetrics = {};
  serviceProperties.MinuteMetrics.Enabled = true;
  serviceProperties.MinuteMetrics.Version = '1.0';
  serviceProperties.MinuteMetrics.IncludeAPIs = true;
  serviceProperties.MinuteMetrics.RetentionPolicy = {};
  serviceProperties.MinuteMetrics.RetentionPolicy.Enabled = true;
  serviceProperties.MinuteMetrics.RetentionPolicy.Days = 1;

  serviceProperties.Cors = {};
  var rule = {};
  rule.AllowedOrigins = ['www.ab.com', 'www.bc.com'];
  rule.AllowedMethods = ['GET', 'PUT'];
  rule.AllowedHeaders = ['x-ms-meta-data*', 'x-ms-meta-target*', 'x-ms-meta-xyz', 'x-ms-meta-foo'];
  rule.ExposedHeaders = ['x-ms-meta-data*', 'x-ms-meta-source*', 'x-ms-meta-abc', 'x-ms-meta-bcd'];
  rule.MaxAgeInSeconds = 500;
  serviceProperties.Cors.CorsRule = [rule, rule];
  
  if (serviceType === ServiceTypes.Blob) {
    serviceProperties.DefaultServiceVersion = HeaderConstants.TARGET_STORAGE_VERSION;
  }

  return serviceProperties;
}

function emptyServiceProperties(serviceType){
  var serviceProperties = {};
  if (serviceType != ServiceTypes.File) {
    serviceProperties.Logging = {};
  }
  
  serviceProperties.HourMetrics = {};
  serviceProperties.MinuteMetrics = {};
  serviceProperties.Cors = {};

  return serviceProperties;
}

function baseServiceProperties(serviceType){
  var serviceProperties = {};
  
  if (serviceType != ServiceTypes.File) {
    serviceProperties.Logging = {};
    serviceProperties.Logging.Version = '1.0';
    serviceProperties.Logging.Delete = false;
    serviceProperties.Logging.Read = false;
    serviceProperties.Logging.Write = false;
    serviceProperties.Logging.RetentionPolicy = {};
    serviceProperties.Logging.RetentionPolicy.Enabled = false;
  }
  
  serviceProperties.HourMetrics = {};
  serviceProperties.HourMetrics.Version = '1.0';
  serviceProperties.HourMetrics.Enabled = false;
  serviceProperties.HourMetrics.RetentionPolicy = {};
  serviceProperties.HourMetrics.RetentionPolicy.Enabled = false;
  
  serviceProperties.MinuteMetrics = {};
  serviceProperties.MinuteMetrics.Version = '1.0';
  serviceProperties.MinuteMetrics.Enabled = false;
  serviceProperties.MinuteMetrics.RetentionPolicy = {};
  serviceProperties.MinuteMetrics.RetentionPolicy.Enabled = false;
  serviceProperties.Cors = {};

  return serviceProperties;
}

function mostlyNullServiceProperties(){
  var serviceProperties = {};

  serviceProperties.Logging = null;
  serviceProperties.HourMetrics = null;
  serviceProperties.MinuteMetrics = null;
  serviceProperties.Cors = {};
  serviceProperties.DefaultServiceVersion = null;

  return serviceProperties;
}