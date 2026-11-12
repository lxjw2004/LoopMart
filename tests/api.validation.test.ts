import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate } from '../apps/api/src/validation.js';
const ride = { origin: 'Purdue', destination: 'Chicago', departureTime: '2026-11-15T10:00:00Z', timeZone: 'America/Indiana/Indianapolis', feeCents: 100, totalSeats: 3, availableSeats: 2 };
test('ride amounts, seat boundaries, UTC timestamps and IANA timezone are enforced', () => { validate('ride', ride); for (const patch of [{ feeCents: 1.1 }, { feeCents: -1 }, { totalSeats: 0 }, { availableSeats: 4 }, { availableSeats: 1.2 }, { timeZone: 'Mars/Central' }, { timeZone: '' }, { departureTime: '2026-11-15T10:00:00' }])
    assert.throws(() => validate('ride', { ...ride, ...patch })); });
