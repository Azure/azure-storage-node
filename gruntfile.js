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
    downloadNuGet: {
      path : '.nuget',
      src : 'http://www.nuget.org/nuget.exe'
    },

    //jsdoc config
    jsdoc : {
        dist : {
            src: [
                  "README.md",
                  "lib/azure-storage.js",
                  "lib/common/filters/retrypolicyfilter.js",
                  "lib/common/filters/linearretrypolicyfilter.js",
                  "lib/common/filters/exponentialretrypolicyfilter.js",
                  "lib/common/services/storageutilities.js",
                  "lib/common/util/date.js",
                  "lib/services/blob/blobservice.js",
                  "lib/services/blob/blobutilities.js",
                  "lib/services/queue/queueservice.js",
                  "lib/services/queue/queueutilities.js",
                  "lib/services/table/tableservice.js",
                  "lib/services/table/tablebatch.js",
                  "lib/services/table/tablequery.js",
                  "lib/services/table/tableutilities.js"
            ],
            options: {
                destination: 'docs',
                template : 'node_modules/ink-docstrap/template',
                configure: 'jsdoc/jsdoc.json'
            }
        }
    },
    devserver: { options:
      { 'type' : 'http',
        'port' : 8888,
        'base' : 'docs'
      }
    }
  });
  grunt.loadNpmTasks('grunt-jsdoc');
  grunt.loadNpmTasks('grunt-devserver');
  
  grunt.loadTasks('tasks');

  grunt.registerTask('publishdocs', ['githubPages:target']);
};
