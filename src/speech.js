const lang = v => v.lang.replace('_', '-');

function pickVoice(voices) {
  return (
    voices.find(v => lang(v) === 'en-US' && v.localService) ||
    voices.find(v => lang(v) === 'en-US') ||
    voices.find(v => lang(v).startsWith('en-')) ||
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
