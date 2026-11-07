// 12단계 탈환 작전실: 판정기 규칙·탐지 사건·회수 상태·복구 버전의 요약을 만듭니다.
// - 칸마다 state를 붙입니다: confirmed(서버가 실제로 읽은 값), not_run(이 자료실에서 실행·연결되지 않음),
//   unavailable(읽으려 했지만 실패). not_run 칸의 숫자는 지어내지 않고 0으로 둡니다.
// - 서버 기록은 가려서(records) 함께 돌려줍니다. 화면은 이 줄 수를 다시 세어 서버 수치와 맞는지 봅니다.
// - 메모 제목·본문은 읽지 않습니다(DB에서 public_id만 고릅니다). 사용자 ID·토큰·기기 비밀값·키도 넣지 않습니다.
import { readFileSync } from 'node:fs';
import { RULE_IDS } from './decider.mjs';
import { normalize, sha256 } from './policy-snapshot.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const RECORD_LIMIT = 100;
const ROOT = new URL('../', import.meta.url);

// 값의 앞 몇 글자만 남기고 나머지는 가립니다. 없으면 null.
export function mask(value, keep = 8) {
  if (typeof value !== 'string' || value === '') return null;
  return value.length <= keep ? '…' : `${value.slice(0, keep)}…`;
}

const readText = (path) => readFileSync(new URL(path, ROOT), 'utf8');
const errorCode = (error) => (typeof error?.code === 'string' ? error.code : 'unknown');

// 판정기 규칙: 배포된 src/decider.mjs의 RULE_IDS, 그리고 10단계 검증 사본과 지금 정책 파일의 해시 대조.
export function deciderSection({ config, files = { readText } }) {
  const section = {
    state: 'confirmed',
    source: 'src/decider.mjs RULE_IDS (배포된 코드)',
    count: RULE_IDS.length,
    records: RULE_IDS.map((id) => ({ ruleId: id })),
    judge: { state: 'not_run', reason: '심판 판정 결과는 이 자료실 서버에 기록이 없습니다. 포털에서 확인합니다.' },
  };
  try {
    const manifest = JSON.parse(files.readText('policy-backups/verified/manifest.json'));
    const expected = Object.fromEntries((manifest.files ?? []).map((f) => [f.name, f.sha256]));
    const deciderNow = sha256(normalize(files.readText('src/decider.mjs')));
    const routesNow = sha256(normalize(`${JSON.stringify({ allowedRoutes: config.allowedRoutes }, null, 2)}\n`));
    section.policy = {
      state: 'confirmed',
      source: 'policy-backups/verified/manifest.json',
      verifiedCommit: mask(manifest.commit, 7),
      verifiedSnapshot: mask(manifest.snapshotSha256),
      deciderMatchesVerified: deciderNow === expected['decider.mjs'],
      allowedRoutesMatchVerified: routesNow === expected['allowed-routes.json'],
      dbPolicy: { state: 'not_run', reason: 'DB 정책은 Supabase SQL Editor에서만 내보내므로 이 화면에서 대조하지 않습니다.' },
    };
  } catch (error) {
    section.policy = { state: 'unavailable', error: 'POLICY_COPY_UNREADABLE' };
  }
  return section;
}

// 탐지 사건: 운영 반 엔진이 사건을 보내 주는 길이 없으므로 미실행입니다.
export function detectionSection() {
  return {
    state: 'not_run',
    source: 'src/detect.mjs (burst_read)',
    reason: '운영 반 엔진의 사건 전달이 연결되지 않아 받은 사건이 없습니다. npm run detect:test는 가상 사건 연습입니다.',
    count: 0,
    proposals: 0,
    records: [],
  };
}

// 회수 상태: 이 사용자의 기기 승인 표(device_registrations)를 상태별로 셉니다.
export async function revocationSection({ supabase, user }) {
  const detectRevocation = { state: 'not_run', reason: '탐지에 따른 접속 회수 집행 경로가 없습니다(9단계는 회수 제안까지).' };
  if (user.kind !== 'student') {
    return { state: 'not_run', source: 'public.device_registrations', reason: '심판 요청은 운영 릴레이가 기기를 확인합니다.',
      count: 0, counts: { pending: 0, approved: 0, revoked: 0 }, records: [], detectRevocation };
  }
  const { data, error } = await supabase.from('device_registrations')
    .select('device_id, status, requested_at, approved_at')
    .eq('user_id', user.userId)
    .order('requested_at', { ascending: false })
    .limit(RECORD_LIMIT);
  if (error) return { state: 'unavailable', source: 'public.device_registrations', error: errorCode(error), detectRevocation };
  const rows = data ?? [];
  const counts = { pending: 0, approved: 0, revoked: 0 };
  for (const row of rows) if (row.status in counts) counts[row.status] += 1;
  return {
    state: 'confirmed',
    source: 'public.device_registrations (내 기기만)',
    count: rows.length,
    counts,
    truncated: rows.length === RECORD_LIMIT,
    records: rows.map((row) => ({
      device: mask(row.device_id, 4), status: row.status,
      requestedAt: row.requested_at ?? null, approvedAt: row.approved_at ?? null,
    })),
    detectRevocation,
  };
}

// 이 사용자가 주인인 메모 ID: 지금 메모 + 비공개 사본. 제목·본문은 고르지 않습니다.
async function ownedNoteIds({ supabase, user }) {
  if (user.kind !== 'student' || !UUID.test(user.userId ?? '')) return [];
  const ids = new Set();
  for (const table of ['notes', 'notes_backup']) {
    const { data, error } = await supabase.from(table).select('public_id').eq('owner_id', user.userId);
    if (error) throw error;
    for (const row of data ?? []) if (typeof row.public_id === 'string') ids.add(row.public_id.toLowerCase());
  }
  return [...ids];
}

// 복구 버전: 내 메모의 복원 기록(notes_restore_log) + 정책 검증 사본 버전 + 정책 되돌리기 기록(audit.log).
export async function restoreSection({ supabase, user, files = { readText } }) {
  const section = { source: 'public.notes_restore_log (내 메모만)' };
  try {
    const ids = await ownedNoteIds({ supabase, user });
    let rows = [];
    if (ids.length) {
      const { data, error } = await supabase.from('notes_restore_log')
        .select('at, note_public_id, result, reason, before_sha256, after_sha256')
        .in('note_public_id', ids)
        .order('at', { ascending: false })
        .limit(RECORD_LIMIT);
      if (error) throw error;
      rows = data ?? [];
    }
    const byResult = {};
    for (const row of rows) byResult[row.result] = (byResult[row.result] ?? 0) + 1;
    Object.assign(section, {
      state: 'confirmed', count: rows.length, byResult, truncated: rows.length === RECORD_LIMIT,
      records: rows.map((row) => ({
        at: row.at ?? null, note: mask(row.note_public_id), result: row.result, reason: row.reason,
        before: mask(row.before_sha256), after: mask(row.after_sha256),
      })),
    });
  } catch (error) {
    Object.assign(section, { state: 'unavailable', error: errorCode(error) });
  }
  try {
    const manifest = JSON.parse(files.readText('policy-backups/verified/manifest.json'));
    section.policyVersion = {
      state: 'confirmed', source: 'policy-backups/verified/manifest.json',
      commit: mask(manifest.commit, 7), snapshot: mask(manifest.snapshotSha256), createdAt: manifest.createdAt ?? null,
    };
  } catch {
    section.policyVersion = { state: 'unavailable', error: 'POLICY_COPY_UNREADABLE' };
  }
  try {
    const lines = files.readText('policy-backups/audit.log').split('\n').filter((l) => l.trim() !== '');
    const records = lines.map((l) => JSON.parse(l)).map((entry) => ({
      at: entry.at ?? null, action: entry.action ?? null, from: mask(entry.from), after: mask(entry.after),
      hashMatchesVerified: entry.hashMatchesVerified === true,
      checksPassed: (entry.checks ?? []).filter((c) => c.passed === true).length,
      checksTotal: (entry.checks ?? []).length,
    }));
    section.audit = { state: 'confirmed', source: 'policy-backups/audit.log', count: records.length, records };
  } catch {
    section.audit = { state: 'unavailable', error: 'AUDIT_LOG_UNREADABLE' };
  }
  return section;
}

export async function buildOpsSummary({ supabase, user, config, files }) {
  const [revocation, restore] = await Promise.all([
    revocationSection({ supabase, user }),
    restoreSection({ supabase, user, files }),
  ]);
  return {
    generatedAt: new Date().toISOString(),
    decider: deciderSection({ config, files }),
    detection: detectionSection(),
    revocation,
    restore,
  };
}
