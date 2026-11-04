// 8단계: 자료실 자원 ID(구역 이름표).
// 서버가 확인한 요청 경로만 보고 자원 ID를 정합니다. 브라우저가 보낸
// 본문·머리글의 자원 이름이나 사용자 번호는 쓰지 않습니다.
//   GET  /api/notes         -> notes/mine        (내 메모 목록)
//   *    /api/notes/<uuid>  -> notes/<uuid>      (내 메모 한 건)
//   *    /api/notices/<uuid>-> notices/<uuid>    (강사 공지 한 건, 구역 이름만 정함)
//   *    /api/materials/<uuid> -> materials/<uuid> (강사 자료 한 건, 구역 이름만 정함)
//   그 밖의 경로             -> null              (이름표 없음, 기본 거부)
// 강사 공지 자료와 주소는 아직 없습니다. 이번에는 메모와 다른 구역 이름만 정합니다.

export const RESOURCE_ZONES = Object.freeze({ notes: 'notes', notices: 'notices', materials: 'materials' });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function resourceIdFor(method, path) {
  if (typeof method !== 'string' || typeof path !== 'string') return null;
  if (path.includes('?') || path.includes('#') || path.includes('%')) return null;
  const parts = path.split('/');
  // '', 'api', '<zone>', ['<id>']
  if (parts[0] !== '' || parts[1] !== 'api' || parts.length < 3 || parts.length > 4) return null;
  if (!Object.hasOwn(RESOURCE_ZONES, parts[2])) return null;
  const zone = RESOURCE_ZONES[parts[2]];
  if (parts.length === 3) {
    // 목록은 내 메모만 있습니다. 공지 목록 주소는 아직 없습니다.
    return zone === 'notes' && (method === 'GET' || method === 'POST') ? 'notes/mine' : null;
  }
  const id = parts[3];
  if (!UUID.test(id)) return null;
  return `${zone}/${id.toLowerCase()}`;
}
