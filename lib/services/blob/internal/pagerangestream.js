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


var Constants = require('./../../../common/util/constants');
var EventEmitter = require('events').EventEmitter;

/**
* PageBlob page range stream
*/
function PageRangeStream(blobServiceClient, container, blob, options) {
  this.blobServiceClient = blobServiceClient;
  this.container = container;
  this.blob = blob;
  this.rangeSize = -1;
  this._emitter = new EventEmitter();
  this._paused = false;
  this._emittedAll = false;
  this._emittedRangeIndex = 0;
  this._rangelist = [];
  this._isEmitting = false;
  this._rangeStreamEnded = false;
  if (options.rangeStart) {
    this._startOffset = options.rangeStart;
  } else {
    this._startOffset = 0;
  }
  this._dataOffset = this._startOffset;
  if (options.rangeEnd) {
    this._endOffset = options.rangeEnd;
  } else {
    this._endOffset = Number.MAX_VALUE;
  }
}

/**
* Add event listener
*/
PageRangeStream.prototype.on = function (event, listener) {
  this._emitter.on(event, listener);
};

/**
* Get page list
*/
PageRangeStream.prototype.list = function (options) {
  var self = this;
  var start = this._startOffset;
  var singleRangeSize = Constants.BlobConstants.MAX_SINGLE_GET_PAGE_RANGE_SIZE;
  var end = Math.min(this._startOffset + singleRangeSize - 1, this._endOffset);
  options.rangeStart = start
  options.rangeEnd = end;
  
  this.blobServiceClient.listPageRanges(this.container, this.blob, options, function (error, ranges, response) {
    if (error) throw error;
    var totalSize = parseInt(response.headers[Constants.HeaderConstants.BLOB_CONTENT_LENGTH_HEADER], 10);
    var endOffset = Math.min(totalSize - 1, self._endOffset);
    var rangeEnd = Math.min(end, endOffset);
    self.rangeSize = totalSize;
    if (!ranges.length) {
      // convert single page blob to page blob range
      // start >= end means there is no valid page regions
      ranges.push({ start : start, end : rangeEnd, dataSize: 0 });
    } else if (ranges[ranges.length - 1].end !== rangeEnd) {
      // don't forget the zero chunk at the end of range
      ranges.push({ start : ranges[ranges.length - 1].end + 1, end : rangeEnd, dataSize: 0 });
    }
    
    if (end >= endOffset) {
      self._rangeStreamEnded = true;
    }
    self.resizeAndSaveRanges(ranges);
    self._startOffset += singleRangeSize;
    self._emitPageRange();
    
    if (end < endOffset) {
      process.nextTick(function () {
        ranges = null;
        self.list(options);
        self = null;
      });
    }
  });
};

/**
* Resize page regions:
*   1. Merge small pieces into a range no more than 2MB
*   2. Split large pieces into ranges no nore than 4MB
*/
PageRangeStream.prototype.resizeAndSaveRanges = function (ranges) {
  var rangeList = this._rangelist;
  var holdingRange = { type : 'page', size : 0, dataSize : 0, start : this._startOffset, end : -1 };
  var readingRange = null;
  var rangeSize = 0;
  
  for (var i = 0; i < ranges.length; i++) {
    readingRange = ranges[i];
    rangeSize = readingRange.end - holdingRange.start + 1;
    
    if (rangeSize < Constants.BlobConstants.MIN_WRITE_PAGE_SIZE_IN_BYTES) {
      // merge fragment ranges
      this.mergeRanges(holdingRange, readingRange);
    } else {
      if (holdingRange.end != -1) {
        // save the holding range list and hold the reading range
        this.splitAndSavePageRanges(holdingRange, rangeList);
        holdingRange = readingRange;
      }
      
      if (this._dataOffset != readingRange.start) {
        // padding zero for empty page range and hold the reading range 
        this.putZeroRange(this._dataOffset, readingRange.start - 1, rangeList);
        holdingRange = readingRange;
      } else if (holdingRange.end == -1) {
        // if holdingRange is never set, it means readingRange exceeds MIN_WRITE_PAGE_SIZE_IN_BYTES
        this.splitAndSavePageRanges(readingRange, rangeList);
        // reading range has been saved, offset the holding start position for calculating the range size in next loop
        holdingRange.start = readingRange.end + 1;
      }
    }
    
    // If it is the last range, put the holding range into list anyway
    if (i == ranges.length - 1 && holdingRange.end > holdingRange.start) {
      this.splitAndSavePageRanges(holdingRange, rangeList);
    }
    
    this._dataOffset = readingRange.end + 1;
  }
};

/**
* Put a zero range into range list
*/
PageRangeStream.prototype.putZeroRange = function (startOffset, endOffset, rangeList) {
  var zeroDataRange = { type : 'page', size : -1, dataSize : 0, start : startOffset, end : endOffset };
  this.splitAndSavePageRanges(zeroDataRange, rangeList);
}

/**
* Put a zero range into range list
*/
PageRangeStream.prototype.mergeRanges = function (holdingRange, readingRange) {
  holdingRange.size = readingRange.end - holdingRange.start + 1;
  holdingRange.dataSize += readingRange.dataSize;
  holdingRange.end = readingRange.end;
  return holdingRange;
}

/**
* Split block blob into small pieces with maximum 4MB and minimum 2MB size.
* For example, [0, 10G - 1] => [0, 4MB - 1], [4MB, 8MB - 1] ... [10GB - 4MB, 10GB - 1]
*/
PageRangeStream.prototype.splitAndSavePageRanges = function (range, rangeList) {
  var rangeSize = range.end - range.start + 1;
  var offset = range.start;
  var limitedSize = 0;
  var maxSize = Constants.BlobConstants.DEFAULT_WRITE_PAGE_SIZE_IN_BYTES;
  while (rangeSize > 0) {
    var newRange = { type : 'page', size : 0, dataSize : 0, start : -1, end : -1 };
    limitedSize = Math.min(rangeSize, maxSize);
    newRange.start = offset;
    newRange.size = limitedSize;
    if (range.dataSize === 0) {
      newRange.dataSize = 0;
    } else {
      newRange.dataSize = limitedSize;
    }
    offset += limitedSize;
    newRange.end = offset - 1;
    rangeList.push(newRange);
    rangeSize -= limitedSize;
  }
};

/**
* Emit page range
*/
PageRangeStream.prototype._emitPageRange = function () {
  if (this._paused || this._emittedAll || this._isEmitting) return;
  this._isEmitting = true;
  try {
    for (; this._emittedRangeIndex < this._rangelist.length; this._emittedRangeIndex++) {
      if (this._paused) {
        return;
      }
      var range = this._rangelist[this._emittedRangeIndex];
      this._emitter.emit('range', range);
      this._rangelist[this._emittedRangeIndex] = null;
    }
    
    if (this._rangeStreamEnded) {
      this._rangelist = null;
      this._emittedAll = true;
      this._emitter.emit('end');
    }//Otherwise we should wait for the other getPageRanges
  } finally {
    this._isEmitting = false;
  }
};

/**
* Pause the stream
*/
PageRangeStream.prototype.pause = function () {
  this._paused = true;
};

/**
* Resume the stream
*/
PageRangeStream.prototype.resume = function () {
  this._paused = false;
  if (!this._isEmitting) {
    this._emitPageRange();
  }
};

module.exports = PageRangeStream;
