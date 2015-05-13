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

module.exports = function(grunt) {
  //init stuff
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),

    mochaTest: {
      test: {
        options: {
          reporter: 'spec',
          quiet: false,
          clearRequireCache: false
        },
        src: ['test/**/*.js']
      }
    },

    //jsdoc config
    jsdoc: {
      dist: {
        src: [
          "README.md",
          "lib/azure-storage.js",
          "lib/common/filters/retrypolicyfilter.js",
          "lib/common/filters/linearretrypolicyfilter.js",
          "lib/common/filters/exponentialretrypolicyfilter.js",
          "lib/common/services/storageutilities.js",
          "lib/services/blob/blobservice.js",
          "lib/services/blob/blobutilities.js",
          "lib/services/queue/queueservice.js",
          "lib/services/queue/queueutilities.js",
          "lib/services/table/tableservice.js",
          "lib/services/table/tablebatch.js",
          "lib/services/table/tablequery.js",
          "lib/services/table/tableutilities.js",
          "lib/services/file/fileservice.js",
          "lib/services/file/fileutilities.js",
        ],
        options: {
          destination: 'docs',
          template: "node_modules/grunt-jsdoc/node_modules/ink-docstrap/template",
          configure: "jsdoc/jsdoc.json"
        }
      }
    },

    // devserver config
    devserver: {
      server : {},
      options: {
        'base': 'docs'
      }
    }
  });

  grunt.loadNpmTasks('grunt-jsdoc');
  grunt.loadNpmTasks('grunt-mocha-test');
  grunt.loadNpmTasks('grunt-devserver');

  grunt.registerTask('default', ['mochaTest']);
  grunt.registerTask('doc', ['jsdoc', 'devserver']);
};