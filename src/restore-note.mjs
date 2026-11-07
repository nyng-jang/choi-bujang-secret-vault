// 10단계: 비공개 가상 메모 사본(public.notes_backup)에서 복원 대상 한 건만 되살립니다.
// 서버 키 클라이언트로만 부르며, 다른 메모는 public_id 한 건 조건으로만 건드리지 않습니다.
// 순서: 대상 ID 확인 → 사본 해시 확인 → 사본 주인 = 검증된 사용자 → 지금 행의 주인 확인
//       → 그 한 행만 고치거나 다시 넣기 → 다시 읽어 ID·주인·내용 해시 대조 → 복원 기록 추가.
// 응답과 기록에는 메모 문장, 주인 ID, 토큰을 넣지 않습니다.
import { createHash } from 'node:crypto';
import { checkAccess } from './access.mjs';

// 복원 대상: 시험 계정 B의 「B 시험 메모」 한 건(README 「10단계」에 같은 ID).
export const RESTORE_TARGET_ID = '1cd59ee0-e1a1-4d81-a1fc-1bfc3a6ffdb0';

// 내용 해시 = SHA-256(제목 + 줄바꿈 + 내용). notes_backup.sql의 계산과 같습니다.
export function contentSha256(title, content) {
  return createHash('sha256').update(`${title}\n${content}`, 'utf8').digest('hex');
}

const sameId = (a, b) => typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();

async function log(supabase, entry) {
  const { error } = await supabase.from('notes_restore_log').insert({
    note_public_id: entry.id, result: entry.result, reason: entry.reason,
    before_sha256: entry.before ?? null, after_sha256: entry.after ?? null,
  });
  return !error;
}

// 결과: { status, body, log } — body는 그대로 응답, log는 기록에 남긴 짧은 사유.
export async function restoreNote({ supabase, user, noteId, targetId = RESTORE_TARGET_ID }) {
  const finish = async (status, body, entry) => {
    const logged = await log(supabase, { id: noteId, ...entry });
    return { status, body: { ...body, logged }, log: entry.reason };
  };
  const refuse = (status, error, reason, extra = {}) => finish(status, { error }, { result: 'refused', reason, ...extra });

  if (!sameId(noteId, targetId)) return refuse(403, 'RESTORE_NOT_ALLOWED', 'not_target');

  const backup = await supabase.from('notes_backup')
    .select('public_id, owner_id, title, content, content_sha256').eq('public_id', noteId).maybeSingle();
  if (backup.error) throw backup.error;
  if (!backup.data) return refuse(404, 'BACKUP_NOT_FOUND', 'no_backup');
  const copy = backup.data;
  if (!sameId(copy.public_id, noteId) || contentSha256(copy.title, copy.content) !== copy.content_sha256) {
    return refuse(409, 'BACKUP_MISMATCH', 'backup_hash');
  }

  const access = await checkAccess({ user, resourceId: `notes/${noteId}`, method: 'POST', ownerId: copy.owner_id });
  if (!access.allowed || !sameId(copy.owner_id, user?.userId)) return refuse(403, 'NOTE_FORBIDDEN', 'not_owner');

  const current = await supabase.from('notes')
    .select('public_id, owner_id, title, content').eq('public_id', noteId).maybeSingle();
  if (current.error) throw current.error;
  if (current.data && !sameId(current.data.owner_id, copy.owner_id)) return refuse(409, 'OWNER_CONFLICT', 'owner_changed');
  const before = current.data ? contentSha256(current.data.title, current.data.content) : null;

  let result = 'unchanged';
  if (!current.data) {
    const { error } = await supabase.from('notes')
      .insert({ public_id: copy.public_id, owner_id: copy.owner_id, title: copy.title, content: copy.content });
    if (error) throw error;
    result = 'reinserted';
  } else if (before !== copy.content_sha256) {
    const { data, error } = await supabase.from('notes').update({ title: copy.title, content: copy.content })
      .eq('public_id', noteId).eq('owner_id', copy.owner_id).select('public_id');
    if (error) throw error;
    if (!data || data.length !== 1) return refuse(409, 'RESTORE_CONFLICT', 'row_changed', { before });
    result = 'restored';
  }

  const after = await supabase.from('notes')
    .select('public_id, owner_id, title, content').eq('public_id', noteId).maybeSingle();
  if (after.error) throw after.error;
  const row = after.data;
  const afterHash = row ? contentSha256(row.title, row.content) : null;
  const check = {
    id: Boolean(row) && sameId(row.public_id, copy.public_id),
    owner: Boolean(row) && sameId(row.owner_id, copy.owner_id),
    contentSha256: afterHash === copy.content_sha256,
  };
  const matches = check.id && check.owner && check.contentSha256;
  if (!matches) {
    return finish(500, { error: 'RESTORE_VERIFY_FAILED', check }, { result: 'failed', reason: 'verify_mismatch', before, after: afterHash });
  }
  return finish(200, { id: copy.public_id, result, matches, check, contentSha256: afterHash },
    { result, reason: 'ok', before, after: afterHash });
}
