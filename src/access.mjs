// 8단계: 자료 API의 마지막 권한 대조.
// 판정기를 지나 왔더라도, 서버가 검증한 사용자(토큰)와 서버에 저장된 값만 대조합니다.
//   - 메모 주인: DB notes.owner_id
//   - 강사 권한: DB public.instructors 표(서버 키로만 읽음)
// 화면 메뉴, 요청 본문·머리글·쿼리의 role 같은 값은 읽지 않습니다.
// 결과는 { allowed, reason }이며, reason은 기록용 짧은 사유입니다(사용자 번호·자료 내용 없음).
//   not_owner       저장된 메모 주인이 아님
//   not_instructor  저장된 강사 권한이 없음
//   unknown_zone    알 수 없는 구역·자원 ID
//   no_user         검증된 사용자가 없음

const READ = new Set(['GET']);

function zoneOf(resourceId) {
  if (typeof resourceId !== 'string') return null;
  const slash = resourceId.indexOf('/');
  if (slash <= 0 || slash === resourceId.length - 1) return null;
  return { zone: resourceId.slice(0, slash), id: resourceId.slice(slash + 1) };
}

const sameUser = (a, b) => typeof a === 'string' && typeof b === 'string'
  && a.length > 0 && a.toLowerCase() === b.toLowerCase();

// loadInstructor는 저장된 강사 권한을 읽는 함수입니다. 필요한 구역에서만 부릅니다.
// true가 아니면(오류·없음 포함) 강사가 아닌 것으로 봅니다.
export async function checkAccess({ user, resourceId, method, ownerId, loadInstructor }) {
  if (!user || typeof user.userId !== 'string' || !user.userId) return { allowed: false, reason: 'no_user' };
  const target = zoneOf(resourceId);
  if (!target) return { allowed: false, reason: 'unknown_zone' };
  const instructor = async () => {
    if (user.kind !== 'student' || typeof loadInstructor !== 'function') return false;
    try { return (await loadInstructor()) === true; } catch { return false; }
  };

  if (target.zone === 'notes') {
    // 목록(notes/mine)은 DB 조회에서 owner_id = 토큰 사용자로만 거릅니다.
    if (target.id === 'mine') return { allowed: true, reason: 'own_list' };
    // 메모 한 건은 저장된 주인과 같아야 합니다. 강사 권한으로도 남의 메모는 열지 않습니다.
    return sameUser(ownerId, user.userId)
      ? { allowed: true, reason: 'owner' }
      : { allowed: false, reason: 'not_owner' };
  }
  if (target.zone === 'notices') {
    if (READ.has(method)) return { allowed: true, reason: 'notice_read' };
    return (await instructor())
      ? { allowed: true, reason: 'instructor' }
      : { allowed: false, reason: 'not_instructor' };
  }
  if (target.zone === 'materials') {
    return (await instructor())
      ? { allowed: true, reason: 'instructor' }
      : { allowed: false, reason: 'not_instructor' };
  }
  return { allowed: false, reason: 'unknown_zone' };
}

// 저장된 강사 권한을 public.instructors 표에서 읽습니다(서버 키 클라이언트 전용).
// 표가 없거나 오류가 나면 false(강사 아님)입니다.
export async function readInstructor(supabase, userId) {
  if (!supabase || typeof userId !== 'string' || !userId) return false;
  const { data, error } = await supabase.from('instructors').select('user_id')
    .eq('user_id', userId).maybeSingle();
  if (error || !data) return false;
  return sameUser(data.user_id, userId);
}
