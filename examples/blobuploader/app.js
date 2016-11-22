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

var express = require('express');
var expressLayouts = require('express-ejs-layouts');
var path = require('path');
var azure = require('azure-storage');
var formidable = require('formidable');
var helpers = require('./helpers.js');

var app = express();

// Global request options, set the retryPolicy
var blobClient = azure.createBlobService('UseDevelopmentStorage=true').withFilter(new azure.ExponentialRetryPolicyFilter());
var containerName = 'webpi';

//Configuration
app.set('views', path.join(__dirname + '/views'));
app.set('view engine', 'ejs');
app.set('layout', 'layout');
app.use(express.static(path.join(__dirname + '/public')));
app.use(expressLayouts);

app.set('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.set('production', function(){
  app.use(express.errorHandler());
});

app.param('id', function (req, res, next) {
  next();
});

//Routes
app.get('/', function (req, res) {
  res.render('index.ejs', { title: 'Welcome' });
});

app.get('/Upload', function (req, res) {
  res.render('upload.ejs', { title: 'Upload File' });
});

app.get('/Display', function (req, res) {
  blobClient.listBlobsSegmented(containerName, null, function (error, blobs, result) {
    res.render('display.ejs', { title: 'List of Blobs', serverBlobs: blobs.entries });
  });
});

app.get('/Download/:id', function (req, res) {
  blobClient.getBlobProperties(containerName, req.params.id, function (err, blobInfo) {
    if (err === null) {
      res.header('content-type', blobInfo.contentType);
      res.header('content-disposition', 'attachment; filename=' + blobInfo.metadata.filename);
      blobClient.getBlobToStream(containerName, req.params.id, res, function () { });
    } else {
      helpers.renderError(res);
    }
  });
});

app.post('/uploadhandler', function (req, res) {
  var form = new formidable.IncomingForm();

  form.parse(req, function (err, fields, files) {
    var formValid = true;
    if (fields.itemName === '') {
      helpers.renderError(res);
      formValid = false;
    }

    if (formValid) {
      var extension = files.uploadedFile.name.split('.').pop();
      var newName = fields.itemName + '.' + extension;

      var options = {
        contentType: files.uploadedFile.type,
        metadata: { fileName: newName }
      };

      blobClient.createBlockBlobFromLocalFile(containerName, fields.itemName, files.uploadedFile.path, options, function (error) {
        if (error != null) {
          helpers.renderError(res);
        } else {
          res.redirect('/Display');
        }
      });
    } else {
      helpers.renderError(res);
    }
  });
});

app.post('/Delete/:id', function (req, res) {
  blobClient.deleteBlob(containerName, req.params.id, function (error) {
    if (error != null) {
      helpers.renderError(res);
    } else {
      res.redirect('/Display');
    }
  });
});

blobClient.createContainerIfNotExists(containerName, function (error) {
  if (error) {
    console.log(error);
  } else { 
    setPermissions();
  }
});

function setPermissions() {
  var options = { publicAccessLevel: azure.BlobUtilities.BlobContainerPublicAccessType.BLOB };
  blobClient.setContainerAcl(containerName, null, options, function (error) {
    if (error) {
      console.log(error);
    } 
  });
}

module.exports = app;