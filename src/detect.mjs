// 9단계에서 학생이 채우는 탐지 함수입니다. 이 기본값은 어떤 접속도 회수하지 않습니다.
// 반 엔진이 검증한 사건만 전달해야 하며, 브라우저가 보낸 사용자 번호는 받지 않습니다.
// 사건 형식은 docs/DETECT_EVENTS.md 입니다: { at, method, identity: { sub } }.

// 사건 하나에서 at(시각)·method(요청 종류)·identity.sub(가명 사용자) 세 값만 꺼냅니다.
// 다른 칸(네트워크·기기·지역·본문·토큰 등)은 읽지 않습니다.
// 세 값 중 하나라도 없거나 형식이 맞지 않으면 null 을 돌려주고, 그 사건은 세지 않습니다.
export function readEvent(event) {
  if (event === null || typeof event !== 'object') return null;
  const { at, method, identity } = event;
  if (typeof at !== 'string' || typeof method !== 'string') return null;
  const time = Date.parse(at);
  if (!Number.isFinite(time)) return null;
  if (identity === null || typeof identity !== 'object') return null;
  const { sub } = identity;
  if (typeof sub !== 'string' || sub === '') return null;
  return { time, method, sub };
}

// 사건 목록 전체를 세 값만 가진 목록으로 바꿉니다. 기록이나 출력은 하지 않습니다.
export function readEvents(events) {
  if (!Array.isArray(events)) throw new TypeError('invalid_detection_events');
  const read = [];
  for (const event of events) {
    const item = readEvent(event);
    if (item) read.push(item);
  }
  return read;
}

export function detect(events) {
  readEvents(events);
  return { action: 'observe' };
}
