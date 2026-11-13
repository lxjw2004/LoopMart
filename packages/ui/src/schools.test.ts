import test from 'node:test';
import assert from 'node:assert/strict';
import { schools, matchesSchool } from './schools.js';

test('school search matches partial names, mixed case, punctuation and abbreviations', () => {
  assert.deepEqual(schools.map(s => s.name), ['Purdue University - West Lafayette']);
  for (const query of ['', '  ', 'pUrDuE', 'west laf', 'Lafayette Purdue', 'Purdue-University', 'p u w l', 'puwl']) {
    assert.equal(matchesSchool(schools[0], query), true, query);
  }
});

test('school search excludes unrelated names', () => {
  for (const query of ['Indiana', 'Northwest', 'xyz', 'Purdue Chicago', '清华']) {
    assert.equal(matchesSchool(schools[0], query), false, query);
  }
});
