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
var azureCommon = require('./../../common/common');
var HeaderConstants = azureCommon.Constants.HeaderConstants;

// Expose 'BlobUtilities'.
exports = module.exports;

/**
* Defines constants, enums, and utility functions for use with the Blob service.
* @namespace BlobUtilities
*/
var BlobUtilities = {
  /**
  * Permission types
  *
  * @const
  * @enum {string}
  */
  SharedAccessPermissions: {
    READ: 'r',
    WRITE: 'w',
    DELETE: 'd',
    LIST: 'l'
  },

  /**
  * Blob access conditions.
  *
  * @const
  * @enum {string}
  */
  AccessConditions: {
    /** If the blob has been modified since the specified date */
    DATE_MODIFIED_SINCE: HeaderConstants.IF_MODIFIED_SINCE,
    /** If the blob has not been modified since the specified date */
    DATE_UNMODIFIED_SINCE: HeaderConstants.IF_UNMODIFIED_SINCE,
    /** If the ETag for the blob matches the specified ETag */
    ETAG_MATCH: HeaderConstants.IF_MATCH,
    /** If the ETag for the blob does not match the specified ETag */
    ETAG_NONE_MATCH: HeaderConstants.IF_NONE_MATCH
  },

  /**
  * Blob listing details.
  *
  * @const
  * @enum {string}
  */
  BlobListingDetails: {
    SNAPSHOTS: 'snapshots',
    METADATA: 'metadata',
    UNCOMMITTED_BLOBS: 'uncommittedblobs'
  },

  /**
  * Deletion options for blob snapshots
  *
  * @const
  * @enum {string}
  */
  SnapshotDeleteOptions: {
    SNAPSHOTS_ONLY: 'only',
    BLOB_AND_SNAPSHOTS: 'include'
  },

  /**
  * Type of block list to retrieve
  *
  * @const
  * @enum {string}
  */
  BlockListFilter: {
    ALL: 'all',
    COMMITTED: 'committed',
    UNCOMMITTED: 'uncommitted'
  },

  /**
  * Blobs and container public access types.
  *
  * @const
  * @enum {string}
  */
  BlobContainerPublicAccessType: {
    OFF: null,
    CONTAINER: 'container',
    BLOB: 'blob'
  },

  /**
  * Describes actions that can be performed on a page blob sequence number.
  * @const
  * @enum
  */
  SequenceNumberAction: {
    MAX: 'max',
    UPDATE: 'update',
    INCREMENT: 'increment'
  }
};

module.exports = BlobUtilities;