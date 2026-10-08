import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSpeech } from '../src/speech.js';

function fakeWin(voices = []) {
  const calls = [];
  const listeners = {};
  const synth = {
    voices,
    speaking: false,
    pending: false,
    getVoices() { return this.voices; },
    speak: u => calls.push(['speak', u]),
    cancel: () => calls.push(['cancel']),
    addEventListener: (name, fn) => { listeners[name] = fn; },
  };
  class Utterance { constructor(text) { this.text = text; } }
  return { win: { speechSynthesis: synth, SpeechSynthesisUtterance: Utterance }, synth, calls, listeners };
}

const voice = (name, lang, localService = false) => ({ name, lang, localService });

test('unsupported browser → supported=false and no-op methods', () => {
  const s = createSpeech({});
  assert.equal(s.supported, false);
  s.speak('x');
  s.cancel();
});

test('prefers local en-US, sets lang en-US', () => {
  const local = voice('Samantha', 'en-US', true);
  const { win, calls } = fakeWin([voice('Daniel', 'en-GB'), voice('Google US', 'en-US'), local]);
  createSpeech(win).speak('Hold.');
  const [, u] = calls[0];
  assert.equal(u.text, 'Hold.');
  assert.equal(u.lang, 'en-US');
  assert.equal(u.voice, local);
});

test('underscore lang (Android) is recognised', () => {
  const v = voice('Android', 'en_US');
  const { win, calls } = fakeWin([voice('Korean', 'ko-KR'), v]);
  createSpeech(win).speak('1');
  assert.equal(calls[0][1].voice, v);
});

test('falls back to any English voice, then to none', () => {
  const gb = voice('Daniel', 'en-GB');
  const a = fakeWin([voice('Korean', 'ko-KR'), gb]);
  createSpeech(a.win).speak('1');
  assert.equal(a.calls[0][1].voice, gb);

  const b = fakeWin([voice('Korean', 'ko-KR')]);
  createSpeech(b.win).speak('1');
  assert.equal(b.calls[0][1].voice, undefined);
  assert.equal(b.calls[0][1].lang, 'en-US');
});

test('cancels only when something is speaking or pending', () => {
  const { win, synth, calls } = fakeWin();
  const s = createSpeech(win);
  s.speak('a');
  assert.deepEqual(calls.map(c => c[0]), ['speak']);
  synth.speaking = true;
  s.speak('b');
  assert.deepEqual(calls.map(c => c[0]), ['speak', 'cancel', 'speak']);
});

test('re-picks the voice on voiceschanged', () => {
  const { win, synth, calls, listeners } = fakeWin([]);
  const s = createSpeech(win);
  const v = voice('Samantha', 'en-US', true);
  synth.voices = [v];
  listeners.voiceschanged();
  s.speak('x');
  assert.equal(calls[0][1].voice, v);
});
