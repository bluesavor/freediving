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

function pickVoice(voices) {
  const english = voices.filter(v => lang(v).startsWith('en-') && !NOVELTY.has(baseName(v)));
  for (const name of PREFERRED) {
    const v = english.find(v => v.name === name || v.name.startsWith(`${name} `));
    if (v) return v;
  }
  return (
    english.find(v => lang(v) === 'en-US' && v.localService) ||
    english.find(v => lang(v) === 'en-US') ||
    english[0] ||
    null
  );
}

export function createSpeech(win = globalThis) {
  const synth = win.speechSynthesis;
  if (!synth || !win.SpeechSynthesisUtterance) {
    return { supported: false, speak() {}, cancel() {} };
  }

  let voice = pickVoice(synth.getVoices());
  // 일부 브라우저는 음성 목록을 늦게 채운다.
  synth.addEventListener?.('voiceschanged', () => {
    voice = pickVoice(synth.getVoices());
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
  };
}
