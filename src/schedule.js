export const COUNTDOWN_MARKS = [60, 30, 15, 10, 5, 4, 3, 2, 1];
export const COMPLETE_TEXT = 'Table complete. Well done.';

export function phases(table) {
  return table.flatMap(row => [
    { round: row.round, type: 'breathe', duration: row.breathe },
    { round: row.round, type: 'hold', duration: row.hold },
  ]);
}

export function cueText(phase) {
  return phase.type === 'breathe' ? `Round ${phase.round}. Breathe.` : 'Hold.';
}

const seconds = n => (n === 1 ? '1 second' : `${n} seconds`);

export function announcements(phase) {
  const start = { at: phase.duration, text: `${cueText(phase)} ${seconds(phase.duration)}.`, kind: 'start' };
  const marks = COUNTDOWN_MARKS
    .filter(m => m < phase.duration)
    .map(m => ({ at: m, text: m > 5 ? `${m} seconds` : String(m), kind: 'mark' }));
  return [start, ...marks];
}
