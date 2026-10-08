import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate, buildTable, MIN_BREATHE } from '../src/table.js';

test('MIN_BREATHE is 15', () => {
  assert.equal(MIN_BREATHE, 15);
});

test('buildTable 120/15/60 → 8 rows down to 15', () => {
  const t = buildTable({ start: 120, step: 15, hold: 60 });
  assert.deepEqual(t.map(r => r.breathe), [120, 105, 90, 75, 60, 45, 30, 15]);
  assert.deepEqual(t.map(r => r.round), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.ok(t.every(r => r.hold === 60));
});

test('buildTable 100/30 stops before going under 15', () => {
  const t = buildTable({ start: 100, step: 30, hold: 60 });
  assert.deepEqual(t.map(r => r.breathe), [100, 70, 40]);
});

test('buildTable start 15 → 1 row', () => {
  assert.deepEqual(buildTable({ start: 15, step: 5, hold: 30 }), [{ round: 1, breathe: 15, hold: 30 }]);
});

test('buildTable step larger than start → 1 row', () => {
  assert.deepEqual(buildTable({ start: 20, step: 100, hold: 30 }), [{ round: 1, breathe: 20, hold: 30 }]);
});

test('validate accepts surrounding spaces and leading zeros', () => {
  const r = validate({ start: ' 120 ', step: '0015', hold: 60 });
  assert.equal(r.ok, true);
  assert.deepEqual(r.values, { start: 120, step: 15, hold: 60 });
  assert.deepEqual(r.errors, {});
});

test('validate rejects non-integers', () => {
  for (const bad of ['', '1.5', 'abc', '-5', '+5', undefined]) {
    const r = validate({ start: bad, step: '15', hold: '60' });
    assert.equal(r.ok, false, `input ${JSON.stringify(bad)}`);
    assert.deepEqual(r.errors, { start: '정수를 입력하세요' });
  }
});

test('validate enforces ranges per field', () => {
  const r = validate({ start: '14', step: '0', hold: '0' });
  assert.equal(r.ok, false);
  assert.deepEqual(r.errors, {
    start: '15초 이상이어야 합니다',
    step: '1초 이상이어야 합니다',
    hold: '1초 이상이어야 합니다',
  });
});
