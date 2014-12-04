﻿// 
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

// Expose 'Constants'.
exports = module.exports;

var storageDnsSuffix = process.env.AZURE_STORAGE_DNS_SUFFIX || 'core.windows.net';

/**
* Defines constants.
*/
var Constants = {
  /*
  * Specifies the value to use for UserAgent header.
  */
  USER_AGENT_PRODUCT_NAME: 'Azure-Storage',

  /*
  * Specifies the value to use for UserAgent header.
  */
  USER_AGENT_PRODUCT_VERSION: '0.4.1',

  /**
  * The number of default concurrent requests for parallel operation.
  *
  * @const
  * @type {string}
  */
  DEFAULT_PARALLEL_OPERATION_THREAD_COUNT: 1,

  /**
  * Constant representing a kilobyte (Non-SI version).
  *
  * @const
  * @type {string}
  */
  KB: 1024,

  /**
  * Constant representing a megabyte (Non-SI version).
  *
  * @const
  * @type {string}
  */
  MB: 1024 * 1024,

  /**
  * Constant representing a gigabyte (Non-SI version).
  *
  * @const
  * @type {string}
  */
  GB: 1024 * 1024 * 1024,

  /**
  * Specifies HTTP.
  *
  * @const
  * @type {string}
  */
  HTTP: 'http:',

  /**
  * Specifies HTTPS.
  *
  * @const
  * @type {string}
  */
  HTTPS: 'https:',

  /**
  * Marker for atom metadata.
  *
  * @const
  * @type {string}
  */
  XML_METADATA_MARKER: '$',

  /**
  * Marker for atom value.
  *
  * @const
  * @type {string}
  */
  XML_VALUE_MARKER: '_',

  /**
  * Specifies the location used to indicate which location the operation can be performed against.
  *
  * @const
  * @enum
  */
  RequestLocationMode: {
    PRIMARY_ONLY: 0,
    SECONDARY_ONLY: 1,
    PRIMARY_OR_SECONDARY: 2,
  },

  /**
  * Represents a storage service location.
  *
  * @const
  * @enum
  */
  StorageLocation: {
    PRIMARY: 0,
    SECONDARY: 1,
  },

  /**
  * Defines constants for use with shared access policies.
  */
  AclConstants: {
    /**
    * XML element for an access policy.
    *
    * @const
    * @type {string}
    */
    ACCESS_POLICY: 'AccessPolicy',

    /**
    * XML element for the end time of an access policy.
    *
    * @const
    * @type {string}
    */
    EXPIRY: 'Expiry',

    /**
    * XML attribute for IDs.
    *
    * @const
    * @type {string}
    */
    ID: 'Id',

    /**
    * XML element for the permission of an access policy.
    *
    * @const
    * @type {string}
    */
    PERMISSION: 'Permission',

    /**
    * XML element for a signed identifier.
    *
    * @const
    * @type {string}
    */
    SIGNED_IDENTIFIER_ELEMENT: 'SignedIdentifier',

    /**
    * XML element for signed identifiers.
    *
    * @const
    * @type {string}
    */
    SIGNED_IDENTIFIERS_ELEMENT: 'SignedIdentifiers',

    /**
    * XML element for the start time of an access policy.
    *
    * @const
    * @type {string}
    */
    START: 'Start'
  },

  /**
  * Defines constants for use with service properties.
  */
  ServicePropertiesConstants: {
    /**
    * XML element for storage service properties.
    *
    * @const
    * @type {string}
    */
    STORAGE_SERVICE_PROPERTIES_ELEMENT: 'StorageServiceProperties',

    /**
    * Default analytics version to send for logging, hour metrics and minute metrics.
    *
    * @const
    * @type {string}
    */
    DEFAULT_ANALYTICS_VERSION: '1.0',

    /**
    * XML element for logging.
    *
    * @const
    * @type {string}
    */
    LOGGING_ELEMENT: 'Logging',

    /**
    * XML element for version.
    *
    * @const
    * @type {string}
    */
    VERSION_ELEMENT: 'Version',

    /**
    * XML element for delete.
    *
    * @const
    * @type {string}
    */
    DELETE_ELEMENT: 'Delete',

    /**
    * XML element for read.
    *
    * @const
    * @type {string}
    */
    READ_ELEMENT: 'Read',

    /**
    * XML element for write.
    *
    * @const
    * @type {string}
    */
    WRITE_ELEMENT: 'Write',

    /**
    * XML element for retention policy.
    *
    * @const
    * @type {string}
    */
    RETENTION_POLICY_ELEMENT: 'RetentionPolicy',

    /**
    * XML element for enabled.
    *
    * @const
    * @type {string}
    */
    ENABLED_ELEMENT: 'Enabled',

    /**
    * XML element for days.
    *
    * @const
    * @type {string}
    */
    DAYS_ELEMENT: 'Days',

    /**
    * XML element for HourMetrics.
    *
    * @const
    * @type {string}
    */
    HOUR_METRICS_ELEMENT: 'HourMetrics',

    /**
    * XML element for MinuteMetrics.
    *
    * @const
    * @type {string}
    */
    MINUTE_METRICS_ELEMENT: 'MinuteMetrics',

    /**
    * XML element for Cors.
    *
    * @const
    * @type {string}
    */
    CORS_ELEMENT: 'Cors',

    /**
    * XML element for CorsRule.
    *
    * @const
    * @type {string}
    */
    CORS_RULE_ELEMENT: 'CorsRule',

    /**
    * XML element for AllowedOrigins.
    *
    * @const
    * @type {string}
    */
    ALLOWED_ORIGINS_ELEMENT: 'AllowedOrigins',

    /**
    * XML element for AllowedMethods.
    *
    * @const
    * @type {string}
    */
    ALLOWED_METHODS_ELEMENT: 'AllowedMethods',

    /**
    * XML element for MaxAgeInSeconds.
    *
    * @const
    * @type {string}
    */
    MAX_AGE_IN_SECONDS_ELEMENT: 'MaxAgeInSeconds',

    /**
    * XML element for ExposedHeaders.
    *
    * @const
    * @type {string}
    */
    EXPOSED_HEADERS_ELEMENT: 'ExposedHeaders',

    /**
    * XML element for AllowedHeaders.
    *
    * @const
    * @type {string}
    */
    ALLOWED_HEADERS_ELEMENT: 'AllowedHeaders',

    /**
    * XML element for IncludeAPIs.
    *
    * @const
    * @type {string}
    */
    INCLUDE_APIS_ELEMENT: 'IncludeAPIs',

    /**
    * XML element for DefaultServiceVersion.
    *
    * @const
    * @type {string}
    */
    DEFAULT_SERVICE_VERSION_ELEMENT: 'DefaultServiceVersion'
  },

  /**
  * Defines constants for use with blob operations.
  */
  BlobConstants: {
    /**
    * XML element for the latest.
    *
    * @const
    * @type {string}
    */
    LATEST_ELEMENT: 'Latest',

    /**
    * XML element for uncommitted blocks.
    *
    * @const
    * @type {string}
    */
    UNCOMMITTED_ELEMENT: 'Uncommitted',

    /**
    * XML element for a block list.
    *
    * @const
    * @type {string}
    */
    BLOCK_LIST_ELEMENT: 'BlockList',

    /**
    * XML element for committed blocks.
    *
    * @const
    * @type {string}
    */
    COMMITTED_ELEMENT: 'Committed',

    /**
    * The default write page size, in bytes, used by blob streams.
    *
    * @const
    * @type {int}
    */
    DEFAULT_WRITE_PAGE_SIZE_IN_BYTES: 4 * 1024 * 1024,
    
    /**
    * The minimum write page size, in bytes, used by blob streams.
    *
    * @const
    * @type {int}
    */
    MIN_WRITE_PAGE_SIZE_IN_BYTES: 2 * 1024 * 1024,

    /**
    * The default maximum size, in bytes, of a blob before it must be separated into blocks.
    *
    * @const
    * @type {int}
    */
    DEFAULT_SINGLE_BLOB_PUT_THRESHOLD_IN_BYTES: 32 * 1024 * 1024,

    /**
    * The default write block size, in bytes, used by blob streams.
    *
    * @const
    * @type {int}
    */
    DEFAULT_WRITE_BLOCK_SIZE_IN_BYTES: 4 * 1024 * 1024,

    /**
    * The maximum size of a single block.
    *
    * @const
    * @type {int}
    */
    MAX_BLOCK_SIZE: 4 * 1024 * 1024,

    /**
    * The maximum size, in bytes, of a blob before it must be separated into blocks.
    *
    * @const
    * @type {int}
    */
    MAX_SINGLE_UPLOAD_BLOB_SIZE_IN_BYTES: 64 * 1024 * 1024,

    /**
    * The maximum range get size when requesting for a contentMD5
    */
    MAX_RANGE_GET_SIZE_WITH_MD5 : 4 * 1024 * 1024,

    /**
    * The maximum page range size for a page update operation.
    */
    MAX_UPDATE_PAGE_SIZE : 4 * 1024 * 1024,
    
    /**
    * The maximum buffer size for writing a stream buffer.
    */
    MAX_QUEUED_WRITE_DISK_BUFFER_SIZE : 64 * 1024 * 1024,
    
    /**
    * Max size for single get page range. The max value should be 150MB
    * http://blogs.msdn.com/b/windowsazurestorage/archive/2012/03/26/getting-the-page-ranges-of-a-large-page-blob-in-segments.aspx
    */
    MAX_SINGLE_GET_PAGE_RANGE_SIZE : 37 * 4 * 1024 * 1024,

    /**
    * The size of a page, in bytes, in a page blob.
    *
    * @const
    * @type {string}
    */
    PAGE_SIZE: 512,

    /**
    * Resource types.
    *
    * @const
    * @enum {string}
    */
    ResourceTypes: {
      CONTAINER: 'c',
      BLOB: 'b'
    },

    /**
    * Put page write options
    *
    * @const
    * @enum {string}
    */
    PageWriteOptions: {
      UPDATE: 'update',
      CLEAR: 'clear'
    },

    /**
    * Blob types
    *
    * @const
    * @enum {string}
    */
    BlobTypes: {
      BLOCK: 'BlockBlob',
      PAGE: 'PageBlob'
    },

    /**
    * Blob lease constants
    *
    * @const
    * @enum {string}
    */
    LeaseOperation: {
      ACQUIRE: 'acquire',
      RENEW: 'renew',
      CHANGE: 'change',
      RELEASE: 'release',
      BREAK: 'break'
    }
  },

  /**
  * Defines constants for use with file operations.
  */
  FileConstants: {
    /**
    * The default write size, in bytes, used by file streams.
    *
    * @const
    * @type {string}
    */
    DEFAULT_WRITE_SIZE_IN_BYTES: 4 * 1024 * 1024,

    /**
    * The maximum range size when requesting for a contentMD5.
    */
    MAX_RANGE_GET_SIZE_WITH_MD5 : 4 * 1024 * 1024,

    /**
    * The maximum range size for a file update operation.
    */
    MAX_UPDATE_FILE_SIZE : 4 * 1024 * 1024,

    /**
    * The default minimum size, in bytes, of a file when it must be separated into ranges.
    *
    * @const
    * @type {int}
    */
    DEFAULT_SINGLE_FILE_GET_THRESHOLD_IN_BYTES: 32 * 1024 * 1024,

    /**
    * The minimum write file size, in bytes, used by file streams.
    *
    * @const
    * @type {int}
    */
    MIN_WRITE_FILE_SIZE_IN_BYTES: 2 * 1024 * 1024,

    /**
    * Put range write options
    *
    * @const
    * @enum {string}
    */
    RangeWriteOptions: {
      UPDATE: 'update',
      CLEAR: 'clear'
    }
  },

  /**
  * Defines constants for use with queue storage.
  *
  * @const
  * @type {string}
  */
  QueueConstants: {
    /**
    * XML element for QueueMessage.
    *
    * @const
    * @type {string}
    */
    QUEUE_MESSAGE_ELEMENT: 'QueueMessage',

    /**
    * XML element for MessageText.
    *
    * @const
    * @type {string}
    */
    MESSAGE_TEXT_ELEMENT: 'MessageText'
  },

  /**
  * Defines constants for use with table storage.
  *
  * @const
  * @type {string}
  */
  TableConstants: {
    /**
    * The changeset response delimiter.
    *
    * @const
    * @type {string}
    */
    CHANGESET_DELIMITER: '--changesetresponse_',

    /**
    * The batch response delimiter.
    *
    * @const
    * @type {string}
    */
    BATCH_DELIMITER: '--batchresponse_',

    /**
    * The next continuation row key token.
    *
    * @const
    * @type {string}
    */
    CONTINUATION_NEXT_ROW_KEY: 'x-ms-continuation-nextrowkey',

    /**
    * The next continuation partition key token.
    *
    * @const
    * @type {string}
    */
    CONTINUATION_NEXT_PARTITION_KEY: 'x-ms-continuation-nextpartitionkey',

    /**
    * The next continuation table name token.
    *
    * @const
    * @type {string}
    */
    CONTINUATION_NEXT_TABLE_NAME: 'x-ms-continuation-nexttablename',

    /**
    * The next row key query string argument.
    *
    * @const
    * @type {string}
    */
    NEXT_ROW_KEY: 'NextRowKey',

        /**
    * The next partition key query string argument.
    *
    * @const
    * @type {string}
    */
    NEXT_PARTITION_KEY: 'NextPartitionKey',

    /**
    * The next table name query string argument.
    *
    * @const
    * @type {string}
    */
    NEXT_TABLE_NAME: 'NextTableName',

    /** 
    * Prefix of the odata properties returned in a JSON query
    */
    ODATA_PREFIX: 'odata.',

    /**
    * Constant representing the string following a type annotation in a JSON table query
    */
    ODATA_TYPE_SUFFIX: '@odata.type',

    /**
    * Constant representing the property where the odata metadata elements are stored.
    *
    * @const
    * @type {string}
    */
    ODATA_METADATA_MARKER: '.metadata',

    /**
    * Constant representing the value for an entity property.
    */
    ODATA_VALUE_MARKER: '_',

    /** 
    * Constant representing the type for an entity property.
    */
    ODATA_TYPE_MARKER: '$',

    /**
    * The value to set the maximum data service version header.
    * @const
    * @type {string}
    */
    DEFAULT_DATA_SERVICE_VERSION: '3.0;NetFx',

    /**
    * The name of the property that stores the table name.
    *
    * @const
    * @type {string}
    */
    TABLE_NAME: 'TableName',

    /**
    * The name of the special table used to store tables.
    *
    * @const
    * @type {string}
    */
    TABLE_SERVICE_TABLE_NAME: 'Tables',

    /**
    * Operations
    *
    * @const
    * @enum {string}
    */
    Operations: {
      RETRIEVE: 'RETRIEVE',
      INSERT: 'INSERT',
      UPDATE: 'UPDATE',
      MERGE: 'MERGE',
      DELETE: 'DELETE',
      INSERT_OR_REPLACE: 'INSERT_OR_REPLACE',
      INSERT_OR_MERGE: 'INSERT_OR_MERGE'
    }
  },

  /**
  * Defines constants for use with HTTP headers.
  */
  HeaderConstants: {
    /**
    * The accept ranges header.
    *
    * @const
    * @type {string}
    */
    ACCEPT_RANGES: 'accept_ranges',

    /**
    * The content transfer encoding header.
    *
    * @const
    * @type {string}
    */
    CONTENT_TRANSFER_ENCODING_HEADER: 'content-transfer-encoding',

    /**
    * The transfer encoding header.
    *
    * @const
    * @type {string}
    */
    TRANSFER_ENCODING_HEADER: 'transfer-encoding',

    /**
    * The server header.
    *
    * @const
    * @type {string}
    */
    SERVER_HEADER: 'server',

    /**
    * The location header.
    *
    * @const
    * @type {string}
    */
    LOCATION_HEADER: 'location',

    /**
    * The Last-Modified header
    *
    * @const
    * @type {string}
    */
    LAST_MODIFIED: 'Last-Modified',

    /**
    * The data service version.
    *
    * @const
    * @type {string}
    */
    DATA_SERVICE_VERSION: 'dataserviceversion',

    /**
    * The maximum data service version.
    *
    * @const
    * @type {string}
    */
    MAX_DATA_SERVICE_VERSION: 'maxdataserviceversion',

    /**
    * The master Windows Azure Storage header prefix.
    *
    * @const
    * @type {string}
    */
    PREFIX_FOR_STORAGE_HEADER: 'x-ms-',

    /**
    * The client request Id header.
    *
    * @const
    * @type {string}
    */
    CLIENT_REQUEST_ID_HEADER: 'x-ms-client-request-id',

    /**
    * The header that specifies the approximate message count of a queue.
    *
    * @const
    * @type {string}
    */
    APPROXIMATE_MESSAGES_COUNT: 'x-ms-approximate-messages-count',

    /**
    * The Authorization header.
    *
    * @const
    * @type {string}
    */
    AUTHORIZATION: 'authorization',

    /**
    * The header that specifies public access to blobs.
    *
    * @const
    * @type {string}
    */
    BLOB_PUBLIC_ACCESS_HEADER: 'x-ms-blob-public-access',

    /**
    * The header for the blob type.
    *
    * @const
    * @type {string}
    */
    BLOB_TYPE_HEADER: 'x-ms-blob-type',

    /**
    * The header for the type.
    *
    * @const
    * @type {string}
    */
    TYPE_HEADER: 'x-ms-type',

    /**
    * Specifies the block blob type.
    *
    * @const
    * @type {string}
    */
    BLOCK_BLOB: 'blockblob',

    /**
    * The CacheControl header.
    *
    * @const
    * @type {string}
    */
    CACHE_CONTROL: 'cache-control',

    /**
    * The header that specifies blob caching control.
    *
    * @const
    * @type {string}
    */
    BLOB_CACHE_CONTROL_HEADER: 'x-ms-blob-cache-control',

    /**
    * The header that specifies caching control.
    *
    * @const
    * @type {string}
    */
    CACHE_CONTROL_HEADER: 'x-ms-cache-control',

    /**
    * The copy status.
    *
    * @const
    * @type {string}
    */
    COPY_STATUS: 'x-ms-copy-status',

    /**
    * The copy completion time
    *
    * @const
    * @type {string}
    */
    COPY_COMPLETION_TIME: 'x-ms-copy-completion-time',

    /**
    * The copy status message
    *
    * @const
    * @type {string}
    */
    COPY_STATUS_DESCRIPTION: 'x-ms-copy-status-description',

    /**
    * The copy identifier.
    *
    * @const
    * @type {string}
    */
    COPY_ID: 'x-ms-copy-id',

    /**
    * Progress of any copy operation
    *
    * @const
    * @type {string}
    */
    COPY_PROGRESS: 'x-ms-copy-progress',

    /**
    * The copy action.
    *
    * @const
    * @type {string}
    */
    COPY_ACTION: 'x-ms-copy-action',

    /**
    * The ContentID header.
    *
    * @const
    * @type {string}
    */
    CONTENT_ID: 'content-id',

    /**
    * The ContentEncoding header.
    *
    * @const
    * @type {string}
    */
    CONTENT_ENCODING: 'content-encoding',

    /**
    * The header that specifies blob content encoding.
    *
    * @const
    * @type {string}
    */
    BLOB_CONTENT_ENCODING_HEADER: 'x-ms-blob-content-encoding',

    /**
    * The header that specifies content encoding.
    *
    * @const
    * @type {string}
    */
    CONTENT_ENCODING_HEADER: 'x-ms-content-encoding',

    /**
    * The ContentLangauge header.
    *
    * @const
    * @type {string}
    */
    CONTENT_LANGUAGE: 'content-language',

    /**
    * The header that specifies blob content language.
    *
    * @const
    * @type {string}
    */
    BLOB_CONTENT_LANGUAGE_HEADER: 'x-ms-blob-content-language',

    /**
    * The header that specifies content language.
    *
    * @const
    * @type {string}
    */
    CONTENT_LANGUAGE_HEADER: 'x-ms-content-language',

    /**
    * The ContentLength header.
    *
    * @const
    * @type {string}
    */
    CONTENT_LENGTH: 'content-length',

    /**
    * The header that specifies blob content length.
    *
    * @const
    * @type {string}
    */
    BLOB_CONTENT_LENGTH_HEADER: 'x-ms-blob-content-length',

    /**
    * The header that specifies content length.
    *
    * @const
    * @type {string}
    */
    CONTENT_LENGTH_HEADER: 'x-ms-content-length',

    /**
    * The ContentDisposition header.
    * @const
    * @type {string}
    */
    CONTENT_DISPOSITION: 'content-disposition',

    /**
    * The header that specifies blob content disposition.
    *
    * @const
    * @type {string}
    */
    BLOB_CONTENT_DISPOSITION_HEADER: 'x-ms-blob-content-disposition',

    /**
    * The header that specifies content disposition.
    *
    * @const
    * @type {string}
    */
    CONTENT_DISPOSITION_HEADER: 'x-ms-content-disposition',

    /**
    * The ContentMD5 header.
    *
    * @const
    * @type {string}
    */
    CONTENT_MD5: 'content-md5',

    /**
    * The header that specifies blob content MD5.
    *
    * @const
    * @type {string}
    */
    BLOB_CONTENT_MD5_HEADER: 'x-ms-blob-content-md5',

    /**
    * The header that specifies content MD5.
    *
    * @const
    * @type {string}
    */
    CONTENT_MD5_HEADER: 'x-ms-content-md5',


    /**
    * The ContentRange header.
    *
    * @const
    * @type {string}
    */
    CONTENT_RANGE: 'cache-range',

    /**
    * The ContentType header.
    *
    * @const
    * @type {string}
    */
    CONTENT_TYPE: 'content-type',

    /**
    * The header that specifies blob content type.
    *
    * @const
    * @type {string}
    */
    BLOB_CONTENT_TYPE_HEADER: 'x-ms-blob-content-type',

    /**
    * The header that specifies content type.
    *
    * @const
    * @type {string}
    */
    CONTENT_TYPE_HEADER: 'x-ms-content-type',

    /**
    * The header for copy source.
    *
    * @const
    * @type {string}
    */
    COPY_SOURCE_HEADER: 'x-ms-copy-source',

    /**
    * The header that specifies the date.
    *
    * @const
    * @type {string}
    */
    DATE: 'date',

    /**
    * The header that specifies the date.
    *
    * @const
    * @type {string}
    */
    DATE_HEADER: 'x-ms-date',

    /**
    * The header to delete snapshots.
    *
    * @const
    * @type {string}
    */
    DELETE_SNAPSHOT_HEADER: 'x-ms-delete-snapshots',

    /**
    * The ETag header.
    *
    * @const
    * @type {string}
    */
    ETAG: 'etag',

    /**
    * The IfMatch header.
    *
    * @const
    * @type {string}
    */
    IF_MATCH: 'if-match',

    /**
    * The IfModifiedSince header.
    *
    * @const
    * @type {string}
    */
    IF_MODIFIED_SINCE: 'if-modified-since',

    /**
    * The IfNoneMatch header.
    *
    * @const
    * @type {string}
    */
    IF_NONE_MATCH: 'if-none-match',

    /**
    * The IfUnmodifiedSince header.
    *
    * @const
    * @type {string}
    */
    IF_UNMODIFIED_SINCE: 'if-unmodified-since',

    /**
    * Specifies snapshots are to be included.
    *
    * @const
    * @type {string}
    */
    INCLUDE_SNAPSHOTS_VALUE: 'include',

    /**
    * Specifies that the content-type is JSON.
    *
    * @const
    * @type {string}
    */
    JSON_CONTENT_TYPE_VALUE: 'application/json;',


    /**
    * The header that specifies lease ID.
    *
    * @const
    * @type {string}
    */
    LEASE_ID_HEADER: 'x-ms-lease-id',

    /**
    * The header that specifies the lease break period.
    *
    * @const
    * @type {string}
    */
    LEASE_BREAK_PERIOD: 'x-ms-lease-break-period',

    /**
    * The header that specifies the proposed lease identifier.
    *
    * @const
    * @type {string}
    */
    PROPOSED_LEASE_ID: 'x-ms-proposed-lease-id',

    /**
    * The header that specifies the lease duration.
    *
    * @const
    * @type {string}
    */
    LEASE_DURATION: 'x-ms-lease-duration',

    /**
    * The header that specifies the source lease ID.
    *
    * @const
    * @type {string}
    */
    SOURCE_LEASE_ID_HEADER: 'x-ms-source-lease-id',

    /**
    * The header that specifies lease time.
    *
    * @const
    * @type {string}
    */
    LEASE_TIME_HEADER: 'x-ms-lease-time',

    /**
    * The header that specifies lease status.
    *
    * @const
    * @type {string}
    */
    LEASE_STATUS: 'x-ms-lease-status',

    /**
    * The header that specifies lease state.
    *
    * @const
    * @type {string}
    */
    LEASE_STATE: 'x-ms-lease-state',

    /**
    * Specifies the page blob type.
    *
    * @const
    * @type {string}
    */
    PAGE_BLOB: 'PageBlob',

    /**
    * The header that specifies page write mode.
    *
    * @const
    * @type {string}
    */
    PAGE_WRITE: 'x-ms-page-write',

    /**
    * The header that specifies file range write mode.
    *
    * @const
    * @type {string}
    */
    FILE_WRITE: 'x-ms-write',

    /**
    * The header that specifies whether the response should include the inserted entity.
    *
    * @const
    * @type {string}
    */
    PREFER: 'Prefer',

    /**
    * The header value which specifies that the response should include the inserted entity.
    *
    * @const
    * @type {string}
    */
    PREFER_CONTENT: 'return-content',

    /**
    * The header value which specifies that the response should not include the inserted entity.
    *
    * @const
    * @type {string}
    */
    PREFER_NO_CONTENT: 'return-no-content',

    /**
    * The header prefix for metadata.
    *
    * @const
    * @type {string}
    */
    PREFIX_FOR_STORAGE_METADATA: 'x-ms-meta-',

    /**
    * The header prefix for properties.
    *
    * @const
    * @type {string}
    */
    PREFIX_FOR_STORAGE_PROPERTIES: 'x-ms-prop-',

    /**
    * The Range header.
    *
    * @const
    * @type {string}
    */
    RANGE: 'Range',

    /**
    * The header that specifies if the request will populate the ContentMD5 header for range gets.
    *
    * @const
    * @type {string}
    */
    RANGE_GET_CONTENT_MD5: 'x-ms-range-get-content-md5',

    /**
    * The format string for specifying ranges.
    *
    * @const
    * @type {string}
    */
    RANGE_HEADER_FORMAT: 'bytes:%d-%d',

    /**
    * The header that indicates the request ID.
    *
    * @const
    * @type {string}
    */
    REQUEST_ID_HEADER: 'x-ms-request-id',

    /**
    * The header for specifying the sequence number.
    *
    * @const
    * @type {string}
    */
    SEQUENCE_NUMBER: 'x-ms-blob-sequence-number',

    /**
    * The header for specifying the If-Sequence-Number-EQ condition.
    *
    * @const
    * @type {string}
    */
    SEQUENCE_NUMBER_EQUAL: 'x-ms-if-sequence-number-eq',

    /**
    * The header for specifying the If-Sequence-Number-LT condition.
    *
    * @const
    * @type {string}
    */
    SEQUENCE_NUMBER_LESS_THAN: 'x-ms-if-sequence-number-lt',

    /**
    * The header for specifying the If-Sequence-Number-LE condition.
    *
    * @const
    * @type {string}
    */
    SEQUENCE_NUMBER_LESS_THAN_OR_EQUAL: 'x-ms-if-sequence-number-le',

    /**
    * The header that specifies sequence number action.
    *
    * @const
    * @type {string}
    */
    SEQUENCE_NUMBER_ACTION: 'x-ms-sequence-number-action',

    /**
    * The header for the blob content length.
    *
    * @const
    * @type {string}
    */
    SIZE: 'x-ms-blob-content-length',

    /**
    * The header for snapshots.
    *
    * @const
    * @type {string}
    */
    SNAPSHOT_HEADER: 'x-ms-snapshot',

    /**
    * Specifies only snapshots are to be included.
    *
    * @const
    * @type {string}
    */
    SNAPSHOTS_ONLY_VALUE: 'only',

    /**
    * The header for the If-Match condition.
    *
    * @const
    * @type {string}
    */
    SOURCE_IF_MATCH_HEADER: 'x-ms-source-if-match',

    /**
    * The header for the If-Modified-Since condition.
    *
    * @const
    * @type {string}
    */
    SOURCE_IF_MODIFIED_SINCE_HEADER: 'x-ms-source-if-modified-since',

    /**
    * The header for the If-None-Match condition.
    *
    * @const
    * @type {string}
    */
    SOURCE_IF_NONE_MATCH_HEADER: 'x-ms-source-if-none-match',

    /**
    * The header for the If-Unmodified-Since condition.
    *
    * @const
    * @type {string}
    */
    SOURCE_IF_UNMODIFIED_SINCE_HEADER: 'x-ms-source-if-unmodified-since',

    /**
    * The header for data ranges.
    *
    * @const
    * @type {string}
    */
    STORAGE_RANGE_HEADER: 'x-ms-range',

    /**
    * The header for storage version.
    *
    * @const
    * @type {string}
    */
    STORAGE_VERSION_HEADER: 'x-ms-version',

    /**
    * The current storage version header value.
    *
    * @const
    * @type {string}
    */
    TARGET_STORAGE_VERSION: '2014-02-14',

    /**
    * The UserAgent header.
    *
    * @const
    * @type {string}
    */
    USER_AGENT: 'user-agent',

    /**
    * The pop receipt header.
    *
    * @const
    * @type {string}
    */
    POP_RECEIPT_HEADER: 'x-ms-popreceipt',

    /**
    * The time next visibile header.
    *
    * @const
    * @type {string}
    */
    TIME_NEXT_VISIBLE_HEADER: 'x-ms-time-next-visible',

    /**
    * The approximate message counter header.
    *
    * @const
    * @type {string}
    */
    APPROXIMATE_MESSAGE_COUNT_HEADER: 'x-ms-approximate-message-count',

    /**
    * The lease action header.
    *
    * @const
    * @type {string}
    */
    LEASE_ACTION_HEADER: 'x-ms-lease-action',

    /**
    * The accept header.
    *
    * @const
    * @type {string}
    */
    ACCEPT_HEADER: 'accept',

    /**
    * The accept charset header.
    *
    * @const
    * @type {string}
    */
    ACCEPT_CHARSET_HEADER: 'Accept-Charset',

    /**
    * The host header.
    *
    * @const
    * @type {string}
    */
    HOST_HEADER: 'host',

    /**
    * The correlation identifier header.
    *
    * @const
    * @type {string}
    */
    CORRELATION_ID_HEADER: 'x-ms-correlation-id',

    /**
    * The group identifier header.
    *
    * @const
    * @type {string}
    */
    GROUP_ID_HEADER: 'x-ms-group-id',
  },

  QueryStringConstants: {

    /**
    * Query component for SAS API version.
    * @const
    * @type {string}
    */
    API_VERSION: 'api-version',

    /**
    * The Comp value.
    *
    * @const
    * @type {string}
    */
    COMP: 'comp',

    /**
    * The Res Type.
    *
    * @const
    * @type {string}
    */
    RESTYPE: 'restype',

    /**
    * The copy Id.
    * @const
    * @type {string}
    */
    COPY_ID: 'copyid',

    /**
    * The Snapshot value.
    *
    * @const
    * @type {string}
    */
    SNAPSHOT: 'snapshot',

    /**
    * The timeout value.
    *
    * @const
    * @type {string}
    */
    TIMEOUT: 'timeout',

    /**
    * The signed start time query string argument for shared access signature.
    *
    * @const
    * @type {string}
    */
    SIGNED_START: 'st',

    /**
    * The signed expiry time query string argument for shared access signature.
    *
    * @const
    * @type {string}
    */
    SIGNED_EXPIRY: 'se',

    /**
    * The signed resource query string argument for shared access signature.
    *
    * @const
    * @type {string}
    */
    SIGNED_RESOURCE: 'sr',

    /**
    * The signed permissions query string argument for shared access signature.
    *
    * @const
    * @type {string}
    */
    SIGNED_PERMISSIONS: 'sp',

    /**
    * The signed identifier query string argument for shared access signature.
    *
    * @const
    * @type {string}
    */
    SIGNED_IDENTIFIER: 'si',

    /**
    * The signature query string argument for shared access signature.
    *
    * @const
    * @type {string}
    */
    SIGNATURE: 'sig',

    /**
    * The signed version argument for shared access signature.
    *
    * @const
    * @type {string}
    */
    SIGNED_VERSION: 'sv',

    /**
    * The cache control argument for shared access signature.
    *
    * @const
    * @type {string}
    */
    CACHE_CONTROL: 'rscc',

    /**
    * The content type argument for shared access signature.
    *
    * @const
    * @type {string}
    */
    CONTENT_TYPE: 'rsct',

    /**
    * The content encoding argument for shared access signature.
    *
    * @const
    * @type {string}
    */
    CONTENT_ENCODING: 'rsce',

    /**
    * The content language argument for shared access signature.
    *
    * @const
    * @type {string}
    */
    CONTENT_LANGUAGE: 'rscl',

    /**
    * The content disposition argument for shared access signature.
    *
    * @const
    * @type {string}
    */
    CONTENT_DISPOSITION: 'rscd',

    /**
    * The block identifier query string argument for blob service.
    *
    * @const
    * @type {string}
    */
    BLOCK_ID: 'blockid',

    /**
    * The block list type query string argument for blob service.
    *
    * @const
    * @type {string}
    */
    BLOCK_LIST_TYPE: 'blocklisttype',

    /**
    * The prefix query string argument for listing operations.
    *
    * @const
    * @type {string}
    */
    PREFIX: 'prefix',

    /**
    * The marker query string argument for listing operations.
    *
    * @const
    * @type {string}
    */
    MARKER: 'marker',

    /**
    * The maxresults query string argument for listing operations.
    *
    * @const
    * @type {string}
    */
    MAX_RESULTS: 'maxresults',

    /**
    * The delimiter query string argument for listing operations.
    *
    * @const
    * @type {string}
    */
    DELIMITER: 'delimiter',

    /**
    * The include query string argument for listing operations.
    *
    * @const
    * @type {string}
    */
    INCLUDE: 'include',

    /**
    * The peekonly query string argument for queue service.
    *
    * @const
    * @type {string}
    */
    PEEK_ONLY: 'peekonly',

    /**
    * The numofmessages query string argument for queue service.
    *
    * @const
    * @type {string}
    */
    NUM_OF_MESSAGES: 'numofmessages',

    /**
    * The popreceipt query string argument for queue service.
    *
    * @const
    * @type {string}
    */
    POP_RECEIPT: 'popreceipt',

    /**
    * The visibilitytimeout query string argument for queue service.
    *
    * @const
    * @type {string}
    */
    VISIBILITY_TIMEOUT: 'visibilitytimeout',

    /**
    * The messagettl query string argument for queue service.
    *
    * @const
    * @type {string}
    */
    MESSAGE_TTL: 'messagettl',

    /**
    * The select query string argument.
    *
    * @const
    * @type {string}
    */
    SELECT: '$select',

    /**
    * The filter query string argument.
    *
    * @const
    * @type {string}
    */
    FILTER: '$filter',

    /**
    * The top query string argument.
    *
    * @const
    * @type {string}
    */
    TOP: '$top',

    /**
    * The skip query string argument.
    *
    * @const
    * @type {string}
    */
    SKIP: '$skip',

    /**
    * The next partition key query string argument for table service.
    *
    * @const
    * @type {string}
    */
    NEXT_PARTITION_KEY: 'NextPartitionKey',

    /**
    * The next row key query string argument for table service.
    *
    * @const
    * @type {string}
    */
    NEXT_ROW_KEY: 'NextRowKey',

    /**
    * The lock identifier for service bus messages.
    *
    * @const
    * @type {string}
    */
    LOCK_ID: 'lockid',

    /**
    * The table name for table SAS URI's.
    *
    * @const
    * @type {string}
    */
    TABLENAME: 'tn',

    /**
    * The starting Partition Key for tableSAS URI's.
    *
    * @const
    * @type {string}
    */
    STARTPK: 'spk',

    /**
    * The starting Partition Key for tableSAS URI's.
    *
    * @const
    * @type {string}
    */
    STARTRK: 'srk',

    /**
    * The ending Partition Key for tableSAS URI's.
    *
    * @const
    * @type {string}
    */
    ENDPK: 'epk',

    /**
    * The ending Partition Key for tableSAS URI's.
    *
    * @const
    * @type {string}
    */
    ENDRK: 'erk'
  },

  StorageServiceClientConstants: {
    /**
    * The default protocol.
    */
    DEFAULT_PROTOCOL: 'https:',

    /*
    * Used environment variables.
    * @enum {string}
    */
    EnvironmentVariables: {
      AZURE_STORAGE_ACCOUNT: 'AZURE_STORAGE_ACCOUNT',
      AZURE_STORAGE_ACCESS_KEY: 'AZURE_STORAGE_ACCESS_KEY',
      AZURE_STORAGE_DNS_SUFFIX: 'AZURE_STORAGE_DNS_SUFFIX',
      AZURE_STORAGE_CONNECTION_STRING: 'AZURE_STORAGE_CONNECTION_STRING',
      HTTP_PROXY: 'HTTP_PROXY',
      HTTPS_PROXY: 'HTTPS_PROXY',
      EMULATED: 'EMULATED',
    },

    /**
    * Default credentials.
    */
    DEVSTORE_STORAGE_ACCOUNT: 'devstoreaccount1',
    DEVSTORE_STORAGE_ACCESS_KEY: 'Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==',

    /**
    * The development store URI.
    *
    * @const
    * @type {string}
    */
    DEV_STORE_URI: 'http://127.0.0.1',

    /**
    * Development ServiceClient URLs.
    */
    DEVSTORE_DEFAULT_PROTOCOL: 'http://',
    DEVSTORE_BLOB_HOST: '127.0.0.1:10000',
    DEVSTORE_QUEUE_HOST: '127.0.0.1:10001',
    DEVSTORE_TABLE_HOST: '127.0.0.1:10002',

    /**
    * Production ServiceClient URLs.
    */
    CLOUD_BLOB_HOST: 'blob.' + storageDnsSuffix,
    CLOUD_QUEUE_HOST: 'queue.' + storageDnsSuffix,
    CLOUD_TABLE_HOST: 'table.' + storageDnsSuffix,
    CLOUD_FILE_HOST: 'file.' + storageDnsSuffix
  },

  HttpConstants: {
    /**
    * Http Verbs
    *
    * @const
    * @enum {string}
    */
    HttpVerbs: {
      PUT: 'PUT',
      GET: 'GET',
      DELETE: 'DELETE',
      POST: 'POST',
      MERGE: 'MERGE',
      HEAD: 'HEAD'
    },

    /**
    * Response codes.
    *
    * @const
    * @enum {int}
    */
    HttpResponseCodes: {
      Ok: 200,
      Created: 201,
      Accepted: 202,
      NoContent: 204,
      PartialContent: 206,
      BadRequest: 400,
      Unauthorized: 401,
      Forbidden: 403,
      NotFound: 404,
      Conflict: 409,
      LengthRequired: 411,
      PreconditionFailed: 412
    }
  },

  VersionConstants: {
    /**
    * Constant for the 2013-08-15 version.
    *
    * @const
    * @type {string}
    */
    AUGUST_2013: '2013-08-15',

    /**
    * Constant for the 2012-02-12 version.
    *
    * @const
    * @type {string}
    */
    FEBRUARY_2012: '2012-02-12'
  },

  BlobErrorCodeStrings: {
    INVALID_BLOCK_ID: 'InvalidBlockId',
    BLOB_NOT_FOUND: 'BlobNotFound',
    BLOB_ALREADY_EXISTS: 'BlobAlreadyExists',
    CONTAINER_ALREADY_EXISTS: 'ContainerAlreadyExists',
    CONTAINER_NOT_FOUND: 'ContainerNotFound',
    INVALID_BLOB_OR_BLOCK: 'InvalidBlobOrBlock',
    INVALID_BLOCK_LIST: 'InvalidBlockList'
  },

  FileErrorCodeStrings: {
    SHARE_ALREADY_EXISTS: 'ShareAlreadyExists',
    SHARE_NOT_FOUND: 'ShareNotFound'
  },

  QueueErrorCodeStrings: {
    QUEUE_NOT_FOUND: 'QueueNotFound',
    QUEUE_DISABLED: 'QueueDisabled',
    QUEUE_ALREADY_EXISTS: 'QueueAlreadyExists',
    QUEUE_NOT_EMPTY: 'QueueNotEmpty',
    QUEUE_BEING_DELETED: 'QueueBeingDeleted',
    POP_RECEIPT_MISMATCH: 'PopReceiptMismatch',
    INVALID_PARAMETER: 'InvalidParameter',
    MESSAGE_NOT_FOUND: 'MessageNotFound',
    MESSAGE_TOO_LARGE: 'MessageTooLarge',
    INVALID_MARKER: 'InvalidMarker'
  },

  StorageErrorCodeStrings: {
    UNSUPPORTED_HTTP_VERB: 'UnsupportedHttpVerb',
    MISSING_CONTENT_LENGTH_HEADER: 'MissingContentLengthHeader',
    MISSING_REQUIRED_HEADER: 'MissingRequiredHeader',
    MISSING_REQUIRED_XML_NODE: 'MissingRequiredXmlNode',
    UNSUPPORTED_HEADER: 'UnsupportedHeader',
    UNSUPPORTED_XML_NODE: 'UnsupportedXmlNode',
    INVALID_HEADER_VALUE: 'InvalidHeaderValue',
    INVALID_XML_NODE_VALUE: 'InvalidXmlNodeValue',
    MISSING_REQUIRED_QUERY_PARAMETER: 'MissingRequiredQueryParameter',
    UNSUPPORTED_QUERY_PARAMETER: 'UnsupportedQueryParameter',
    INVALID_QUERY_PARAMETER_VALUE: 'InvalidQueryParameterValue',
    OUT_OF_RANGE_QUERY_PARAMETER_VALUE: 'OutOfRangeQueryParameterValue',
    INVALID_URI: 'InvalidUri',
    INVALID_HTTP_VERB: 'InvalidHttpVerb',
    EMPTY_METADATA_KEY: 'EmptyMetadataKey',
    REQUEST_BODY_TOO_LARGE: 'RequestBodyTooLarge',
    INVALID_XML_DOCUMENT: 'InvalidXmlDocument',
    INTERNAL_ERROR: 'InternalError',
    AUTHENTICATION_FAILED: 'AuthenticationFailed',
    MD5_MISMATCH: 'Md5Mismatch',
    INVALID_MD5: 'InvalidMd5',
    OUT_OF_RANGE_INPUT: 'OutOfRangeInput',
    INVALID_INPUT: 'InvalidInput',
    OPERATION_TIMED_OUT: 'OperationTimedOut',
    RESOURCE_NOT_FOUND: 'ResourceNotFound',
    RESOURCE_ALREADY_EXISTS: 'ResourceAlreadyExists',
    INVALID_METADATA: 'InvalidMetadata',
    METADATA_TOO_LARGE: 'MetadataTooLarge',
    CONDITION_NOT_MET: 'ConditionNotMet',
    UPDATE_CONDITION_NOT_SATISFIED: 'UpdateConditionNotSatisfied',
    INVALID_RANGE: 'InvalidRange',
    CONTAINER_NOT_FOUND: 'ContainerNotFound',
    CONTAINER_ALREADY_EXISTS: 'ContainerAlreadyExists',
    CONTAINER_DISABLED: 'ContainerDisabled',
    CONTAINER_BEING_DELETED: 'ContainerBeingDeleted',
    SERVER_BUSY: 'ServerBusy'
  },

  TableErrorCodeStrings: {
    XMETHOD_NOT_USING_POST: 'XMethodNotUsingPost',
    XMETHOD_INCORRECT_VALUE: 'XMethodIncorrectValue',
    XMETHOD_INCORRECT_COUNT: 'XMethodIncorrectCount',
    TABLE_HAS_NO_PROPERTIES: 'TableHasNoProperties',
    DUPLICATE_PROPERTIES_SPECIFIED: 'DuplicatePropertiesSpecified',
    TABLE_HAS_NO_SUCH_PROPERTY: 'TableHasNoSuchProperty',
    DUPLICATE_KEY_PROPERTY_SPECIFIED: 'DuplicateKeyPropertySpecified',
    TABLE_ALREADY_EXISTS: 'TableAlreadyExists',
    TABLE_NOT_FOUND: 'TableNotFound',
    ENTITY_NOT_FOUND: 'EntityNotFound',
    ENTITY_ALREADY_EXISTS: 'EntityAlreadyExists',
    PARTITION_KEY_NOT_SPECIFIED: 'PartitionKeyNotSpecified',
    OPERATOR_INVALID: 'OperatorInvalid',
    UPDATE_CONDITION_NOT_SATISFIED: 'UpdateConditionNotSatisfied',
    PROPERTIES_NEED_VALUE: 'PropertiesNeedValue',
    PARTITION_KEY_PROPERTY_CANNOT_BE_UPDATED: 'PartitionKeyPropertyCannotBeUpdated',
    TOO_MANY_PROPERTIES: 'TooManyProperties',
    ENTITY_TOO_LARGE: 'EntityTooLarge',
    PROPERTY_VALUE_TOO_LARGE: 'PropertyValueTooLarge',
    INVALID_VALUE_TYPE: 'InvalidValueType',
    TABLE_BEING_DELETED: 'TableBeingDeleted',
    TABLE_SERVER_OUT_OF_MEMORY: 'TableServerOutOfMemory',
    PRIMARY_KEY_PROPERTY_IS_INVALID_TYPE: 'PrimaryKeyPropertyIsInvalidType',
    PROPERTY_NAME_TOO_LONG: 'PropertyNameTooLong',
    PROPERTY_NAME_INVALID: 'PropertyNameInvalid',
    BATCH_OPERATION_NOT_SUPPORTED: 'BatchOperationNotSupported',
    JSON_FORMAT_NOT_SUPPORTED: 'JsonFormatNotSupported',
    METHOD_NOT_ALLOWED: 'MethodNotAllowed',
    NOT_IMPLEMENTED: 'NotImplemented'
  },

  ConnectionStringKeys: {
    USE_DEVELOPMENT_STORAGE_NAME: 'UseDevelopmentStorage',
    DEVELOPMENT_STORAGE_PROXY_URI_NAME: 'DevelopmentStorageProxyUri',
    DEFAULT_ENDPOINTS_PROTOCOL_NAME: 'DefaultEndpointsProtocol',
    ACCOUNT_NAME_NAME: 'AccountName',
    ACCOUNT_KEY_NAME: 'AccountKey',
    BLOB_ENDPOINT_NAME: 'BlobEndpoint',
    FILE_ENDPOINT_NAME: 'FileEndpoint',
    QUEUE_ENDPOINT_NAME: 'QueueEndpoint',
    TABLE_ENDPOINT_NAME: 'TableEndpoint',
    SHARED_ACCESS_SIGNATURE_NAME: 'SharedAccessSignature',
    BLOB_BASE_DNS_NAME: 'blob.core.windows.net',
    FILE_BASE_DNS_NAME: 'file.core.windows.net',
    QUEUE_BASE_DNS_NAME: 'queue.core.windows.net',
    TABLE_BASE_DNS_NAME: 'table.core.windows.net'
  }
};

module.exports = Constants;
