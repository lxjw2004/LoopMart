import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldSendOnEnter, filterConversations } from './chat-composer.js';
test('Enter submits only outside composition and without Shift', () => {
  assert.equal(shouldSendOnEnter('Enter', false, false, 13), true);
  assert.equal(shouldSendOnEnter('Enter', true, false, 13), false);
  assert.equal(shouldSendOnEnter('Enter', false, true, 13), false);
  assert.equal(shouldSendOnEnter('Enter', false, false, 229), false);
});
test('search matches names and last text, preserving conversation rows', () => {
  const rows = [{id:'a',otherUser:{name:'Alice'},lastMessage:{text:'Book'}},{id:'b',otherUser:{name:'Bob'}}];
  assert.deepEqual(filterConversations(rows,' ALICE '), [rows[0]]);
  assert.deepEqual(filterConversations(rows,'book'), [rows[0]]);
  assert.deepEqual(filterConversations(rows,''), rows);
});
