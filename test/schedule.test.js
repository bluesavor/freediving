import { test } from 'node:test';
import assert from 'node:assert/strict';
import { phases, announcements, cueText, COMPLETE_TEXT, COUNTDOWN_MARKS } from '../src/schedule.js';

const ats = d => announcements({ round: 1, type: 'hold', duration: d }).map(a => a.at);

test('constants', () => {
  assert.equal(COMPLETE_TEXT, 'Table complete. Well done.');
  assert.deepEqual(COUNTDOWN_MARKS, [60, 30, 15, 10, 5, 4, 3, 2, 1]);
});

test('phases alternate breathe/hold per row', () => {
  const p = phases([
    { round: 1, breathe: 30, hold: 20 },
    { round: 2, breathe: 15, hold: 20 },
  ]);
  assert.deepEqual(p, [
    { round: 1, type: 'breathe', duration: 30 },
    { round: 1, type: 'hold', duration: 20 },
    { round: 2, type: 'breathe', duration: 15 },
    { round: 2, type: 'hold', duration: 20 },
  ]);
});

test('announcement points skip marks >= duration', () => {
  assert.deepEqual(ats(120), [120, 60, 30, 15, 10, 5, 4, 3, 2, 1]);
  assert.deepEqual(ats(60), [60, 30, 15, 10, 5, 4, 3, 2, 1]);
  assert.deepEqual(ats(45), [45, 30, 15, 10, 5, 4, 3, 2, 1]);
  assert.deepEqual(ats(15), [15, 10, 5, 4, 3, 2, 1]);
  assert.deepEqual(ats(5), [5, 4, 3, 2, 1]);
});

test('announcement texts and kinds', () => {
  const a = announcements({ round: 3, type: 'breathe', duration: 90 });
  assert.deepEqual(a[0], { at: 90, text: 'Round 3. Breathe. 90 seconds.', kind: 'start' });
  assert.deepEqual(a.find(x => x.at === 30), { at: 30, text: '30 seconds', kind: 'mark' });
  assert.deepEqual(a.find(x => x.at === 3), { at: 3, text: '3', kind: 'mark' });
  assert.equal(announcements({ round: 1, type: 'hold', duration: 60 })[0].text, 'Hold. 60 seconds.');
});

test('duration 1 → singular start announcement only', () => {
  assert.deepEqual(announcements({ round: 1, type: 'hold', duration: 1 }), [
    { at: 1, text: 'Hold. 1 second.', kind: 'start' },
  ]);
});

test('cueText', () => {
  assert.equal(cueText({ round: 2, type: 'breathe', duration: 30 }), 'Round 2. Breathe.');
  assert.equal(cueText({ round: 2, type: 'hold', duration: 30 }), 'Hold.');
});
