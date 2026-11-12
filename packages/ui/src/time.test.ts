import test from 'node:test';
import assert from 'node:assert/strict';
import {departureInstant,departureLocal} from './time';
test('departure wall-clock respects chosen zone rather than browser timezone',()=>{assert.equal(departureInstant('2026-11-12T09:30','America/Indiana/Indianapolis'),'2026-11-12T14:30:00.000Z');assert.equal(departureLocal('2026-11-12T14:30:00.000Z','America/Indiana/Indianapolis'),'2026-11-12T09:30')});
test('rejects nonexistent daylight saving time',()=>{assert.throws(()=>departureInstant('2026-03-08T02:30','America/New_York'),/does not exist/)});
