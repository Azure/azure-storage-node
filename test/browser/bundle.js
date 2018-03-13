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

var browserify = require('browserify');
var fs = require('fs');
var path = require('path');

var bs = browserify([
    path.resolve(__dirname, '../services/queue/queueservice-tests.js'),
    path.resolve(__dirname, '../services/table/tablebatch-tests.js'),
    path.resolve(__dirname, '../services/table/tabledatatype-tests.js'),
    path.resolve(__dirname, '../services/table/tablepayload-tests.js'),
    path.resolve(__dirname, '../services/table/tablequery-tests.js'),
    path.resolve(__dirname, '../services/table/tableservice-gb-tests.js'),
    path.resolve(__dirname, '../services/table/tableservice-tests.js'),
    path.resolve(__dirname, '../services/blob/blobservice-archive-tests.js'),
    path.resolve(__dirname, '../services/blob/blobservice-container-tests.js'),
    path.resolve(__dirname, '../services/blob/blobservice-lease-tests.js'),
    path.resolve(__dirname, '../services/blob/blobservice-sse-tests.js'),
    path.resolve(__dirname, '../services/blob/blobservice-tests.js'),
    path.resolve(__dirname, '../services/blob/blobservice-uploaddownload-tests.js'),
    path.resolve(__dirname, '../services/file/fileservice-directory-tests.js'),
    path.resolve(__dirname, '../services/file/fileservice-file-tests.js'),
    path.resolve(__dirname, '../services/file/fileservice-share-tests.js'),
    path.resolve(__dirname, '../services/file/fileservice-sharesnapshot-tests.js'),
    path.resolve(__dirname, '../services/file/fileservice-sse-tests.js'),
    path.resolve(__dirname, '../services/file/fileservice-tests.js'),
    path.resolve(__dirname, '../services/file/fileservice-uploaddownload-tests.js'),
    path.resolve(__dirname, '../common/connectionstringparsertests.js'),
    path.resolve(__dirname, '../common/secondarytests.js'),
    path.resolve(__dirname, '../common/servicesettingstests.js'),
    path.resolve(__dirname, '../common/servicestatstests.js'),
    path.resolve(__dirname, '../common/sharedkey-tests.js'),
    path.resolve(__dirname, '../common/storageserviceclienttests.js'),
    path.resolve(__dirname, '../common/storageservicesettingstests.js'),
    path.resolve(__dirname, '../common/filters/exponentialretrypolicyfilter-tests.js'),
    path.resolve(__dirname, '../common/filters/linearretrypolicyfilter-tests.js'),
    path.resolve(__dirname, '../common/util/iso8061date-tests.js'),
    path.resolve(__dirname, '../common/util/util-tests.js'),
    path.resolve(__dirname, '../common/util/validate-tests.js'),
    path.resolve(__dirname, '../azure-tests.js'),
    path.resolve(__dirname, '../accountsas-tests.js'),
    path.resolve(__dirname, './file/fileservice-upload.js'),
    path.resolve(__dirname, './blob/blobservice-upload.js')
], { require: ['https'] }).bundle();

bs.pipe(
    fs.createWriteStream(path.resolve(__dirname, 'browser.bundled.js'))
);