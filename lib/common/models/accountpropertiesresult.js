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
var Constants = require('../util/constants');
var HeaderConstants = Constants.HeaderConstants;

exports.parse = function (headers) {
  var accountPropertiesResult = {};

  if (headers[HeaderConstants.SKU_NAME]) {
    accountPropertiesResult.SkuName = headers[HeaderConstants.SKU_NAME];
  }

  if (headers[HeaderConstants.ACCOUNT_KIND]) {
    accountPropertiesResult.AccountKind = headers[HeaderConstants.ACCOUNT_KIND];
  }

  return accountPropertiesResult;
};