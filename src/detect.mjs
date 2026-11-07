// 9단계 탐지 함수입니다. 규칙 burst_read 를 넘는 경우에만 회수를 "제안"하며, 직접 회수하지는 않습니다.
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

// 규칙 burst_read: 같은 가명 사용자의 GET 사건이 어느 10분 구간에서든 120건을 넘으면 의심입니다.
// 정확히 120건은 의심이 아닙니다. 창은 at 시각만으로 계산하고,
// 맨 앞 사건과 맨 뒤 사건의 차이가 10분보다 작을 때만 같은 창으로 셉니다.
const BURST_WINDOW_MS = 10 * 60 * 1000;
const BURST_LIMIT = 120;

// 한 사용자의 GET 시각 목록에서 처음으로 120건을 넘는 순간의 시각을 찾습니다. 없으면 null.
function firstBurstTime(times) {
  const sorted = [...times].sort((a, b) => a - b);
  let start = 0;
  for (let end = 0; end < sorted.length; end += 1) {
    while (sorted[end] - sorted[start] >= BURST_WINDOW_MS) start += 1;
    if (end - start + 1 > BURST_LIMIT) return sorted[end];
  }
  return null;
}

export function detect(events) {
  const bySub = new Map();
  for (const { time, method, sub } of readEvents(events)) {
    if (method !== 'GET') continue;
    if (!bySub.has(sub)) bySub.set(sub, []);
    bySub.get(sub).push(time);
  }

  // 여러 사용자가 의심이면 가장 먼저 기준을 넘은 한 사용자를 돌려줍니다.
  let found = null;
  for (const [sub, times] of bySub) {
    const at = firstBurstTime(times);
    if (at !== null && (found === null || at < found.at)) found = { sub, at };
  }

  if (found) return { action: 'propose_revocation', reasonCode: 'burst_read', subject: found.sub };
  return { action: 'observe' };
}
