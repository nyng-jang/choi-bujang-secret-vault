// The student changes this check as each stage adds an attack to the same app.
// Never return tokens, private keys, real names, or note bodies.
const SECRET_LIKE = /\bsb_secret_[A-Za-z0-9_-]{12,}|\beyJ[A-Za-z0-9_-]{12,}\.eyJ/u;

function appUrl(config) {
  let app;
  try {
    app = new URL(config.publicAppUrl);
  } catch {
    throw new Error('aleph.config.json의 실제 배포 주소를 먼저 넣어 주세요.');
  }
  if (app.protocol !== 'https:' || app.username || app.password || app.search || app.hash
      || app.pathname !== '/' || app.hostname.endsWith('.example')) {
    throw new Error('aleph.config.json의 실제 배포 주소를 먼저 넣어 주세요.');
  }
  if (typeof config.sampleMarker !== 'string' || !config.sampleMarker) throw new Error('가상 메모의 확인 표시를 넣어 주세요.');
  return app;
}

async function anonymousGet(app, path, init = {}) {
  const response = await fetch(new URL(path, app), {
    ...init, redirect: 'error', signal: AbortSignal.timeout(10000),
  });
  const text = await response.text();
  let data = null;
  try { data = JSON.parse(text); } catch { /* not JSON */ }
  return { status: response.status, text, data };
}

function noteCount(data) {
  return Array.isArray(data?.notes) ? data.notes.length : 0;
}

export async function runAttackChecks(config) {
  if (config.step === 1) {
    const app = appUrl(config);
    const { status, data } = await anonymousGet(app, '/data.json');
    const visible = status >= 200 && status < 300 && data?.sampleMarker === config.sampleMarker
      && noteCount(data) > 0;
    return [{ attackId: 'anonymous_note_read', expected: '비로그인 화면에서 가상 메모를 확인',
      observed: visible ? '비로그인 요청에서 공개 가상 메모 확인 표시가 보임' : `비로그인 요청에서 확인 표시가 보이지 않음 (HTTP ${status})` }];
  }
  if (config.step === 3) return loginChecks(config);
  if (config.step !== 2) throw new Error('이 단계의 공격 점검을 src/attack-check.mjs에 구현해 주세요.');
  const app = appUrl(config);
  const oldFile = await anonymousGet(app, '/data.json');
  const oldCount = oldFile.status >= 200 && oldFile.status < 300 ? noteCount(oldFile.data) : 0;
  const api = await anonymousGet(app, '/api/notes');
  const apiCount = api.status >= 200 && api.status < 300 ? noteCount(api.data) : 0;
  const leaked = SECRET_LIKE.test(api.text) ? ', 응답에 키 형태 값 있음' : ', 응답에 키 형태 값 없음';
  return [
    { attackId: 'anonymous_static_data_json', expected: '비로그인 /data.json 요청에 가상 메모가 없어야 함',
      observed: `HTTP ${oldFile.status}, 메모 ${oldCount}건` },
    { attackId: 'anonymous_api_notes', expected: '2단계 알려진 약점: 비로그인 /api/notes 요청이 메모를 돌려줌 (로그인은 3단계부터)',
      observed: `HTTP ${api.status}, 메모 ${apiCount}건${leaked}` },
  ];
}

// A token anyone can write: right-looking claims, no valid signature.
// The server must reject it because it verifies, not just decodes.
function unsignedToken(config) {
  const part = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  return `${part({ alg: 'none', typ: 'JWT' })}.${part({
    iss: config.identityProvider?.issuer, aud: 'authenticated', role: 'authenticated',
    sub: '00000000-0000-4000-8000-000000000000', iat: now, exp: now + 600,
  })}.${Buffer.from('not-a-signature').toString('base64url')}`;
}

async function loginChecks(config) {
  const app = appUrl(config);
  const oldFile = await anonymousGet(app, '/data.json');
  const oldCount = oldFile.status >= 200 && oldFile.status < 300 ? noteCount(oldFile.data) : 0;
  const read = await anonymousGet(app, '/api/notes');
  const forged = await anonymousGet(app, '/api/notes', {
    headers: { Authorization: `Bearer ${unsignedToken(config)}` },
  });
  const write = await anonymousGet(app, '/api/notes', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: '비로그인 추가 시도', content: '거절되어야 함' }),
  });
  const result = ({ status, data, text }) => `HTTP ${status}, 메모 ${noteCount(data)}건, `
    + `오류 ${typeof data?.error === 'string' ? data.error : '없음'}`
    + (SECRET_LIKE.test(text) ? ', 응답에 키 형태 값 있음' : '');
  return [
    { attackId: 'anonymous_static_data_json', expected: '비로그인 /data.json 요청에 가상 메모가 없어야 함',
      observed: `HTTP ${oldFile.status}, 메모 ${oldCount}건` },
    { attackId: 'anonymous_api_notes', expected: '토큰 없는 GET /api/notes는 401 LOGIN_REQUIRED, 메모 0건',
      observed: result(read) },
    { attackId: 'forged_token_api_notes', expected: '서명 없는 가짜 토큰의 GET /api/notes는 401 LOGIN_REQUIRED, 메모 0건',
      observed: result(forged) },
    { attackId: 'anonymous_api_notes_write', expected: '토큰 없는 POST /api/notes는 401 LOGIN_REQUIRED, 메모가 추가되지 않음',
      observed: result(write) },
    { attackId: 'logged_in_note_crud', expected: '로그인한 계정은 메모를 읽고 추가·수정·삭제할 수 있음',
      observed: '미실행: 자동 점검은 비밀번호나 토큰을 쓰지 않으므로 화면에서 직접 확인' },
  ];
}
