const lang = v => v.lang.replace('_', '-');
const baseName = v => v.name.split(' (')[0];

// 자연스러운 영어 음성을 이름으로 먼저 찾는다.
const PREFERRED = [
  'Samantha', 'Alex', 'Ava', 'Allison', 'Susan', 'Tom',
  'Google US English', 'Microsoft Aria', 'Microsoft Jenny', 'Microsoft Zira',
];
// macOS·iOS는 en-US로 표시된 장난감·로봇 음성을 알파벳순으로 먼저 내놓는다.
const NOVELTY = new Set([
  'Albert', 'Bad News', 'Bahh', 'Bells', 'Boing', 'Bubbles', 'Cellos', 'Good News', 'Jester',
  'Organ', 'Superstar', 'Trinoids', 'Whisper', 'Wobble', 'Zarvox', 'Fred', 'Junior', 'Kathy',
  'Ralph', 'Eddy', 'Flo', 'Grandma', 'Grandpa', 'Reed', 'Rocko', 'Sandy', 'Shelley',
]);

const matches = (v, name) => v.name === name || v.name.startsWith(`${name} `);
const englishVoices = voices => voices.filter(v => lang(v).startsWith('en-') && !NOVELTY.has(baseName(v)));

function pickVoice(english) {
  for (const name of PREFERRED) {
    const v = english.find(v => matches(v, name));
    if (v) return v;
  }
  return (
    english.find(v => lang(v) === 'en-US' && v.localService) ||
    english.find(v => lang(v) === 'en-US') ||
    english[0] ||
    null
  );
}

// PREFERRED 순서대로 먼저, 나머지는 이름순.
function sortVoices(english) {
  const rank = v => {
    const i = PREFERRED.findIndex(name => matches(v, name));
    return i === -1 ? PREFERRED.length : i;
  };
  return [...english].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}

export function createSpeech(win = globalThis) {
  const synth = win.speechSynthesis;
  if (!synth || !win.SpeechSynthesisUtterance) {
    return { supported: false, speak() {}, cancel() {}, listVoices: () => [], setVoice() {}, onVoicesChange() {} };
  }

  let voice = null;
  let requested = null;
  const listeners = [];

  // 요청한 이름이 있으면 그 음성, 없거나 못 찾으면 자동 선택.
  function resolve() {
    const english = englishVoices(synth.getVoices());
    voice = (requested && english.find(v => v.name === requested)) || pickVoice(english);
  }
  resolve();
  // 일부 브라우저는 음성 목록을 늦게 채운다.
  synth.addEventListener?.('voiceschanged', () => {
    resolve();
    for (const fn of listeners) fn();
  });

  return {
    supported: true,
    speak(text) {
      // 불필요한 cancel()은 iOS·Chrome에서 다음 발화를 삼킬 수 있다.
      if (synth.speaking || synth.pending) synth.cancel();
      const u = new win.SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      if (voice) u.voice = voice;
      synth.speak(u);
    },
    cancel() {
      synth.cancel();
    },
    listVoices() {
      return sortVoices(englishVoices(synth.getVoices()))
        .map(v => ({ name: v.name, lang: lang(v), local: v.localService === true }));
    },
    setVoice(name) {
      requested = name || null;
      resolve();
    },
    onVoicesChange(fn) {
      listeners.push(fn);
    },
  };
}
