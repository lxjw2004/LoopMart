import { test } from "node:test";
import assert from "node:assert/strict";
import { validate } from "../apps/api/src/validation.js";
const ride = {
  origin: "Purdue",
  destination: "Chicago",
  departureTime: "2026-11-15T10:00:00Z",
  timeZone: "America/Indiana/Indianapolis",
  feeCents: 100,
  totalSeats: 3,
  availableSeats: 2,
};
test("ride amounts, seat boundaries, UTC timestamps and IANA timezone are enforced", () => {
  validate("ride", ride);
  for (const patch of [
    { feeCents: 1.1 },
    { feeCents: -1 },
    { totalSeats: 0 },
    { availableSeats: 4 },
    { availableSeats: 1.2 },
    { timeZone: "Mars/Central" },
    { timeZone: "" },
    { departureTime: "2026-11-15T10:00:00" },
  ])
    assert.throws(() => validate("ride", { ...ride, ...patch }));
});
import {
  createWriteLimiter,
  WRITE_LIMITS,
} from "../apps/api/src/rate-limit.js";
test("member write limits isolate actors/actions, reset windows and bound memory", () => {
  let now = 0;
  const allow = createWriteLimiter(() => now, 2);
  for (let i = 0; i < WRITE_LIMITS.publish; i++)
    assert.equal(allow("a", "publish"), true);
  assert.equal(allow("a", "publish"), false);
  assert.equal(allow("a", "message"), true);
  assert.equal(allow("b", "report"), false);
  now = 60000;
  assert.equal(allow("b", "report"), true);
  assert.equal(allow("a", "publish"), true);
});
import {decodeEntityCursor,encodeEntityCursor,entityOrder} from '../apps/api/src/cursor.js';
test('entity cursors preserve timestamp precision and bind sorting',()=>{const row={id:'12345678-1234-1234-1234-123456789012',cursor_time:'2026-11-12 10:00:00.123456+00'};const cursor=encodeEntityCursor('created_desc',row);assert.equal(decodeEntityCursor(cursor,'created_desc')!.time,row.cursor_time);assert.throws(()=>decodeEntityCursor(cursor,'departure_asc'));assert.throws(()=>decodeEntityCursor('bad','created_desc'));assert.equal(entityOrder('ride',null),'departure_asc');assert.throws(()=>entityOrder('ride','arbitrary'));});
