import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRunner, TICK_MS } from '../src/runner.js';
import { COMPLETE_TEXT } from '../src/schedule.js';

// 가짜 시계: advance(ms)는 그 사이 예약된 타이머를 시간순으로 실행하고,
// jump(ms)는 시계를 건너뛴 뒤 밀린 타이머 하나만 늦게 실행한다(백그라운드 복귀 흉내).
function harness(table, { jitter = () => 0 } = {}) {
  let t = 0;
  let nextId = 0;
  const timers = new Map();
  const log = [];
  const runner = createRunner(table, {
    now: () => t,
    setTimer: (fn, ms) => {
      const id = ++nextId;
      timers.set(id, { fn, at: t + ms + jitter() });
      return id;
    },
    clearTimer: id => timers.delete(id),
    speak: text => log.push(['speak', text]),
    onTick: ({ phaseIndex, remaining }) => log.push(['tick', phaseIndex, remaining]),
    onPhase: (i, phase) => log.push(['phase', i, phase.type]),
    onComplete: () => log.push(['complete']),
  });
  const fireNext = () => {
    const [id, timer] = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
    timers.delete(id);
    t = Math.max(t, timer.at);
    timer.fn();
  };
  return {
    runner,
    log,
    advance(ms) {
      const end = t + ms;
      while (timers.size && Math.min(...[...timers.values()].map(x => x.at)) <= end) fireNext();
      t = end;
    },
    jump(ms) {
      t += ms;
      if (timers.size) fireNext();
    },
    speeches: () => log.filter(e => e[0] === 'speak').map(e => e[1]),
    count: kind => log.filter(e => e[0] === kind).length,
    pendingTimers: () => timers.size,
  };
}

const ONE_ROW = [{ round: 1, breathe: 15, hold: 10 }];
const ONE_ROW_SPEECH = [
  'Round 1. Breathe. 15 seconds.', '10 seconds', '5', '4', '3', '2', '1',
  'Hold. 10 seconds.', '5', '4', '3', '2', '1',
  COMPLETE_TEXT,
];

test('TICK_MS is 200', () => {
  assert.equal(TICK_MS, 200);
});

test('start() is synchronous: phase, start announcement, tick', () => {
  const h = harness(ONE_ROW);
  h.runner.start();
  assert.deepEqual(h.log, [
    ['phase', 0, 'breathe'],
    ['speak', 'Round 1. Breathe. 15 seconds.'],
    ['tick', 0, 15],
  ]);
});

test('full run speaks every announcement once, then completes', () => {
  const h = harness(ONE_ROW);
  h.runner.start();
  h.advance(30000);
  assert.deepEqual(h.speeches(), ONE_ROW_SPEECH);
  assert.deepEqual(h.log.filter(e => e[0] === 'phase'), [['phase', 0, 'breathe'], ['phase', 1, 'hold']]);
  assert.equal(h.count('complete'), 1);
  assert.equal(h.pendingTimers(), 0);
});

test('tick jitter does not drop or repeat announcements', () => {
  const offsets = [0, 137, 333, 499, 71, 650];
  let k = 0;
  const h = harness([{ round: 1, breathe: 75, hold: 20 }], { jitter: () => offsets[k++ % offsets.length] });
  h.runner.start();
  h.advance(120000);
  assert.deepEqual(h.speeches(), [
    'Round 1. Breathe. 75 seconds.', '60 seconds', '30 seconds', '15 seconds', '10 seconds',
    '5', '4', '3', '2', '1',
    'Hold. 20 seconds.', '15 seconds', '10 seconds', '5', '4', '3', '2', '1',
    COMPLETE_TEXT,
  ]);
});

test('at most one speak per tick and remaining is always >= 1', () => {
  const offsets = [0, 137, 333, 499, 71, 650];
  let k = 0;
  const h = harness([{ round: 1, breathe: 30, hold: 15 }, { round: 2, breathe: 15, hold: 15 }], {
    jitter: () => offsets[k++ % offsets.length],
  });
  h.runner.start();
  h.advance(120000);
  let speaksSinceTick = 0;
  for (const e of h.log) {
    if (e[0] === 'speak') {
      speaksSinceTick++;
      if (e[1] !== COMPLETE_TEXT) assert.ok(speaksSinceTick <= 1, 'two speaks in one tick');
    }
    if (e[0] === 'tick') {
      assert.ok(e[2] >= 1, `remaining ${e[2]}`);
      speaksSinceTick = 0;
    }
  }
});

test('jump within a phase skips missed marks silently', () => {
  const h = harness([{ round: 1, breathe: 60, hold: 20 }]);
  h.runner.start();
  h.advance(1000);
  h.jump(40000); // t=41000, remaining 19 → '30 seconds' was missed
  h.advance(60000);
  assert.deepEqual(h.speeches().slice(0, 3), ['Round 1. Breathe. 60 seconds.', '15 seconds', '10 seconds']);
  assert.ok(!h.speeches().includes('30 seconds'));
});

test('jump into the middle of hold speaks the short cue once', () => {
  const h = harness([{ round: 1, breathe: 20, hold: 30 }]);
  h.runner.start();
  h.jump(25000); // hold ends at 50000 → remaining 25, start announcement missed
  h.advance(30000);
  assert.deepEqual(h.speeches(), [
    'Round 1. Breathe. 20 seconds.', 'Hold.',
    '15 seconds', '10 seconds', '5', '4', '3', '2', '1',
    COMPLETE_TEXT,
  ]);
});

test('multi-phase skip calls onPhase for each phase in order', () => {
  const h = harness([{ round: 1, breathe: 20, hold: 10 }, { round: 2, breathe: 15, hold: 10 }]);
  h.runner.start();
  h.jump(40000); // phase 2 (R2 breathe) ends at 45000 → remaining 5
  assert.deepEqual(h.log.filter(e => e[0] === 'phase'), [
    ['phase', 0, 'breathe'], ['phase', 1, 'hold'], ['phase', 2, 'breathe'],
  ]);
  assert.deepEqual(h.speeches(), ['Round 1. Breathe. 20 seconds.', 'Round 2. Breathe.']);
  h.advance(1100);
  assert.deepEqual(h.speeches().slice(2), ['4']);
});

test('jump past the end completes exactly once', () => {
  const h = harness(ONE_ROW);
  h.runner.start();
  h.jump(100000);
  assert.deepEqual(h.speeches(), ['Round 1. Breathe. 15 seconds.', COMPLETE_TEXT]);
  assert.equal(h.count('complete'), 1);
  assert.equal(h.pendingTimers(), 0);
  h.advance(10000);
  assert.equal(h.count('complete'), 1);
});

test('stop() silences every callback afterwards', () => {
  const h = harness(ONE_ROW);
  h.runner.start();
  h.advance(3000);
  h.runner.stop();
  const n = h.log.length;
  h.advance(60000);
  assert.equal(h.log.length, n);
  assert.equal(h.pendingTimers(), 0);
});

test('start twice is ignored', () => {
  const h = harness(ONE_ROW);
  h.runner.start();
  h.runner.start();
  assert.equal(h.count('phase'), 1);
  assert.equal(h.count('speak'), 1);
});
