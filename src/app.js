import { validate, buildTable } from './table.js';
import { createRunner } from './runner.js';
import { createSpeech } from './speech.js';

const $ = id => document.getElementById(id);
const FIELDS = ['start', 'step', 'hold'];
const speech = createSpeech();
let table = null;
let runner = null;
let wakeLock = null;

$('no-speech').hidden = speech.supported;

function renderTable() {
  $('rows').replaceChildren(...table.map(row => {
    const tr = document.createElement('tr');
    for (const value of [row.round, row.breathe, row.hold]) {
      const td = document.createElement('td');
      td.textContent = value;
      tr.append(td);
    }
    return tr;
  }));
}

function clearHighlight() {
  for (const el of $('rows').querySelectorAll('.cur, .on')) el.classList.remove('cur', 'on', 'b', 'h');
}

function highlight(phase) {
  clearHighlight();
  const tr = $('rows').children[phase.round - 1];
  tr.classList.add('cur');
  const breathe = phase.type === 'breathe';
  tr.children[breathe ? 1 : 2].classList.add('on', breathe ? 'b' : 'h');
}

function setPanel(label, secs, roundText) {
  $('panel').className = 'panel' + (label === 'BREATHE' ? ' b' : label === 'HOLD' ? ' h' : '');
  $('phase').textContent = label;
  $('secs').textContent = secs;
  $('round').textContent = roundText;
}

function showReady() {
  clearHighlight();
  setPanel('READY', table[0].breathe, `${table.length} rounds`);
}

function setRunning(on) {
  for (const f of FIELDS) $(f).disabled = on;
  $('build').disabled = on;
  $('toggle').disabled = !table;
  $('toggle').textContent = on ? '정지' : '시작';
  $('toggle').classList.toggle('stop', on);
}

async function acquireWakeLock() {
  if (!navigator.wakeLock || (wakeLock && !wakeLock.released)) return;
  try {
    const lock = await navigator.wakeLock.request('screen');
    // 요청 중에 정지·완료됐으면 바로 놓는다.
    if (runner) wakeLock = lock;
    else lock.release();
  } catch {
    // 미지원·거부는 무시한다.
  }
}

function releaseWakeLock() {
  wakeLock?.release().catch(() => {});
  wakeLock = null;
}

function start() {
  runner = createRunner(table, {
    now: () => performance.now(),
    setTimer: (fn, ms) => setTimeout(fn, ms),
    clearTimer: id => clearTimeout(id),
    speak: text => speech.speak(text),
    onPhase: (i, phase) => highlight(phase),
    onTick: ({ phase, remaining }) =>
      setPanel(phase.type === 'breathe' ? 'BREATHE' : 'HOLD', remaining, `Round ${phase.round} / ${table.length}`),
    onComplete: finish,
  });
  setRunning(true);
  acquireWakeLock();
  runner.start(); // 동기 — 첫 발화가 클릭 핸들러 안에서 일어나야 iOS가 허용한다.
}

function stop() {
  runner.stop();
  runner = null;
  speech.cancel();
  releaseWakeLock();
  setRunning(false);
  showReady();
}

function finish() {
  // 종료 멘트가 잘리지 않도록 speech.cancel()은 부르지 않는다.
  runner = null;
  releaseWakeLock();
  setRunning(false);
  clearHighlight();
  setPanel('DONE', '0', `${table.length} rounds`);
}

$('build').addEventListener('click', () => {
  const result = validate(Object.fromEntries(FIELDS.map(f => [f, $(f).value])));
  for (const f of FIELDS) $(`err-${f}`).textContent = result.errors[f] ?? '';
  if (!result.ok) return;
  table = buildTable(result.values);
  renderTable();
  showReady();
  setRunning(false);
});

$('toggle').addEventListener('click', () => (runner ? stop() : start()));

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && runner) acquireWakeLock();
});
