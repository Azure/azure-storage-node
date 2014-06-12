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

var exports = module.exports;

var azureutil = require('./util/util');

require('./util/patch-xmlbuilder');

var nodeVersion = azureutil.getNodeVersion();
if (nodeVersion.major === 0 && nodeVersion.minor > 8 && !(nodeVersion.minor > 10 || (nodeVersion.minor === 10 && nodeVersion.patch >= 3))) {
  throw new Error('The Windows Azure node SDK does not work with node versions > 0.8.22 and < 0.10.3. Please upgrade to node >= 0.10.3');
}

exports.xmlbuilder = require('xmlbuilder');
exports.xml2js = require('xml2js');

exports.Constants = require('./util/constants');
exports.SR = require('./util/sr');
exports.Logger = require('./diagnostics/logger');
exports.date = require('./util/date');

exports.WebResource = require('./http/webresource');
exports.StorageServiceClient = require('./services/storageserviceclient');

exports.ServiceSettings = require('./services/servicesettings');
exports.StorageServiceSettings = require('./services/storageservicesettings');
exports.StorageUtilities = require('./services/StorageUtilities');

exports.ServicePropertiesResult = require('./services/servicepropertiesresult');
exports.ServiceStatsParser = require('./services/servicestatsparser');

// Other filters
exports.LinearRetryPolicyFilter = require('./services/filters/linearretrypolicyfilter');
exports.ExponentialRetryPolicyFilter = require('./services/filters/exponentialretrypolicyfilter');
exports.RetryPolicyFilter = require('./services/filters/retrypolicyfilter');

exports.HmacSha256Sign = require('./services/hmacsha256sign');
exports.ISO8061Date = require('./util/iso8061date');

exports.util = require('./util/util');
exports.validate = require('./util/validate');
exports.SR = require('./util/sr');
exports.AclResult = require('./services/aclresult');

exports.SharedAccessSignature = require('./services/sharedaccesssignature');
exports.SharedKey = require('./services/sharedkey');
