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
  if (Array.isArray(data)) return data.length;
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
  if (config.step === 4) return ownerChecks(config);
  if (config.step === 5) return serverOnlyChecks(config);
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
    body: JSON.stringify({ title: '비로그인 추가 시도', body: '거절되어야 함' }),
  });
  const remove = await anonymousGet(app, '/api/notes/00000000-0000-4000-8000-000000000000', {
    method: 'DELETE',
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
    { attackId: 'anonymous_api_note_delete', expected: '토큰 없는 DELETE /api/notes/:id는 401 LOGIN_REQUIRED',
      observed: result(remove) },
    { attackId: 'logged_in_note_crud', expected: 'A 계정은 내 메모 목록을 보고 POST·PUT·DELETE로 추가·수정·삭제하며, 지운 메모의 GET은 404',
      observed: '미실행: 자동 점검은 비밀번호나 토큰을 쓰지 않으므로 화면에서 직접 확인' },
  ];
}

// Stage 4: the stage 3 checks still hold, and the notes table refuses the
// anon role even when someone calls the Supabase Data API directly with the
// publishable key. Stage 4 read it from /login-config.json. From the stage 5
// bonus the browser no longer gets it, so set SUPABASE_PUBLISHABLE_KEY when
// running the bundle to send these two requests; otherwise they stay 미실행.
async function ownerChecks(config) {
  const checks = (await loginChecks(config)).filter(item => item.attackId !== 'logged_in_note_crud');
  const app = appUrl(config);
  const login = await anonymousGet(app, '/login-config.json');
  const key = process.env.SUPABASE_PUBLISHABLE_KEY?.trim() || login.data?.publishableKey;
  const dataApi = new URL(config.originalApiUrl
    ?? new URL('/rest/v1/notes', new URL(config.identityProvider.issuer).origin));
  let read = null;
  let write = null;
  if (typeof key === 'string' && key.startsWith('sb_publishable_')) {
    const headers = { apikey: key };
    read = await anonymousGet(dataApi, `${dataApi.pathname}?select=public_id`, { headers });
    write = await anonymousGet(dataApi, dataApi.pathname, {
      method: 'POST', headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ title: 'anon 직접 추가 시도', content: '거절되어야 함' }),
    });
  }
  const result = res => res === null
    ? `미실행: 공개용 키 없음 (/login-config.json HTTP ${login.status}, SUPABASE_PUBLISHABLE_KEY 미설정)`
    : `HTTP ${res.status}, 메모 ${noteCount(res.data)}건, 오류 코드 ${typeof res.data?.code === 'string' ? res.data.code : '없음'}`
      + (SECRET_LIKE.test(res.text) ? ', 응답에 키 형태 값 있음' : '');
  return [
    ...checks,
    { attackId: 'anon_data_api_notes_read', expected: '공개용 키(anon)로 Data API의 notes를 직접 읽으면 권한 없음(42501), 메모 0건',
      observed: result(read) },
    { attackId: 'anon_data_api_notes_insert', expected: '공개용 키(anon)로 Data API의 notes에 직접 추가하면 권한 없음(42501), 추가되지 않음',
      observed: result(write) },
    { attackId: 'logged_in_own_note_crud', expected: 'A·B 각자 내 메모 목록을 보고 POST·PUT·DELETE로 추가·수정·삭제하며, 지운 메모의 GET은 404',
      observed: '미실행: 자동 점검은 비밀번호나 토큰을 쓰지 않으므로 화면에서 직접 확인' },
    { attackId: 'cross_owner_note_access', expected: 'B 토큰으로 A 메모 id에 GET·PUT·DELETE하면 모두 403 NOTE_FORBIDDEN, A 메모는 그대로',
      observed: '미실행: 자동 점검은 비밀번호나 토큰을 쓰지 않으므로 브라우저 Console에서 직접 확인' },
  ];
}

// Stage 5: notes are read and written only through /api/notes. The browser
// page has no direct Data API call, and the original API (originalApiUrl)
// refuses the publishable key. The stage 4 checks still hold.
async function serverOnlyChecks(config) {
  const checks = await ownerChecks(config);
  const app = appUrl(config);
  const page = await anonymousGet(app, '/');
  const direct = (page.text.match(/\/rest\/v1|\.from\(\s*['"`]notes/gu) ?? []).length;
  // Bonus: no Supabase key anywhere the screen loads from.
  const files = [page, await anonymousGet(app, '/login-config.json'), await anonymousGet(app, '/vendor/supabase.js')];
  const keyLike = /\bsb_publishable_[A-Za-z0-9_-]{10,}|\beyJ[A-Za-z0-9_-]{12,}\.eyJ[A-Za-z0-9_-]{12,}/gu;
  const keys = files.reduce((sum, file) => sum + (file.status >= 200 && file.status < 300
    ? (file.text.match(keyLike) ?? []).length : 0), 0);
  return [
    ...checks,
    { attackId: 'browser_direct_data_calls', expected: '배포된 화면(/) 코드에 Data API 직접 호출(/rest/v1, .from(\'notes\'))이 0곳, 메모는 /api/notes로만',
      observed: page.status >= 200 && page.status < 300 ? `HTTP ${page.status}, 직접 호출 ${direct}곳` : `HTTP ${page.status}, 화면을 받지 못함` },
    { attackId: 'browser_public_key_absent', expected: '화면(/)·/login-config.json·/vendor/supabase.js에 Supabase 공개 키(sb_publishable_·anon 키)가 0개, 로그인은 /api/session',
      observed: `/ HTTP ${files[0].status}, /login-config.json HTTP ${files[1].status}, /vendor/supabase.js HTTP ${files[2].status}, 키 형태 값 ${keys}개` },
    { attackId: 'logged_in_data_api_direct', expected: '로그인한 A 토큰으로 originalApiUrl의 notes를 직접 읽으면 권한 없음(42501), 메모 0건',
      observed: '미실행: 자동 점검은 비밀번호나 토큰을 쓰지 않으므로 브라우저 Console에서 직접 확인' },
  ];
}
