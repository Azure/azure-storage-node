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

var _ = require('underscore');
var fs = require('fs');
var os = require('os');
var path = require('path');
var guid = require('node-uuid');
var nockHelper = require('./nock-helper');

exports = module.exports = TestSuite;

function TestSuite(testPrefix, env, forceMocked) {
  if (!Array.isArray(env)) {
    forceMocked = env;
    env = [];
  }

  function stripAccessKey(connectionString) {
    return connectionString.replace(/AccountKey=[^;]+/, 'AccountKey=null');
  }

  var requiredEnvironment = [{ name: 'AZURE_STORAGE_CONNECTION_STRING', secure: stripAccessKey }];
  env = env.concat(requiredEnvironment);

  this.testPrefix = testPrefix;
  this.currentTest = 0;
  this.nameIndex = 0;
  this.recordingsFile = __dirname + '/../recordings/' + this.testPrefix + '.nock.js';

  if (forceMocked) {
    this.isMocked = true;
  } else {
    this.isMocked = testPrefix && !process.env.NOCK_OFF;
  }

  this.isRecording = process.env.AZURE_NOCK_RECORD;
  this.skipSubscription = true;

  // Normalize environment
  this.normalizeEnvironment(env);
  this.validateEnvironment();

  this.uuidsGenerated = [];
  this.currentUuid = 0;

  this.randomTestIdsGenerated = [];
  this.numberOfRandomTestIdGenerated = 0;
}

_.extend(TestSuite.prototype, {
  isPlayback: function (){
    return this.isMocked && !this.isRecording;
  },

  normalizeEnvironment: function (env) {
    env = env.filter(function (e) {
      if (e.requiresCert || e.requiresToken) {
        this.requiresCert = e.requiresCert;
        this.requiresToken = e.requiresToken;
        return false;
      }
      return true;
    });

    this.requiredEnvironment = env.map(function (env) {
      if (typeof(env) === 'string') {
        return { name: env, secure: false };
      } else {
        return env;
      }
    });
  },

  validateEnvironment: function () {
    if (this.isPlayback()) {
      return;
    }

    var messages = [];
    var missing = [];
    this.requiredEnvironment.forEach(function (e) {
      if (!process.env[e.name] && !e.defaultValue) {
        missing.push(e.name);
      }
    });

    if (missing.length > 0) {
      messages.push('This test requires the following environment variables which are not set: ' +
        missing.join(', '));
    }

    if (this.requiresCert && this.requiresToken) {
      messages.push('This test is marked as requiring both a certificate and a token. This is impossible, please fix the test setup.');
    } else if (this.requiresCert && profile.current.currentSubscription.user) {
      messages.push('This test requires certificate authentication only. The current subscription has an access token. Please switch subscriptions or use azure logout to remove the access token');
    } else if(this.requiresCert && !profile.current.currentSubscription.managementCertificate) {
      messges.push('This test requires certificate authentication but the current subscription does not have a management certificate. Please use azure account import to obtain one.');
    } else if (this.requiresToken && !profile.current.currentSubscription.user) {
      messages.push('This test required an access token but the current subscription does not have one. Please use azure login to obtain an access token');
    }

    if (messages.length > 0) {
      throw new Error(messages.join(os.EOL));
    }
  },

  setEnvironmentDefaults: function () {
    this.requiredEnvironment.forEach(function (env) {
      if (env.defaultValue && !process.env[env.name]) {
        process.env[env.name] = env.defaultValue;
      }
    });
  },

  setupSuite: function (callback) {
    if (this.isMocked) {
      process.env.AZURE_ENABLE_STRICT_SSL = false;
    }

    if (this.isPlayback()) {
      var nocked = require(this.recordingsFile);
      if (nocked.randomTestIdsGenerated) {
        this.randomTestIdsGenerated = nocked.randomTestIdsGenerated();
      }

      if (nocked.uuidsGenerated) {
        this.uuidsGenerated = nocked.uuidsGenerated();
      }

      if (nocked.getMockedProfile) {
        profile.current = nocked.getMockedProfile();
        profile.current.save = function () { };
      }

      if (nocked.setEnvironment) {
        nocked.setEnvironment();
      }
    } else {
      this.setEnvironmentDefaults();
    }

    if (this.isMocked && this.isRecording) {
      this.writeRecordingHeader();
    }

    callback();
  },

  teardownSuite: function (callback) {
    this.currentTest = 0;

    if (this.isMocked) {
      if (this.isRecording) {
        fs.appendFileSync(this.recordingsFile, '];');
        this.writeGeneratedUuids();
        this.writeGeneratedRandomTestIds();
      }

      delete process.env.AZURE_ENABLE_STRICT_SSL;
    }

    callback();
  },

  setupTest: function (callback) {
    nockHelper.nockHttp();

    if (this.isMocked && this.isRecording) {
      // nock recoding
      nockHelper.nock.recorder.rec(true);
    }

    if (this.isPlayback()) {
      // nock playback
      var nocked = require(this.recordingsFile);

      if (this.currentTest < nocked.scopes.length) {
        nocked.scopes[this.currentTest++].forEach(function (createScopeFunc) {
          createScopeFunc(nockHelper.nock);
        });
      } else {
        throw new Error('It appears the ' + this.recordingsFile + ' file has more tests than there are mocked tests. ' +
          'You may need to re-generate it.');
      }
    }

    callback();
  },

  teardownTest: function (callback) {
    if (this.isMocked && this.isRecording) {
      // play nock recording
      var scope = this.scopeWritten ? ',\n[' : '[';
      this.scopeWritten = true;
      var lineWritten;
      nockHelper.nock.recorder.play().forEach(function (line) {
        if (line.indexOf('nock') >= 0) {
          // apply fixups of nock generated mocks

          // do not filter on body as they usual have time related stamps
          line = line.replace(/(\.post\('.*?')\s*,\s*"[^]+[^\\]"\)/, '.filteringRequestBody(function (path) { return \'*\';})\n$1, \'*\')');
          line = line.replace(/(\.get\('.*?')\s*,\s*"[^]+[^\\]"\)/, '.filteringRequestBody(function (path) { return \'*\';})\n$1, \'*\')');
          line = line.replace(/(\.put\('.*?')\s*,\s*"[^]+[^\\]"\)/, '.filteringRequestBody(function (path) { return \'*\';})\n$1, \'*\')');
          line = line.replace(/(\.delete\('.*?')\s*,\s*"[^]+[^\\]"\)/, '.filteringRequestBody(function (path) { return \'*\';})\n$1, \'*\')');
          line = line.replace(/(\.merge\('.*?')\s*,\s*"[^]+[^\\]"\)/, '.filteringRequestBody(function (path) { return \'*\';})\n$1, \'*\')');
          line = line.replace(/(\.patch\('.*?')\s*,\s*"[^]+[^\\]"\)/, '.filteringRequestBody(function (path) { return \'*\';})\n$1, \'*\')');

          // put deployment have a timestamp in the url
          line = line.replace(/(\.put\('\/deployment-templates\/\d{8}T\d{6}')/,
            '.filteringPath(/\\/deployment-templates\\/\\d{8}T\\d{6}/, \'/deployment-templates/timestamp\')\n.put(\'/deployment-templates/timestamp\'');

          // Requests to logging service contain timestamps in url query params, filter them out too
          line = line.replace(/(\.get\('.*\/microsoft.insights\/eventtypes\/management\/values\?api-version=[0-9-]+)[^)]+\)/,
            '.filteringPath(function (path) { return path.slice(0, path.indexOf(\'&\')); })\n$1\')');

          scope += (lineWritten ? ',\n' : '') + 'function (nock) { \n' +
            'var result = ' + line + ' return result; }';
          lineWritten = true;
        }
      });
      scope += ']';
      fs.appendFileSync(this.recordingsFile, scope);
      nockHelper.nock.recorder.clear();
    }
    nockHelper.unNockHttp();

    callback();
  },

  writeRecordingHeader: function () {
    var template = fs.readFileSync(path.join(__dirname, 'preamble.template'), { encoding: 'utf8' });

    fs.writeFileSync(this.recordingsFile, _.template(template, {
      requiredEnvironment: this.requiredEnvironment
    }));
  },

  writeGeneratedUuids: function () {
    if (this.uuidsGenerated.length > 0) {
      var uuids = this.uuidsGenerated.map(function (uuid) { return '\'' + uuid + '\''; }).join(',');
      var content = util.format('\n exports.uuidsGenerated = function() { return [%s];};', uuids);
      fs.appendFileSync(this.recordingsFile, content);
      this.uuidsGenerated.length = 0;
    }
  },

  writeGeneratedRandomTestIds: function () {
    if (this.randomTestIdsGenerated.length > 0) {
      var ids = this.randomTestIdsGenerated.map(function (id) { return '\'' + id + '\''; }).join(',');
      var content = util.format('\n exports.randomTestIdsGenerated = function() { return [%s];};', ids);
      fs.appendFileSync(this.recordingsFile, content);
      this.randomTestIdsGenerated.length = 0;
    }
  },

  getName: function (prefix) {
  	if (this.isMocked) {
      return prefix + 'testdata' + (this.nameIndex++);
  	} else {
      return prefix + guid.v1().toLowerCase();
  	}
  }
});