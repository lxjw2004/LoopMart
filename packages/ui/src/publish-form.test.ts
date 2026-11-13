import test from 'node:test';
import assert from 'node:assert/strict';
import { formPayload, restoreDraft } from './DataForm';
test('publishing converts exact USD and checks seat bounds', () => {
  assert.equal(formPayload({ priceCents: '0.29' }).priceCents, 29);
  assert.equal(formPayload({ feeCents: '0', totalSeats: 2, availableSeats: 0 }).feeCents, 0);
  assert.throws(() => formPayload({ priceCents: '1.001' }));
  assert.throws(() => formPayload({ totalSeats: 2, availableSeats: 3 }));
});
test('draft recovery ignores malformed and unrelated fields', () => {
  assert.deepEqual(restoreDraft('{broken', {title:'text'}, {}), {});
  assert.deepEqual(restoreDraft('{"title":"Book","publisherId":"other"}', {title:'text'}, {}), {title:'Book'});
  assert.deepEqual(restoreDraft('["bad"]', {title:'text'}, {title:'Default'}), {title:'Default'});
});
