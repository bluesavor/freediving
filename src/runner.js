import { phases, announcements, cueText, COMPLETE_TEXT } from './schedule.js';

export const TICK_MS = 200;

export function createRunner(table, { now, setTimer, clearTimer, speak, onTick, onPhase, onComplete }) {
  const list = phases(table);
  let index = -1;
  let phaseEnd = 0;
  let pending = [];
  let timer = null;
  let running = false;

  function enter(i, startAt) {
    index = i;
    phaseEnd = startAt + list[i].duration * 1000;
    pending = announcements(list[i]);
    onPhase(i, list[i]);
  }

  function tick() {
    timer = null;
    const t = now();

    // 다음 단계 시작 시각은 이전 단계의 종료 시각 — 오차가 누적되지 않는다.
    while (Math.ceil((phaseEnd - t) / 1000) <= 0) {
      if (index === list.length - 1) {
        running = false;
        speak(COMPLETE_TEXT);
        onComplete();
        return;
      }
      enter(index + 1, phaseEnd);
    }

    const remaining = Math.ceil((phaseEnd - t) / 1000);
    let text = null;
    let missedStart = false;
    while (pending.length && pending[0].at >= remaining) {
      const a = pending.shift();
      if (a.at === remaining) text = a.text;
      else if (a.kind === 'start') missedStart = true;
    }
    // 틱이 늦어 시작 멘트를 놓쳤으면 현재 단계를 짧게 알린다.
    if (missedStart) text = cueText(list[index]);
    if (text) speak(text);

    onTick({ phaseIndex: index, phase: list[index], remaining });
    if (running) timer = setTimer(tick, TICK_MS);
  }

  return {
    start() {
      if (running) return;
      running = true;
      enter(0, now());
      tick();
    },
    stop() {
      running = false;
      if (timer !== null) clearTimer(timer);
      timer = null;
    },
  };
}
