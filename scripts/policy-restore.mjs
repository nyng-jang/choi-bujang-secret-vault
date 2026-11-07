// 10단계: 검증한 안전 정책 버전으로 시험 정책(policy-backups/test-copy)을 되돌립니다.
// 실제 운영 정책(src/decider.mjs, aleph.config.json, DB)과 검증한 사본은 바꾸지 않습니다.
//
// 1) 미리 보기: npm run policy:restore
//    해시를 확인하고 복원할 버전, 바뀔 항목, 건드리지 않을 파일, 확인 코드만 보여 줍니다. 아무것도 쓰지 않습니다.
// 2) 실행:     npm run policy:restore -- --apply <확인 코드>
//    바뀐 줄만 되돌리고, policy-backups/audit.log에 한 줄을 덧붙인 뒤, 해시와 A·B 요청을 다시 확인합니다.
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { checkAccess } from '../src/access.mjs';
import { MANIFEST, restorePlan, revertLines, sha256, snapshotHash, verifySnapshot } from '../src/policy-snapshot.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const VERIFIED_DIR = resolve(root, 'policy-backups/verified');
const TARGET_DIR = resolve(root, 'policy-backups/test-copy');
const AUDIT_LOG = resolve(root, 'policy-backups/audit.log');

// 확인용 가상 사용자·메모입니다(실제 계정·메모 아님).
const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';
const NOTE_OF_A = '00000000-0000-4000-8000-0000000000a1';
const OWNER_ONLY = /^\(*\s*(\(\s*select\s+)?auth\.uid\(\)(\s+as\s+uid\s*\))?\s*=\s*owner_id\s*\)*$/i;

function request(subjectId, method) {
  return {
    schema: 'aleph.decision.v1', requestId: `restore-check-${subjectId.slice(-1)}-${method}`,
    classId: 'class_fixture', projectId: 'project_fixture', subjectId: `subject_${subjectId.slice(-1)}`,
    deviceId: '0123456789abcdef', service: 'notes', method,
    path: `/notes/${NOTE_OF_A}`, route: `${method} /notes/:id`, queryLength: 0,
    querySha256: sha256(''), at: new Date().toISOString(), policyRevision: 'restore-check',
    deviceRegistered: true, stepUp: { verified: false, authAgeSeconds: null }, recentEvents: [],
    signals: { source: 'none', region: 'unknown', network: 'unknown', hour: null },
  };
}

// DB 정책 사본에서 그 동작의 정책이 이 사용자에게 행을 보여 주는지 봅니다.
function dbAllows(dbPolicy, method, userId) {
  const notes = dbPolicy.tables.find((t) => t.table === 'notes');
  if (!notes || notes.rlsEnabled !== true) return { allowed: true, reason: 'rls_off' };
  const command = method === 'GET' ? 'SELECT' : method;
  const policies = notes.policies.filter((p) => p.command === command || p.command === 'ALL');
  if (!policies.length) return { allowed: false, reason: 'no_policy' };
  for (const p of policies) {
    const using = String(p.using ?? '').trim();
    if (/^\(*\s*true\s*\)*$/i.test(using)) return { allowed: true, reason: `${p.name}: everyone` };
    if (OWNER_ONLY.test(using) && userId === A) return { allowed: true, reason: `${p.name}: owner` };
  }
  return { allowed: false, reason: 'not_owner' };
}

// 사본의 판정기 + 자료 API의 주인 확인(src/access.mjs) + 사본의 DB 정책을 모두 통과해야 허용입니다.
export async function checkRequests(dir, texts) {
  const { decide } = await import(`${pathToFileURL(join(dir, 'decider.mjs')).href}?v=${sha256(texts['decider.mjs'])}`);
  const dbPolicy = JSON.parse(texts['db-policy.json']);
  const cases = [
    { name: 'A가 자기 메모 읽기', user: A, method: 'GET', expect: 'allow' },
    { name: 'B가 A 메모 읽기', user: B, method: 'GET', expect: 'deny' },
    { name: 'B가 A 메모 지우기', user: B, method: 'DELETE', expect: 'deny' },
  ];
  const results = [];
  for (const c of cases) {
    const decision = await decide(request(c.user, c.method));
    const api = await checkAccess({ user: { kind: 'student', userId: c.user }, resourceId: `notes/${NOTE_OF_A}`,
      method: c.method, ownerId: A, loadInstructor: async () => false });
    const db = dbAllows(dbPolicy, c.method, c.user);
    const result = decision.decision === 'allow' && api.allowed && db.allowed ? 'allow' : 'deny';
    results.push({ ...c, result, passed: result === c.expect,
      layers: `판정기 ${decision.decision}(${decision.ruleIds.join(',')}) · API ${api.allowed ? 'allow' : 'deny'}(${api.reason}) · DB ${db.allowed ? 'allow' : 'deny'}(${db.reason})` });
  }
  return results;
}

function stop(message) {
  console.error(`중단: ${message}`);
  console.error('아무것도 되돌리지 않았습니다.');
  process.exit(1);
}

function printPlan(verified, plan) {
  const v = verified.manifest;
  console.log(`복원할 버전: 검증한 사본 ${relative(root, VERIFIED_DIR)}`);
  console.log(`  커밋 ${String(v.commit).slice(0, 7)}, 단계 ${v.step}, 만든 시각 ${v.createdAt}`);
  console.log(`  전체 해시 ${v.snapshotSha256} (해시 확인 통과)`);
  console.log(`되돌릴 대상: 시험 정책 ${relative(root, TARGET_DIR)} (해시 확인 통과)`);
  console.log(`바뀔 항목: ${plan.files.length}개 파일`);
  for (const f of plan.files) {
    for (const c of f.changes) {
      console.log(c.type === '+' ? `  ${f.name} ${c.line}줄 빼기: ${c.text}` : `  ${f.name} 검증본 ${c.line}줄 되살리기: ${c.text}`);
    }
  }
  console.log(`건드리지 않을 파일: ${plan.untouched.length ? plan.untouched.join(', ') : '없음'}`);
  console.log('보존: 같은 파일의 다른 줄(다른 서비스 규칙), 검증한 사본, 감사 이력(audit.log), 실제 운영 정책');
}

async function main() {
  const applyIndex = process.argv.indexOf('--apply');
  const code = applyIndex > 0 ? process.argv[applyIndex + 1] : undefined;
  let verified;
  let target;
  try {
    verified = verifySnapshot(VERIFIED_DIR, { label: '검증한 사본' });
    if (verified.manifest.kind !== 'verified') throw new Error('기준 폴더가 검증한 사본이 아닙니다.');
    target = verifySnapshot(TARGET_DIR, { label: '시험 정책 사본' });
  } catch (error) { stop(error.message); }
  const plan = restorePlan(verified, target);
  printPlan(verified, plan);
  if (!plan.files.length) { console.log('되돌릴 것이 없습니다.'); return; }
  if (applyIndex < 0) {
    console.log(`확인 코드: ${plan.code}`);
    console.log(`위 항목이 맞으면 실행: npm run policy:restore -- --apply ${plan.code}`);
    return;
  }
  if (code !== plan.code) stop(`확인 코드가 지금 계획(${plan.code})과 다릅니다. 미리 보기를 다시 확인하세요.`);

  const before = target.manifest.snapshotSha256;
  for (const f of plan.files) {
    writeFileSync(join(TARGET_DIR, f.name), revertLines(verified.texts[f.name], target.texts[f.name]));
  }
  const files = target.manifest.files.map((f) => {
    const text = readFileSync(join(TARGET_DIR, f.name), 'utf8');
    return { ...f, sha256: sha256(text), bytes: Buffer.byteLength(text) };
  });
  const manifest = { ...target.manifest, files, snapshotSha256: snapshotHash(files),
    restoredFrom: verified.manifest.snapshotSha256, restoredAt: new Date().toISOString() };
  writeFileSync(join(TARGET_DIR, MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`);

  let after;
  try { after = verifySnapshot(TARGET_DIR, { label: '되돌린 시험 정책' }); } catch (error) { stop(error.message); }
  const same = plan.files.every((f) => sha256(after.texts[f.name]) === sha256(verified.texts[f.name]));
  const checks = await checkRequests(TARGET_DIR, after.texts);
  appendFileSync(AUDIT_LOG, `${JSON.stringify({
    at: manifest.restoredAt, action: 'restore', target: relative(root, TARGET_DIR).replaceAll('\\', '/'),
    from: verified.manifest.snapshotSha256, commit: verified.manifest.commit, code: plan.code,
    before, after: manifest.snapshotSha256,
    lines: plan.files.map((f) => ({ file: f.name, changes: f.changes.length })),
    hashMatchesVerified: same, checks: checks.map((c) => ({ name: c.name, result: c.result, passed: c.passed })),
  })}\n`);

  console.log('--- 되돌린 뒤 확인 ---');
  console.log(`되돌린 파일 해시가 검증한 사본과 같음: ${same ? '예' : '아니요'}`);
  for (const c of checks) console.log(`${c.passed ? '통과' : '확인 필요'} · ${c.name}: ${c.result} (기대 ${c.expect}) — ${c.layers}`);
  console.log('감사 이력 policy-backups/audit.log에 한 줄을 덧붙였습니다.');
  console.log('로컬 사본 확인이며 심판 판정이나 실제 배포 시험이 아닙니다.');
  if (!same || checks.some((c) => !c.passed)) process.exit(1);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
