// 10단계: 지금의 안전 정책을 검증한 사본(policy-backups/verified)으로 찍어 두고,
// 그 사본을 복사한 시험용 사본(policy-backups/test-copy)에서 규칙 한 줄만 일부러 바꿉니다(침공 흉내).
// 실제 운영 정책(src/decider.mjs, aleph.config.json, DB)은 읽기만 하고 바꾸지 않습니다.
//
// 실행: npm run policy:backup -- --db <DB 정책 내보내기 JSON 파일>
//   DB 정책 JSON은 Supabase > SQL Editor에서 db-policy-export.sql을 실행한 결과입니다.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalize, verifySnapshot, writeSnapshot } from '../src/policy-snapshot.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
export const VERIFIED_DIR = resolve(root, 'policy-backups/verified');
export const TEST_DIR = resolve(root, 'policy-backups/test-copy');

// 시험용 사본에서 바꿀 한 줄: 읽기(GET)만 허용하던 규칙에 지우기(DELETE)를 더합니다.
export const TEST_CHANGE = Object.freeze({
  file: 'decider.mjs',
  from: "const METHODS = new Set(['GET']);",
  to: "const METHODS = new Set(['GET', 'DELETE']);",
  note: '침공 흉내: 읽기만 허용하던 METHODS에 DELETE를 더함',
});

function stop(message) {
  console.error(`중단: ${message}`);
  process.exit(1);
}

function git(...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

// SQL Editor 결과를 어떤 모양으로 붙여도 { schema, tables } 하나를 꺼냅니다.
export function readDbPolicy(text) {
  let value;
  try { value = JSON.parse(text); } catch { throw new Error('DB 정책 파일이 JSON이 아닙니다.'); }
  if (Array.isArray(value) && value.length === 1) value = value[0];
  if (value && typeof value === 'object' && 'db_policy' in value) value = value.db_policy;
  if (typeof value === 'string') { try { value = JSON.parse(value); } catch { /* 아래에서 거절 */ } }
  if (!value || value.schema !== 'public' || !Array.isArray(value.tables) || value.tables.length === 0) {
    throw new Error('DB 정책 파일에 public 스키마의 표 목록(tables)이 없습니다.');
  }
  const flat = JSON.stringify(value);
  if (/eyJ[A-Za-z0-9_-]{10,}|sb_(secret|publishable)_/.test(flat)) {
    throw new Error('DB 정책 파일에 키나 토큰처럼 보이는 값이 있어 사본에 넣지 않습니다.');
  }
  return value;
}

function main() {
  const dbIndex = process.argv.indexOf('--db');
  const dbPath = dbIndex > 0 ? process.argv[dbIndex + 1] : undefined;
  if (!dbPath) stop('DB 정책 파일을 --db 뒤에 적어 주세요.');
  if (!existsSync(dbPath)) stop(`DB 정책 파일이 없습니다: ${dbPath}`);
  let dbPolicy;
  try { dbPolicy = readDbPolicy(readFileSync(dbPath, 'utf8')); } catch (error) { stop(error.message); }

  // 검증한 사본은 커밋된 정책만 찍습니다. 커밋 안 된 수정이 있으면 멈춥니다.
  const sources = ['src/decider.mjs', 'aleph.config.json'];
  if (git('status', '--porcelain', '--', ...sources)) stop(`${sources.join(', ')}에 커밋하지 않은 수정이 있습니다.`);
  if (existsSync(VERIFIED_DIR)) stop('검증한 사본이 이미 있습니다. 덮어쓰지 않습니다: policy-backups/verified');

  const commit = git('rev-parse', 'HEAD');
  const config = JSON.parse(readFileSync(resolve(root, 'aleph.config.json'), 'utf8'));
  if (!Array.isArray(config.allowedRoutes)) stop('aleph.config.json에 allowedRoutes가 없습니다.');
  const contents = {
    'decider.mjs': readFileSync(resolve(root, 'src/decider.mjs'), 'utf8'),
    'allowed-routes.json': `${JSON.stringify({ allowedRoutes: config.allowedRoutes }, null, 2)}\n`,
    'db-policy.json': `${JSON.stringify(dbPolicy, null, 2)}\n`,
  };
  const verified = writeSnapshot(VERIFIED_DIR, contents, {
    kind: 'verified', step: config.step, commit, createdAt: new Date().toISOString(),
    sources: { 'decider.mjs': 'src/decider.mjs', 'allowed-routes.json': 'aleph.config.json allowedRoutes',
      'db-policy.json': 'Supabase public 스키마 RLS·정책·권한(읽기 전용 내보내기)' },
  });

  // 시험용 사본: 검증한 사본을 다시 검증해 읽은 뒤, 정해진 한 줄만 바꿉니다.
  const { texts } = verifySnapshot(VERIFIED_DIR, { label: '검증한 사본' });
  const target = normalize(texts[TEST_CHANGE.file]);
  if (target.split(TEST_CHANGE.from).length !== 2) stop(`시험용으로 바꿀 줄을 정확히 한 곳에서 찾지 못했습니다: ${TEST_CHANGE.from}`);
  const test = writeSnapshot(TEST_DIR, { ...texts, [TEST_CHANGE.file]: target.replace(TEST_CHANGE.from, TEST_CHANGE.to) }, {
    kind: 'test', basedOn: verified.snapshotSha256, createdAt: new Date().toISOString(), change: TEST_CHANGE,
  });

  console.log('검증한 사본: policy-backups/verified');
  console.log(`  커밋 ${commit.slice(0, 7)}, 단계 ${config.step}, 전체 해시 ${verified.snapshotSha256}`);
  for (const f of verified.files) console.log(`  ${f.name}  ${f.sha256}`);
  console.log('시험용 사본: policy-backups/test-copy');
  console.log(`  바꾼 한 줄: ${TEST_CHANGE.file} — ${TEST_CHANGE.note}`);
  console.log(`  전체 해시 ${test.snapshotSha256}`);
  console.log('실제 src/decider.mjs, aleph.config.json, DB는 바꾸지 않았습니다.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
