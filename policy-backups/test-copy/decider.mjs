// ALEPH SDP 엔진이 확인한 요청만 받는 학생 판정기입니다.
// 요청·응답 모양은 docs/DECIDER_REQUEST.md 계약을 따릅니다.
// 요청 본문의 userId, role, 기기 키, 토큰을 별도로 믿거나 저장하지 마세요.
//
// 6단계 device_registered: 로그인한 주체(subjectId), 등록된 기기(deviceRegistered),
// 읽기 동작(method GET), 그 동작과 맞는 경로 모양(route)이 모두 참일 때만 허용합니다.
// 기기가 등록되지 않았으면 device_not_registered로 거부하고,
// 나머지 조건이 빠지면 시작 틀의 starter.deny로 거부합니다(기본 거부).
//
// 7단계 unusual_access: 위 조건을 모두 통과한 읽기 요청이라도, 심판 가상 사건(judge_fixture)에서
// 새벽 시각 + 처음 보는 네트워크 + 최근 갑자기 많은 사건이 한꺼번에 겹치면
// step_up(추가 본인 확인)으로 보내고 사유 코드 step_up_required를 남깁니다.
// 지역(region)은 조건에 넣지 않으므로 지역 하나만으로는 막히지 않고, 영구 차단도 하지 않습니다.
//
// 7단계 step_up_required: unusual_access에 걸린 요청은 엔진이 확인한 새 로그인(stepUp) 뒤에만 다시 판정해 허용합니다.
// stepUp.verified가 true이고, authAgeSeconds가 계약 범위(0~900초) 정수이고,
// 그 로그인이 가장 최근 이상 사건보다 나중(로그인 나이 <= 사건 나이)일 때만 allow입니다.
// verified 하나만 보고 건너뛰지 않으며, 하나라도 아니면 step_up을 유지합니다. 토큰은 받지도 기록하지도 않습니다.
//
// 8단계 resource_zone: 서비스(service)와 정확한 경로 모양(route)으로 구역을 나눕니다.
// 아래 ZONE_ROUTES 표에 있는 「서비스 + 경로 모양」만 허용하고, 표에 없으면 모두 거부합니다.
//   메모(notes): 자료 ID 하나를 고르는 GET /notes/:id 만 허용. ID 없는 전체 목록 GET /notes 와 쓰기는 거부.
//   반 공지(notices): 읽기 GET /notices, GET /notices/:id 만 허용. 쓰기는 누구에게나 거부.
//     판정기 요청에는 역할이 없으므로 강사의 공지 수정은 판정기가 아니라 서버의 관리 경로에서 처리합니다.
//   강사 자료(materials): 표에 넣지 않아 판정기에서 모두 거부.
// path가 route 모양과 정말 같은지도 봅니다(:id는 한 칸, 더 깊은 경로는 거부). ID 형식은 좁히지 않습니다.
// 쿼리로 기능을 고르지 않고, :id와 같은 깊이에 export 같은 기능 경로를 두지 않습니다.
// 메모 주인 비교는 판정기가 아니라 자료 API(api/notes.js)에서 합니다.
// 공지·강사 자료의 서비스 이름(notices, materials)은 계약에 예시가 없어 정한 이름입니다.
export const RULE_IDS = Object.freeze(['device_registered', 'resource_zone', 'unusual_access', 'step_up_required', 'starter.deny']);

// 내 자료실 읽기만 허용합니다. 추가·수정·삭제는 기본 거부입니다.
const METHODS = new Set(['GET', 'DELETE']);

// 서비스별로 허용하는 정확한 경로 모양입니다. 여기에 없는 서비스·경로는 거부합니다.
const ZONE_ROUTES = Object.freeze({
  notes: Object.freeze(['GET /notes/:id']),
  notices: Object.freeze(['GET /notices', 'GET /notices/:id']),
});

// path가 route 모양과 같은지 칸마다 비교합니다. :id 자리는 비어 있지 않은 한 칸이면 됩니다.
function pathMatchesRoute(path, routePath) {
  if (typeof path !== 'string' || /[?#\\]/u.test(path)) return false;
  const want = routePath.split('/');
  const got = path.split('/');
  if (got.length !== want.length || got[0] !== '') return false;
  return want.every((part, index) => (part === ':id'
    ? got[index].trim().length > 0 && got[index] !== '.' && got[index] !== '..'
    : got[index] === part));
}

function zoneAllows(request) {
  const service = request.service;
  if (typeof service !== 'string' || !Object.hasOwn(ZONE_ROUTES, service)) return false;
  const route = request.route;
  if (typeof route !== 'string' || !ZONE_ROUTES[service].includes(route)) return false;
  const [method, routePath] = route.split(' ');
  return request.method === method && pathMatchesRoute(request.path, routePath);
}

const nonEmpty = value => typeof value === 'string' && value.trim().length > 0;

// 7단계 입력 검사: 접속 정보(지역·네트워크·시각·행동)의 출처를 구분합니다.
// 계약의 signals와 recentEvents만 읽고, 계약에 없는 칸(headers, geo, device 등)은 읽지 않습니다.
// signals.source가 judge_fixture(심판이 보낸 가상 사건)일 때만 지역·네트워크·시각을 씁니다.
// none이면 정보 없음, 그 밖의 값·빈 값·틀린 모양은 출처 불명(untrusted)이며 값은 모두 null(모름)입니다.
// 값이 없거나 모양이 틀리면 임의의 정상값으로 채우지 않고 null로 둡니다.
// 이 함수는 출처만 구분하며, 판정은 아래 unusual_access 규칙이 합니다.
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

// 7단계 unusual_access 기준값입니다. 프롬프트에 숫자가 없어 정한 값입니다.
const UNUSUAL_HOURS = { from: 0, to: 5 };   // 새벽 0~5시를 평소와 다른 시각으로 봅니다.
const BURST_WINDOW_SECONDS = 300;           // 최근 5분 안의 사건만 셉니다.
const BURST_MIN_COUNT = 10;                 // 그 안의 사건 수 합이 10건 이상이면 갑자기 많이 읽은 것으로 봅니다.

// 복합 이상이면 가장 최근 이상 사건의 나이(초)를, 아니면 null을 돌려줍니다.
function unusualAccessAge(context) {
  if (context.source !== 'judge_fixture') return null;
  const unusualHour = context.hour !== null
    && context.hour >= UNUSUAL_HOURS.from && context.hour <= UNUSUAL_HOURS.to;
  const newNetwork = context.network === 'unusual';
  const recent = Array.isArray(context.recentEvents)
    ? context.recentEvents.filter(event => event.ageSeconds <= BURST_WINDOW_SECONDS) : [];
  const burst = recent.reduce((sum, event) => sum + event.count, 0) >= BURST_MIN_COUNT;
  if (!(unusualHour && newNetwork && burst)) return null;
  return Math.min(...recent.map(event => event.ageSeconds));
}

// 계약의 stepUp 범위입니다. verified가 true일 때 authAgeSeconds는 0~900초입니다.
const STEP_UP_MAX_AGE_SECONDS = 900;

function loggedInAgainAfter(stepUp, eventAgeSeconds) {
  if (stepUp === null || typeof stepUp !== 'object' || stepUp.verified !== true) return false;
  const age = stepUp.authAgeSeconds;
  return Number.isInteger(age) && age >= 0 && age <= STEP_UP_MAX_AGE_SECONDS
    && age <= eventAgeSeconds;
}

function answer(request, decision, reasonCode, ruleId) {
  const ruleIds = Array.isArray(ruleId) ? [...ruleId] : [ruleId];
  return {
    schema: 'aleph.decision.v1',
    requestId: request.requestId,
    decision,
    reasonCode,
    ruleIds,
  };
}

export async function decide(request) {
  if (request?.deviceRegistered !== true) {
    return answer(request ?? {}, 'deny', 'device_not_registered', 'device_registered');
  }
  if (!nonEmpty(request.subjectId)) {
    return answer(request, 'deny', 'starter_not_ready', 'starter.deny');
  }
  // 8단계: 구역 표에 없는 서비스·경로·동작(공지·강사 자료 쓰기, 메모 전체 목록 포함)은 여기서 거부합니다.
  if (!zoneAllows(request)) {
    return answer(request, 'deny', 'starter_not_ready', 'resource_zone');
  }
  // 6단계 읽기(GET)만 허용 규칙은 그대로 둡니다.
  if (!METHODS.has(request.method)) {
    return answer(request, 'deny', 'starter_not_ready', 'starter.deny');
  }
  const eventAge = unusualAccessAge(readAccessContext(request));
  if (eventAge !== null) {
    if (loggedInAgainAfter(request.stepUp, eventAge)) {
      return answer(request, 'allow', 'approved', ['step_up_required', 'resource_zone']);
    }
    return answer(request, 'step_up', 'step_up_required', 'unusual_access');
  }
  return answer(request, 'allow', 'approved', ['device_registered', 'resource_zone']);
}
