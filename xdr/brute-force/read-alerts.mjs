// 확인용 읽기 모듈입니다. xdr/fixtures/brute-force.json 경보에서
// 시각·출발 주소·계정·규칙 수준·설명만 뽑아 한 줄씩 보여 줍니다.
// decide.mjs 는 이 파일을 불러오지 않습니다. 경보 원본은 읽기만 합니다.
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(here, '..', 'fixtures', 'brute-force.json');

// 비밀값처럼 보이는 모양은 출력하기 전에 *** 로 가립니다.
const SECRET_SHAPES = [
  /\b(password|passwd|pwd|token|secret|api[_-]?key|authorization)\b\s*[:=]\s*\S+/gi,
  /\beyJ[\w-]+\.[\w-]+\.[\w-]+/g, // JWT 모양
  /\bsb_(secret|publishable)_\w+/g, // Supabase 키 모양
  /\b[A-Za-z0-9+/_-]{32,}={0,2}/g, // 32자 넘게 이어진 키 모양 문자열
];

export function mask(value) {
  if (value === undefined || value === null) return '-';
  let text = String(value).replace(/[\t\r\n]+/g, ' ');
  for (const shape of SECRET_SHAPES) text = text.replace(shape, '***');
  return text;
}

export function pick(alert) {
  return {
    id: mask(alert.id),
    time: mask(alert.timestamp),
    srcip: mask(alert.data?.srcip),
    user: mask(alert.data?.srcuser),
    level: mask(alert.rule?.level),
    description: mask(alert.rule?.description),
  };
}

export async function readAlerts(file = FIXTURE) {
  const fixture = JSON.parse(await readFile(file, 'utf8'));
  if (!Array.isArray(fixture.alerts)) throw new Error('경보 묶음에 alerts 배열이 없습니다.');
  return { total: fixture.alerts.length, rows: fixture.alerts.map(pick) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { total, rows } = await readAlerts();
  console.log(['id', '시각', '출발 주소', '계정', '수준', '설명'].join('\t'));
  for (const row of rows) {
    console.log([row.id, row.time, row.srcip, row.user, row.level, row.description].join('\t'));
  }
  const same = total === rows.length;
  console.log(`경보 ${total}건, 뽑은 줄 ${rows.length}줄: ${same ? '같음' : '다름'}`);
  if (!same) process.exitCode = 1;
}
