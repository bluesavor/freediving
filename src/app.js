import { validate, buildTable } from './table.js';
import { createRunner } from './runner.js';
import { createSpeech } from './speech.js';

const $ = id => document.getElementById(id);
const FIELDS = ['start', 'step', 'hold'];
const VOICE_KEY = 'co2-table.voice';
const speech = createSpeech();
let table = null;
let runner = null;
let wakeLock = null;
let wakeLockPending = null;

$('no-speech').hidden = speech.supported;
$('voice-row').hidden = !speech.supported;

// 저장소는 사생활 보호 모드 등에서 던질 수 있어 실패는 무시한다.
function savedVoice() {
  try {
    return localStorage.getItem(VOICE_KEY) ?? '';
  } catch {
    return '';
  }
}

function saveVoice(name) {
  try {
    if (name) localStorage.setItem(VOICE_KEY, name);
    else localStorage.removeItem(VOICE_KEY);
  } catch {
    // 무시
  }
}

function renderVoices() {
  const auto = document.createElement('option');
  auto.value = '';
  auto.textContent = '자동 (추천)';
  const voices = speech.listVoices();
  const options = voices.map(v => {
    const o = document.createElement('option');
    o.value = v.name;
    o.textContent = v.local ? v.name : `${v.name} · 온라인`;
    return o;
  });
  $('voice').replaceChildren(auto, ...options);
  // 기기에 없는 저장값은 자동으로 되돌린다.
  const saved = savedVoice();
  const value = voices.some(v => v.name === saved) ? saved : '';
  $('voice').value = value;
  speech.setVoice(value || null);
}

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
  $('voice').disabled = on;
  $('preview').disabled = on;
  $('toggle').disabled = !table;
  $('toggle').textContent = on ? '정지' : '시작';
  $('toggle').classList.toggle('stop', on);
}

async function acquireWakeLock() {
  // 요청 중이거나 이미 잡고 있으면 중복 요청하지 않는다.
  if (!navigator.wakeLock || wakeLockPending || (wakeLock && !wakeLock.released)) return;
  try {
    wakeLockPending = navigator.wakeLock.request('screen');
    const lock = await wakeLockPending;
    // 요청 중에 정지·완료됐으면 바로 놓는다.
    if (runner) wakeLock = lock;
    else lock.release();
  } catch {
    // 미지원·거부는 무시한다.
  } finally {
    wakeLockPending = null;
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

$('voice').addEventListener('change', () => {
  const name = $('voice').value;
  speech.setVoice(name || null);
  saveVoice(name);
});

$('preview').addEventListener('click', () => speech.speak('Round 1. Breathe. 120 seconds.'));

renderVoices();
speech.onVoicesChange(renderVoices);

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && runner) acquireWakeLock();
});
