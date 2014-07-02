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
var url = require('url');

var assert = require('assert');
var testutil = require('../../framework/util');
var azure = testutil.libRequire('azure-storage');

var Constants = azure.Constants;
var StorageServiceClientConstants = Constants.StorageServiceClientConstants;
var QueueUtilities = azure.QueueUtilities;
var HttpConstants = Constants.HttpConstants;
var guid = require('node-uuid');

var queueService;

var queues = [];
var queueNamesPrefix;

var listQueues = function listQueues (prefix, options, token, callback) {
  queueService.listQueuesSegmentedWithPrefix(prefix, token, options, function(error, result) {
    assert.equal(error, null);
    queues.push.apply(queues, result.entries);
    var token = result.continuationToken;
    if(token) {
      listQueues(prefix, options, token, callback);
    }
    else {
      callback();
    }
  });
};

describe('QueueServiceTests', function() {
  var queueName;
  var queueName2;
  before(function (done) {
    queueService = azure.createQueueService().withFilter(new azure.ExponentialRetryPolicyFilter());
    done();
  });

  beforeEach(function (done) {
    queueNamesPrefix = 'sample' + guid.v1();
    queueName = queueNamesPrefix + 1;
    queueName2 = queueNamesPrefix + 2;
    done();
  });

  afterEach(function (done) {
    queueService.encodeMessage = true;
    queueService.deleteQueueIfExists(queueName, function(error) {
      assert.equal(error, null);
      queueService.deleteQueueIfExists(queueName2, function(error) {
        assert.equal(error, null);
        done();
      });
    });
  });

  describe('CreateQueue', function () {
    it('should detect incorrect queue names', function (done) {
      assert.throws(function () { queueService.createQueue(null, function () { }); },
        /Required argument queue for function createQueue is not defined/);

      assert.throws(function () { queueService.createQueue('', function () { }); },
        /Required argument queue for function createQueue is not defined/);

      assert.throws(function () { queueService.createQueue('as', function () { }); },
        /Queue name must be between 3 and 63 characters long./);

      assert.throws(function () { queueService.createQueue('a--s', function () { }); },
        /Queue name format is incorrect./);

      assert.throws(function () { queueService.createQueue('queue-', function () { }); },
        /Queue name format is incorrect./);

      assert.throws(function () { queueService.createQueue('quEue', function () { }); },
        /Queue name format is incorrect./);

      done();
    });

    it('should work', function (done) {
      var metadata = { 'class': 'test' };

      // Create
      queueService.createQueue(queueName, { metadata: metadata }, function (createError, queue, createResponse) {
        assert.equal(createError, null);
        assert.notEqual(queue, null);
        assert.ok(createResponse.isSuccessful);
        assert.equal(createResponse.statusCode, HttpConstants.HttpResponseCodes.Created);

        assert.ok(queue);
        if (createResponse.queue) {
          assert.ok(queue.name);
          assert.equal(queue.name, queueName);

          assert.ok(queue.metadata);
          assert.equal(queue.metadata['class'], metadata['class']);
        }

        // Get
        queueService.getQueueMetadata(queueName, function (getError, getQueue, getResponse) {
          assert.equal(getError, null);
          assert.ok(getResponse.isSuccessful);
          assert.equal(getResponse.statusCode, HttpConstants.HttpResponseCodes.Ok);

          assert.ok(getQueue);
          if (getQueue) {
            assert.ok(getQueue.name);
            assert.equal(getQueue.name, queueName);

            assert.ok(getQueue.metadata);
            assert.equal(getQueue.metadata['class'], metadata['class']);
          }

          // Delete
          queueService.deleteQueue(queueName, function (deleteError, deleteResponse) {
            assert.equal(deleteError, null);
            assert.ok(deleteResponse.isSuccessful);
            assert.equal(deleteResponse.statusCode, HttpConstants.HttpResponseCodes.NoContent);

            done();
          });
        });
      });
    });
  });

  describe('CreateQueueIfNotExists', function () {
    it('should work', function (done) {
      var metadata = { 'class': 'test' };

      // Create
      queueService.createQueue(queueName, { metadata: metadata }, function (createError, queue, createResponse) {
        assert.equal(createError, null);
        assert.notEqual(queue, null);
        assert.ok(createResponse.isSuccessful);
        assert.equal(createResponse.statusCode, HttpConstants.HttpResponseCodes.Created);

        assert.ok(queue);
        if (createResponse.queue) {
          assert.ok(queue.name);
          assert.equal(queue.name, queueName);

          assert.ok(queue.metadata);
          assert.equal(queue.metadata['class'], metadata['class']);
        }

        // Try creating again
        queueService.createQueueIfNotExists(queueName, { metadata: metadata }, function (createError2, queueCreated2) {
          assert.equal(createError2, null);
          assert.equal(queueCreated2, false);
          assert.ok(createResponse.isSuccessful);

          done();
        });
      });
    });
  });

  describe('ListQueues', function () {
    it('should work', function (done) {
      var metadata = { 'class': 'test' };

      queues.length = 0;
      listQueues(queueNamesPrefix, { 'include': 'metadata' }, null, function () {
        assert.equal(queues.length, 0);

        queueService.createQueue(queueName, function (createError1, queue1, createResponse1) {
          assert.equal(createError1, null);
          assert.notEqual(queue1, null);
          assert.ok(createResponse1.isSuccessful);
          assert.equal(createResponse1.statusCode, HttpConstants.HttpResponseCodes.Created);

          queueService.createQueue(queueName2, { metadata: metadata }, function (createError2, queue2, createResponse2) {
            assert.equal(createError2, null);
            assert.notEqual(queue2, null);
            assert.ok(createResponse2.isSuccessful);
            assert.equal(createResponse2.statusCode, HttpConstants.HttpResponseCodes.Created);

            queues.length = 0;
            listQueues(queueNamesPrefix, { 'include': 'metadata' }, null, function () {
              var entries = 0;
              queues.forEach(function(queue) {

                if (queue.name === queueName) {
                  entries += 1;
                }
                else if (queue.name === queueName2) {
                  entries += 2;
                  assert.equal(queue.metadata['class'], metadata['class']);
                }
              });

              assert.equal(entries, 3);

              done();
            });
          });
        });
      });
    });
  });

  describe('CreateAndPeekMessage', function () {
    it('should work', function (done) {
      var messageText1 = 'hi there';
      var messageText2 = 'bye there';

      // Create Queue
      queueService.createQueue(queueName, function (createError1, queue1, createResponse1) {
        assert.equal(createError1, null);
        assert.notEqual(queue1, null);
        assert.ok(createResponse1.isSuccessful);
        assert.equal(createResponse1.statusCode, HttpConstants.HttpResponseCodes.Created);

        // Create message
        queueService.createMessage(queueName, messageText1, function (createMessageError, message, createMessageResponse) {
          assert.equal(createMessageError, null);
          assert.ok(createMessageResponse.isSuccessful);
          assert.equal(createMessageResponse.statusCode, HttpConstants.HttpResponseCodes.Created);

          // Create another message
          queueService.createMessage(queueName, messageText2, function (createMessageError2, message2, createMessageResponse2) {
            assert.equal(createMessageError, null);
            assert.ok(createMessageResponse2.isSuccessful);
            assert.equal(createMessageResponse2.statusCode, HttpConstants.HttpResponseCodes.Created);

            // Peek message
            queueService.peekMessages(queueName, function (peekError, queueMessages, peekResponse) {
              assert.equal(peekError, null);
              assert.notEqual(queueMessages, null);

              var queueMessage = queueMessages[0];
              assert.ok(queueMessage);
              assert.ok(queueMessage['messageid']);
              assert.ok(queueMessage['insertiontime']);
              assert.ok(queueMessage['expirationtime']);
              assert.equal(queueMessage.messagetext, messageText1);

              assert.ok(peekResponse.isSuccessful);
              assert.equal(peekResponse.statusCode, HttpConstants.HttpResponseCodes.Ok);

              // Get messages
              queueService.getMessages(queueName, function (getError, getQueueMessages, getResponse) {
                assert.equal(getError, null);
                assert.notEqual(getQueueMessages, null);
                assert.equal(getQueueMessages.length, 1);
                assert.ok(getResponse.isSuccessful);
                assert.equal(getResponse.statusCode, HttpConstants.HttpResponseCodes.Ok);

                var getQueueMessage = getQueueMessages[0];
                assert.equal(getQueueMessage.messagetext, messageText1);

                // Delete message
                queueService.deleteMessage(queueName, getQueueMessage.messageid, getQueueMessage.popreceipt, function (deleteError, deleteResponse) {
                  assert.equal(deleteError, null);
                  assert.ok(deleteResponse.isSuccessful);
                  assert.equal(deleteResponse.statusCode, HttpConstants.HttpResponseCodes.NoContent);

                  // Get messages again
                  queueService.getMessages(queueName, function (getError2, getQueueMessages2, getResponse2) {
                    assert.equal(getError2, null);
                    assert.notEqual(getQueueMessages2, null);
                    assert.ok(getResponse2.isSuccessful);
                    assert.equal(getResponse2.statusCode, HttpConstants.HttpResponseCodes.Ok);

                    var getQueueMessage2 = getQueueMessages2[0];
                    assert.equal(getQueueMessage2.messagetext, messageText2);

                    // Clear messages
                    queueService.clearMessages(queueName, function (clearError, clearResponse) {
                      assert.equal(clearError, null);
                      assert.ok(clearResponse.isSuccessful);
                      assert.equal(clearResponse.statusCode, HttpConstants.HttpResponseCodes.NoContent);

                      // Get message again should yield empty
                      queueService.getMessages(queueName, function (getError3, getQueueMessage3, getResponse3) {
                        assert.equal(getError3, null);
                        assert.ok(getResponse3.isSuccessful);
                        assert.equal(getResponse3.statusCode, HttpConstants.HttpResponseCodes.Ok);

                        assert.equal(getQueueMessage3.length, 0);

                        done();
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });

    it('buffer', function (done) {
      var messageText1 = 'hi there';
      var messageText2 = 'bye there';

      // Create Queue
      queueService.createQueue(queueName, function (createError1, queue1, createResponse1) {
        assert.equal(createError1, null);
        assert.notEqual(queue1, null);
        assert.ok(createResponse1.isSuccessful);
        assert.equal(createResponse1.statusCode, HttpConstants.HttpResponseCodes.Created);

        // Create message
        queueService.createMessage(queueName, new Buffer(messageText1), function (createMessageError, message, createMessageResponse) {
          assert.equal(createMessageError, null);
          assert.ok(createMessageResponse.isSuccessful);
          assert.equal(createMessageResponse.statusCode, HttpConstants.HttpResponseCodes.Created);

          // Create another message
          queueService.createMessage(queueName, new Buffer(messageText2), function (createMessageError2, message2, createMessageResponse2) {
            assert.equal(createMessageError, null);
            assert.ok(createMessageResponse2.isSuccessful);
            assert.equal(createMessageResponse2.statusCode, HttpConstants.HttpResponseCodes.Created);

            // Peek message
            queueService.peekMessages(queueName, function (peekError, queueMessages, peekResponse) {
              assert.equal(peekError, null);
              assert.notEqual(queueMessages, null);

              var queueMessage = queueMessages[0];
              assert.ok(queueMessage);
              assert.ok(queueMessage['messageid']);
              assert.ok(queueMessage['insertiontime']);
              assert.ok(queueMessage['expirationtime']);
              assert.equal(queueMessage.messagetext, messageText1);

              assert.ok(peekResponse.isSuccessful);
              assert.equal(peekResponse.statusCode, HttpConstants.HttpResponseCodes.Ok);

              // Get messages
              queueService.getMessages(queueName, function (getError, getQueueMessages, getResponse) {
                assert.equal(getError, null);
                assert.notEqual(getQueueMessages, null);
                assert.equal(getQueueMessages.length, 1);
                assert.ok(getResponse.isSuccessful);
                assert.equal(getResponse.statusCode, HttpConstants.HttpResponseCodes.Ok);

                var getQueueMessage = getQueueMessages[0];
                assert.equal(getQueueMessage.messagetext, messageText1);

                // Delete message
                queueService.deleteMessage(queueName, getQueueMessage.messageid, getQueueMessage.popreceipt, function (deleteError, deleteResponse) {
                  assert.equal(deleteError, null);
                  assert.ok(deleteResponse.isSuccessful);
                  assert.equal(deleteResponse.statusCode, HttpConstants.HttpResponseCodes.NoContent);

                  // Get messages again
                  queueService.getMessages(queueName, function (getError2, getQueueMessages2, getResponse2) {
                    assert.equal(getError2, null);
                    assert.notEqual(getQueueMessages2, null);
                    assert.ok(getResponse2.isSuccessful);
                    assert.equal(getResponse2.statusCode, HttpConstants.HttpResponseCodes.Ok);

                    var getQueueMessage2 = getQueueMessages2[0];
                    assert.equal(getQueueMessage2.messagetext, messageText2);

                    // Clear messages
                    queueService.clearMessages(queueName, function (clearError, clearResponse) {
                      assert.equal(clearError, null);
                      assert.ok(clearResponse.isSuccessful);
                      assert.equal(clearResponse.statusCode, HttpConstants.HttpResponseCodes.NoContent);

                      // Get message again should yield empty
                      queueService.getMessages(queueName, function (getError3, getQueueMessage3, getResponse3) {
                        assert.equal(getError3, null);
                        assert.ok(getResponse3.isSuccessful);
                        assert.equal(getResponse3.statusCode, HttpConstants.HttpResponseCodes.Ok);

                        assert.equal(getQueueMessage3.length, 0);

                        done();
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });

    it('no encoding', function (done) {
      var messageText1 = 'hi there';
      var messageText2 = 'bye there';

      queueService.encodeMessage = false;

      // Create Queue
      queueService.createQueue(queueName, function (createError1, queue1, createResponse1) {
        assert.equal(createError1, null);
        assert.notEqual(queue1, null);
        assert.ok(createResponse1.isSuccessful);
        assert.equal(createResponse1.statusCode, HttpConstants.HttpResponseCodes.Created);

        // Create message
        queueService.createMessage(queueName, messageText1, function (createMessageError, message, createMessageResponse) {
          assert.equal(createMessageError, null);
          assert.ok(createMessageResponse.isSuccessful);
          assert.equal(createMessageResponse.statusCode, HttpConstants.HttpResponseCodes.Created);

          // Create another message
          queueService.createMessage(queueName, messageText2, function (createMessageError2, message2, createMessageResponse2) {
            assert.equal(createMessageError, null);
            assert.ok(createMessageResponse2.isSuccessful);
            assert.equal(createMessageResponse2.statusCode, HttpConstants.HttpResponseCodes.Created);

            // Peek message
            queueService.peekMessages(queueName, function (peekError, queueMessages, peekResponse) {
              assert.equal(peekError, null);
              assert.notEqual(queueMessages, null);

              var queueMessage = queueMessages[0];
              if (queueMessage) {
                assert.ok(queueMessage['messageid']);
                assert.ok(queueMessage['insertiontime']);
                assert.ok(queueMessage['expirationtime']);
                assert.equal(queueMessage.messagetext, messageText1);
              }

              assert.ok(peekResponse.isSuccessful);
              assert.equal(peekResponse.statusCode, HttpConstants.HttpResponseCodes.Ok);

              // Get messages
              queueService.getMessages(queueName, function (getError, getQueueMessages, getResponse) {
                assert.equal(getError, null);
                assert.notEqual(getQueueMessages, null);
                assert.equal(getQueueMessages.length, 1);
                assert.ok(getResponse.isSuccessful);
                assert.equal(getResponse.statusCode, HttpConstants.HttpResponseCodes.Ok);

                var getQueueMessage = getQueueMessages[0];
                assert.equal(getQueueMessage.messagetext, messageText1);

                // Delete message
                queueService.deleteMessage(queueName, getQueueMessage.messageid, getQueueMessage.popreceipt, function (deleteError, deleteResponse) {
                  assert.equal(deleteError, null);
                  assert.ok(deleteResponse.isSuccessful);
                  assert.equal(deleteResponse.statusCode, HttpConstants.HttpResponseCodes.NoContent);

                  // Get messages again
                  queueService.getMessages(queueName, function (getError2, getQueueMessages2, getResponse2) {
                    assert.equal(getError2, null);
                    assert.notEqual(getQueueMessages2, null);
                    assert.ok(getResponse2.isSuccessful);
                    assert.equal(getResponse2.statusCode, HttpConstants.HttpResponseCodes.Ok);

                    var getQueueMessage2 = getQueueMessages2[0];
                    assert.equal(getQueueMessage2.messagetext, messageText2);

                    // Clear messages
                    queueService.clearMessages(queueName, function (clearError, clearResponse) {
                      assert.equal(clearError, null);
                      assert.ok(clearResponse.isSuccessful);
                      assert.equal(clearResponse.statusCode, HttpConstants.HttpResponseCodes.NoContent);

                      // Get message again should yield empty
                      queueService.getMessages(queueName, function (getError3, getQueueMessage3, getResponse3) {
                        assert.equal(getError3, null);
                        assert.ok(getResponse3.isSuccessful);
                        assert.equal(getResponse3.statusCode, HttpConstants.HttpResponseCodes.Ok);

                        assert.equal(getQueueMessage3.length, 0);

                        done();
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });

    it('no encoding buffer', function (done) {
      var messageText1 = 'hi there';
      var messageText2 = 'bye there';

      queueService.encodeMessage = false;

      // Create Queue
      queueService.createQueue(queueName, function (createError1, queue1, createResponse1) {
        assert.equal(createError1, null);
        assert.notEqual(queue1, null);
        assert.ok(createResponse1.isSuccessful);
        assert.equal(createResponse1.statusCode, HttpConstants.HttpResponseCodes.Created);

        // Create message
        queueService.createMessage(queueName, new Buffer(messageText1), function (createMessageError, message, createMessageResponse) {
          assert.equal(createMessageError, null);
          assert.ok(createMessageResponse.isSuccessful);
          assert.equal(createMessageResponse.statusCode, HttpConstants.HttpResponseCodes.Created);

          // Create another message
          queueService.createMessage(queueName, new Buffer(messageText2), function (createMessageError2, message2, createMessageResponse2) {
            assert.equal(createMessageError, null);
            assert.ok(createMessageResponse2.isSuccessful);
            assert.equal(createMessageResponse2.statusCode, HttpConstants.HttpResponseCodes.Created);

            // Peek message
            queueService.peekMessages(queueName, function (peekError, queueMessages, peekResponse) {
              assert.equal(peekError, null);
              assert.notEqual(queueMessages, null);

              var queueMessage = queueMessages[0];
              if (queueMessage) {
                assert.ok(queueMessage['messageid']);
                assert.ok(queueMessage['insertiontime']);
                assert.ok(queueMessage['expirationtime']);
                assert.equal(queueMessage.messagetext, messageText1);
              }

              assert.ok(peekResponse.isSuccessful);
              assert.equal(peekResponse.statusCode, HttpConstants.HttpResponseCodes.Ok);

              // Get messages
              queueService.getMessages(queueName, function (getError, getQueueMessages, getResponse) {
                assert.equal(getError, null);
                assert.notEqual(getQueueMessages, null);
                assert.equal(getQueueMessages.length, 1);
                assert.ok(getResponse.isSuccessful);
                assert.equal(getResponse.statusCode, HttpConstants.HttpResponseCodes.Ok);

                var getQueueMessage = getQueueMessages[0];
                assert.equal(getQueueMessage.messagetext, messageText1);

                // Delete message
                queueService.deleteMessage(queueName, getQueueMessage.messageid, getQueueMessage.popreceipt, function (deleteError, deleteResponse) {
                  assert.equal(deleteError, null);
                  assert.ok(deleteResponse.isSuccessful);
                  assert.equal(deleteResponse.statusCode, HttpConstants.HttpResponseCodes.NoContent);

                  // Get messages again
                  queueService.getMessages(queueName, function (getError2, getQueueMessages2, getResponse2) {
                    assert.equal(getError2, null);
                    assert.notEqual(getQueueMessages2, null);
                    assert.ok(getResponse2.isSuccessful);
                    assert.equal(getResponse2.statusCode, HttpConstants.HttpResponseCodes.Ok);

                    var getQueueMessage2 = getQueueMessages2[0];
                    assert.equal(getQueueMessage2.messagetext, messageText2);

                    // Clear messages
                    queueService.clearMessages(queueName, function (clearError, clearResponse) {
                      assert.equal(clearError, null);
                      assert.ok(clearResponse.isSuccessful);
                      assert.equal(clearResponse.statusCode, HttpConstants.HttpResponseCodes.NoContent);

                      // Get message again should yield empty
                      queueService.getMessages(queueName, function (getError3, getQueueMessage3, getResponse3) {
                        assert.equal(getError3, null);
                        assert.ok(getResponse3.isSuccessful);
                        assert.equal(getResponse3.statusCode, HttpConstants.HttpResponseCodes.Ok);

                        assert.equal(getQueueMessage3.length, 0);

                        done();
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });

    it('empty', function (done) {
      // Create Queue
      queueService.createQueue(queueName, function (createError1) {
        assert.equal(createError1, null);

        // Create message
        queueService.createMessage(queueName, '', function (createMessageError, message, createMessageResponse) {
          assert.equal(createMessageError, null);
          assert.equal(createMessageResponse.statusCode, HttpConstants.HttpResponseCodes.Created);

          done();
        });
      });
    });
  });
  
  describe('SetQueueMetadataName', function () {
    it('should work', function (done) {
      var metadata = { '\Uc8fc\Uba39\Uc774\Uc6b4\Ub2e4': 'test' };

      queueService.createQueueIfNotExists(queueName, function (createError) {
        assert.equal(createError, null);

        // unicode headers are valid
        queueService.setQueueMetadata(queueName, metadata, function (setError) {
          assert.equal(setError, null);
          done();
        });
      });
    });
  });

  describe('SetQueueMetadata', function () {
    it('should work', function (done) {
      var metadata = { 'class': 'test' };

      queueService.createQueueIfNotExists(queueName, function (createError) {
        assert.equal(createError, null);

        queueService.setQueueMetadata(queueName, metadata, function (setError) {
          assert.equal(setError, null);

          queueService.getQueueMetadata(queueName, function (getError, queue) {
            assert.equal(getError, null);

            assert.notEqual(queue, null);
            if (queue) {
              assert.notEqual(queue.metadata, null);

              assert.equal(queue.metadata.class, 'test');

              done();
            }
          });
        });
      });
    });
  });

  describe('GetMessages', function () {
    it('should work', function (done) {
      queueService.createQueue(queueName, function (createError) {
        assert.equal(createError, null);

        queueService.getMessages(queueName, function (error, emptyMessages) {
          assert.equal(error, null);
          assert.notEqual(emptyMessages, null);
          assert.equal(emptyMessages.length, 0);

          queueService.createMessage(queueName, 'msg1', function (error1) {
            assert.equal(error1, null);

            queueService.createMessage(queueName, 'msg2', function (error2) {
              assert.equal(error2, null);

              queueService.getMessages(queueName, { peekOnly: true }, function (error3, messages) {
                assert.equal(error3, null);
                assert.notEqual(messages, null);

                // By default only one is returned
                assert.equal(messages.length, 1);
                assert.equal(messages[0].messagetext, 'msg1');

                queueService.getMessages(queueName, { numOfMessages: 2 }, function (error4, messages2) {
                  assert.equal(error4, null);
                  assert.notEqual(messages2, null);
                  assert.equal(messages2.length, 2);

                  done();
                });
              });
            });
          });
        });
      });
    });
  });

  describe('UpdateMessage', function () {
    it('should work', function (done) {
      queueService.createQueue(queueName, function (error) {
        assert.equal(error, null);

        queueService.createMessage(queueName, 'hi there', function (error2) {
          assert.equal(error2, null);

          queueService.getMessages(queueName, function (error3, messages) {
            assert.equal(error2, null);
            assert.notEqual(messages, null);
            var message = messages[0];

            queueService.updateMessage(queueName, message.messageid, message.popreceipt, 10, { messagetext: 'bye there' }, function (error4) {
              assert.equal(error4, null);

              done();
            });
          });
        });
      });
    });
  });

  describe('UpdateMessageEncodingPopReceipt', function () {
    it('should work', function (done) {
      // no messages in the queue try to update a message should give fail to update instead of blowing up on authentication
      queueService.updateMessage(queueName, 'mymsg', 'AgAAAAEAAACucgAAvMW8+dqjzAE=', 10, { messagetext: 'bye there' }, function (error) {
        assert.notEqual(error, null);
        assert.equal(error.code, Constants.QueueErrorCodeStrings.QUEUE_NOT_FOUND);

        done();
      });
    });
  });

  describe('ConnectionStringTests', function () {
    it('should work', function (done) {
      var key = 'AhlzsbLRkjfwObuqff3xrhB2yWJNh1EMptmcmxFJ6fvPTVX3PZXwrG2YtYWf5DPMVgNsteKStM5iBLlknYFVoA==';
      var connectionString = 'DefaultEndpointsProtocol=https;AccountName=myaccount;AccountKey=' + key;
      var queueService = azure.createQueueService(connectionString);

      assert.equal(queueService.storageAccount, 'myaccount');
      assert.equal(queueService.storageAccessKey, key);

      var parsedHost = url.parse(queueService.host.primaryHost);
      assert.equal(parsedHost.protocol, 'https:');
      assert.equal(parsedHost.hostname, 'myaccount.queue.core.windows.net');
      assert.equal(parsedHost.port, '443');

      done();
    });

    it('should work with dev store', function (done) {
      var connectionString = 'UseDevelopmentStorage=true';
      var queueService = azure.createQueueService(connectionString);

      assert.equal(queueService.storageAccount, StorageServiceClientConstants.DEVSTORE_STORAGE_ACCOUNT);
      assert.equal(queueService.storageAccessKey, StorageServiceClientConstants.DEVSTORE_STORAGE_ACCESS_KEY);

      var parsedHost = url.parse(queueService.host.primaryHost);
      assert.equal(parsedHost.protocol, 'http:');
      assert.equal(parsedHost.hostname, '127.0.0.1');
      assert.equal(parsedHost.port, '10001');

      done();
    });
  });

  describe('doesQueueExist', function() {
    it('should work', function(done) {
      queueService.doesQueueExist(queueName, function(existsError, exists, createQueueResponse) {
        assert.strictEqual(existsError, null);
        assert.strictEqual(exists, false);

        queueService.createQueue(queueName, function(createError, queue1, createQueueResponse) {
          assert.strictEqual(createError, null);
          assert.notStrictEqual(queue1, null);
          assert.strictEqual(createQueueResponse.statusCode, HttpConstants.HttpResponseCodes.Created);

          queueService.doesQueueExist(queueName, function(existsError, exists, createQueueResponse) {
            assert.strictEqual(existsError, null);
            assert.strictEqual(exists, true);
            done();
          });
        });
      });
    });
  });

  describe('deleteQueueIfExists', function() {
    it('deleteQueueIfExists', function(done) {

      queueService.deleteQueueIfExists(queueName, function(deleteError, deleted, deleteQueueResponse) {
        assert.strictEqual(deleteError, null);
        assert.strictEqual(deleted, false);

        queueService.createQueue(queueName, function(createError, queue1, createQueueResponse) {
          assert.strictEqual(createError, null);
          assert.notStrictEqual(queue1, null);
          assert.strictEqual(createQueueResponse.statusCode, HttpConstants.HttpResponseCodes.Created);

          queueService.deleteQueueIfExists(queueName, function(deleteError, deleted, deleteQueueResponse) {
            assert.strictEqual(deleteError, null);
            assert.strictEqual(deleted, true);
            done();
          });
        });
      });
    });
  });

  describe('createQueueIfNotExists', function() {
    it('should work', function(done) {
      queueService.doesQueueExist(queueName, function(existsError, exists, createQueueResponse) {
        assert.strictEqual(existsError, null);
        assert.strictEqual(exists, false);

        queueService.createQueueIfNotExists(queueName, function(createError, queue, createResponse) {

          assert.strictEqual(createError, null);
          assert.notStrictEqual(queue, null);
          assert.ok(createResponse.isSuccessful);
          assert.strictEqual(createResponse.statusCode, HttpConstants.HttpResponseCodes.Created);

          assert.ok(queue);
          if (createResponse.queue) {
            assert.ok(queue.name);
            assert.equal(queue.name, queueName);

            assert.ok(queue.metadata);
            assert.equal(queue.metadata['class'], metadata['class']);
          }

          queueService.doesQueueExist(queueName, function(existsError, exists) {
            assert.strictEqual(existsError, null);
            assert.strictEqual(exists, true);

            queueService.createQueueIfNotExists(queueName, function(createError, queue) {
              assert.strictEqual(createError, null);
              assert.strictEqual(queue, false);
              queueService.deleteQueue(queueName, function(deleteError) {
                assert.equal(deleteError, null);
                queueService.createQueueIfNotExists(queueName, function (createError3) {
                  assert.notEqual(createError3, null);
                  assert.equal(createError3.code, 'QueueBeingDeleted');
                  done();
                });
              });
            });
          });
        });
      });
    });
  });

  describe('testSAS', function() {
    it('should work with noPolicy', function(done) {
      queueService.createQueueIfNotExists(queueName, function() {
        var text = 'Sample message text';
        queueService.createMessage(queueName, text, function() {

          var startDate = new Date();
          var expiryDate = new Date(startDate);
          expiryDate.setMinutes(startDate.getMinutes() + 100);
          startDate.setMinutes(startDate.getMinutes() - 100);

          var sharedAccessPolicy = {
            AccessPolicy: {
              Permissions: QueueUtilities.SharedAccessPermissions.PROCESS,
              Start: startDate,
              Expiry: expiryDate
            },
          };

          var queueSAS = queueService.generateSharedAccessSignature(queueName, sharedAccessPolicy);
          var sharedQueueService = azure.createQueueServiceWithSas(queueService.host, queueSAS);
        
          sharedQueueService.getMessages(queueName, function (error, messages, response) {
            assert.strictEqual(error, null);
            assert.notStrictEqual(messages, null);
            assert.strictEqual(messages.length, 1);
            assert.ok(response.isSuccessful);
            assert.strictEqual(response.statusCode, HttpConstants.HttpResponseCodes.Ok);

            var message = messages[0];
            assert.equal(message.messagetext, text);
            done();

          });
        });
      });
    });

    it('should work with policy', function(done) {
      queueService.createQueueIfNotExists(queueName, function() {
        var text = 'Sample message text';
        queueService.createMessage(queueName, text, function() {

          var startDate = new Date();
          var expiryDate = new Date(startDate);
          expiryDate.setMinutes(startDate.getMinutes() + 10);
          var id = 'sampleIDForQueuePolicy';

          var sharedAccessPolicy = [{
            AccessPolicy: {
              Permissions: QueueUtilities.SharedAccessPermissions.PROCESS,
              Expiry: expiryDate
            },
            Id: id,
          }];

          var sharedAccessPolicyJustId = {
            Id: id,
          };


          queueService.getQueueAcl(queueName, function(error, result, response) {

            queueService.setQueueAcl(queueName, sharedAccessPolicy, function() {

              // Timeout is needed for the policy to take affect on the service. 
              setTimeout(function () {
                var queueSAS = queueService.generateSharedAccessSignature(queueName, sharedAccessPolicyJustId);
                var sharedQueueService = azure.createQueueServiceWithSas(queueService.host, queueSAS);
              
                sharedQueueService.getMessages(queueName, function (error, messages, response) {
                  assert.strictEqual(error, null);
                  assert.notStrictEqual(messages, null);
                  assert.strictEqual(messages.length, 1);
                  assert.ok(response.isSuccessful);
                  assert.strictEqual(response.statusCode, HttpConstants.HttpResponseCodes.Ok);

                  var message = messages[0];
                  assert.equal(message.messagetext, text);
                  done();
                });
              }, 3000);
            });
          });
        });
      });
    });
  });
});