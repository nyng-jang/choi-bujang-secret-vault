// ALEPH SDP 엔진이 확인한 요청만 받는 학생 판정기입니다.
// 요청·응답 모양은 docs/DECIDER_REQUEST.md 계약을 따릅니다.
// 요청 본문의 userId, role, 기기 키, 토큰을 별도로 믿거나 저장하지 마세요.
//
// 6단계 device_registered: 로그인한 주체(subjectId), 등록된 기기(deviceRegistered),
// 읽기 동작(method GET), 그 동작과 맞는 경로 모양(route)이 모두 참일 때만 허용합니다.
// 기기가 등록되지 않았으면 device_not_registered로 거부하고,
// 나머지 조건이 빠지면 시작 틀의 starter.deny로 거부합니다(기본 거부).
export const RULE_IDS = Object.freeze(['device_registered', 'starter.deny']);

// 내 자료실 읽기만 허용합니다. 추가·수정·삭제는 기본 거부(starter.deny)입니다.
const METHODS = new Set(['GET']);

const nonEmpty = value => typeof value === 'string' && value.trim().length > 0;

// 7단계 입력 검사: 접속 정보(지역·네트워크·시각·행동)의 출처를 구분합니다.
// 계약의 signals와 recentEvents만 읽고, 계약에 없는 칸(headers, geo, device 등)은 읽지 않습니다.
// signals.source가 judge_fixture(심판이 보낸 가상 사건)일 때만 지역·네트워크·시각을 씁니다.
// none이면 정보 없음, 그 밖의 값·빈 값·틀린 모양은 출처 불명(untrusted)이며 값은 모두 null(모름)입니다.
// 값이 없거나 모양이 틀리면 임의의 정상값으로 채우지 않고 null로 둡니다.
// 이 함수는 출처만 구분하며, 아직 허용·거부 결과에는 쓰지 않습니다.
const SIGNAL_SOURCES = new Set(['judge_fixture', 'none']);
const MAX_RECENT_EVENTS = 12;

const knownText = value => (nonEmpty(value) && value !== 'unknown' ? value : null);
const knownHour = value => (Number.isInteger(value) && value >= 0 && value <= 23 ? value : null);

function readRecentEvents(events) {
  if (!Array.isArray(events) || events.length > MAX_RECENT_EVENTS) return null;
  const wellFormed = events.every(event => event && typeof event === 'object'
    && nonEmpty(event.kind)
    && Number.isFinite(event.ageSeconds) && event.ageSeconds >= 0
    && Number.isInteger(event.count) && event.count >= 0);
  return wellFormed ? events.map(({ kind, ageSeconds, count }) => ({ kind, ageSeconds, count })) : null;
}

export function readAccessContext(request) {
  const signals = request?.signals;
  const isObject = signals !== null && typeof signals === 'object' && !Array.isArray(signals);
  const source = isObject && SIGNAL_SOURCES.has(signals.source) ? signals.source : 'untrusted';
  const fromJudge = source === 'judge_fixture';
  return {
    source,
    region: fromJudge ? knownText(signals.region) : null,
    network: fromJudge ? knownText(signals.network) : null,
    hour: fromJudge ? knownHour(signals.hour) : null,
    recentEvents: readRecentEvents(request?.recentEvents),
  };
}

function answer(request, decision, reasonCode, ruleId) {
  return {
    schema: 'aleph.decision.v1',
    requestId: request.requestId,
    decision,
    reasonCode,
    ruleIds: [ruleId],
  };
}

export async function decide(request) {
  if (request?.deviceRegistered !== true) {
    return answer(request ?? {}, 'deny', 'device_not_registered', 'device_registered');
  }
  const signedIn = nonEmpty(request.subjectId);
  const knownMethod = METHODS.has(request.method);
  const routeMatches = knownMethod && nonEmpty(request.path)
    && typeof request.route === 'string' && request.route.startsWith(`${request.method} /`);
  if (signedIn && knownMethod && routeMatches) {
    return answer(request, 'allow', 'approved', 'device_registered');
  }
  return answer(request, 'deny', 'starter_not_ready', 'starter.deny');
}
