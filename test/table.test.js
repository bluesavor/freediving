import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate, buildTable, MIN_BREATHE, MAX_SECONDS } from '../src/table.js';

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

test('MAX_SECONDS is 3600', () => {
  assert.equal(MAX_SECONDS, 3600);
});

test('validate accepts the maximum', () => {
  assert.equal(validate({ start: '3600', step: '3600', hold: '3600' }).ok, true);
});

test('validate rejects values above the maximum', () => {
  const r = validate({ start: '3601', step: '3601', hold: '3601' });
  assert.equal(r.ok, false);
  assert.deepEqual(r.errors, {
    start: '3600초 이하여야 합니다',
    step: '3600초 이하여야 합니다',
    hold: '3600초 이하여야 합니다',
  });
});

test('validate rejects absurdly long digit strings', () => {
  const r = validate({ start: '9'.repeat(400), step: '15', hold: '60' });
  assert.equal(r.ok, false);
  assert.deepEqual(r.errors, { start: '3600초 이하여야 합니다' });
});
