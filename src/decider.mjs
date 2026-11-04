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
