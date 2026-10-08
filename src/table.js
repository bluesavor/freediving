export const MIN_BREATHE = 15;
export const MAX_SECONDS = 3600;

const INTEGER = /^\d+$/;

const RULES = [
  ['start', MIN_BREATHE, '15초 이상이어야 합니다'],
  ['step', 1, '1초 이상이어야 합니다'],
  ['hold', 1, '1초 이상이어야 합니다'],
];

function parseInteger(value) {
  const text = String(value ?? '').trim();
  return INTEGER.test(text) ? Number(text) : null;
}

export function validate(raw) {
  const values = {};
  const errors = {};
  for (const [key, min, message] of RULES) {
    const n = parseInteger(raw[key]);
    if (n === null) errors[key] = '정수를 입력하세요';
    else if (n < min) errors[key] = message;
    else if (n > MAX_SECONDS) errors[key] = `${MAX_SECONDS}초 이하여야 합니다`;
    else values[key] = n;
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, values, errors };
}

export function buildTable({ start, step, hold }) {
  const rows = [];
  for (let breathe = start; breathe >= MIN_BREATHE; breathe -= step) {
    rows.push({ round: rows.length + 1, breathe, hold });
  }
  return rows;
}
