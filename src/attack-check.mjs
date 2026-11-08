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
  if (config.step === 6) return deviceChecks(config);
  if (config.step === 7) return stepUpChecks(config);
  if (config.step === 8) return zoneChecks(config);
  if (config.step === 9) return detectChecks(config);
  if (config.step === 10) return restoreChecks(config);
  if (config.step === 11) return appChecks(config);
  if (config.step === 12) return opsChecks(config);
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

// Stage 6: the decider allows reading only from a registered device.
// This calls src/decider.mjs locally with the practice requests from
// scripts/fixture-7.mjs; it is not a sent request and not the judge's result.
// The real unregistered-device attempt is the judge's job, so it stays 미실행.
async function deviceChecks(config) {
  const checks = await serverOnlyChecks(config);
  const { decide } = await import('./decider.mjs');
  const { fixtureRequests } = await import('../scripts/fixture-7.mjs');
  const { normal } = fixtureRequests();
  const registered = await decide(normal);
  const unregistered = await decide({ ...normal, requestId: crypto.randomUUID(), deviceRegistered: false });
  const show = answer => `${answer?.decision}·${answer?.reasonCode}`;
  return [
    ...checks,
    { attackId: 'decider_device_registered_local', expected: '로컬 가상 요청(심판 판정 아님): 등록 기기 GET은 allow·approved, 미등록 기기는 deny·device_not_registered',
      observed: `로컬 판정기 호출 결과: 등록 기기 ${show(registered)}, 미등록 기기 ${show(unregistered)}` },
    { attackId: 'unregistered_device_access', expected: '미등록 기기로 실제 자료실 접근 시 거부',
      observed: '미실행: 미등록 기기 접속 시도는 심판이 맡으므로 자동 점검에서 보내지 않음' },
  ];
}

// Stage 7: unusual combined access goes to step_up, and only a new login after it is allowed again.
// This calls src/decider.mjs locally with the practice requests from scripts/fixture-7.mjs;
// it is not a sent request and not the judge's result. No engine with the step-up contract
// runs in this environment, so the real block-before-re-login check stays 미실행.
async function stepUpChecks(config) {
  const checks = await deviceChecks(config);
  const { decide } = await import('./decider.mjs');
  const { fixtureRequests } = await import('../scripts/fixture-7.mjs');
  const { normal, suspicious } = fixtureRequests();
  const fresh = () => crypto.randomUUID();
  const ordinary = await decide(normal);
  const unusual = await decide(suspicious);
  const again = await decide({ ...suspicious, requestId: fresh(),
    stepUp: { verified: true, authAgeSeconds: 30 } });
  const forged = await decide({ ...suspicious, requestId: fresh(),
    signals: { ...suspicious.signals, source: 'browser' } });
  const show = answer => `${answer?.decision}·${answer?.reasonCode}`;
  return [
    ...checks,
    { attackId: 'decider_step_up_local', expected: '로컬 가상 요청(심판 판정 아님): 정상 allow·approved, 복합 이상 step_up·step_up_required, 새 로그인 뒤 allow·approved, 출처 browser 위조는 규칙이 켜지지 않음',
      observed: `로컬 판정기 호출 결과: 정상 ${show(ordinary)}, 복합 이상 ${show(unusual)}, 새 로그인 뒤 ${show(again)}, 출처 browser ${show(forged)}` },
    { attackId: 'step_up_live_block', expected: '실제 접속에서 다시 로그인 전에는 자료 차단, 새 로그인 뒤 요청은 허용',
      observed: '미실행: 새 로그인 시각을 검증하는 계약이 준비된 반 엔진이 이 환경에 없어 실측하지 않음' },
  ];
}

// Stage 8: resources are split into zones (notes, notices, materials).
// One real anonymous request checks that no resource ID leaks before login.
// The decider and src/access.mjs are called locally with practice values;
// they are not sent requests and not the judge's result. Another user's note
// needs a real login token, which the automatic check never uses, so it stays 미실행.
async function zoneChecks(config) {
  const checks = await stepUpChecks(config);
  const app = appUrl(config);
  const probe = await fetch(new URL('/api/notes/00000000-0000-4000-8000-000000000000', app), {
    redirect: 'error', signal: AbortSignal.timeout(10000),
  });
  const probeBody = await probe.text();
  let probeError = '없음';
  try { probeError = JSON.parse(probeBody)?.error ?? '없음'; } catch { /* not JSON */ }
  const leakedId = probe.headers.get('x-resource-id');

  const { decide } = await import('./decider.mjs');
  const { fixtureRequests } = await import('../scripts/fixture-7.mjs');
  const { normal } = fixtureRequests();
  const ask = (service, method, route, path) => decide({ ...normal, requestId: crypto.randomUUID(),
    service, method, route, path });
  const ownNote = await ask('notes', 'GET', 'GET /notes/:id', '/notes/demo');
  const noteList = await ask('notes', 'GET', 'GET /notes', '/notes');
  const noticeWrite = await ask('notices', 'PUT', 'PUT /notices/:id', '/notices/demo');
  const material = await ask('materials', 'GET', 'GET /materials/:id', '/materials/demo');
  const show = answer => `${answer?.decision}·${answer?.ruleIds?.join('+')}`;

  const { checkAccess } = await import('./access.mjs');
  const student = { kind: 'student', userId: 'practice-user-a' };
  const others = await checkAccess({ user: student, resourceId: 'notes/demo', method: 'GET',
    ownerId: 'practice-user-b' });
  const noticeByStudent = await checkAccess({ user: student, resourceId: 'notices/demo', method: 'PUT',
    loadInstructor: async () => false });
  return [
    ...checks,
    { attackId: 'anonymous_resource_id', expected: '토큰 없는 GET /api/notes/:id는 401 LOGIN_REQUIRED, X-Resource-Id 머리글 없음',
      observed: `HTTP ${probe.status}, 오류 ${probeError}, X-Resource-Id ${leakedId ? `있음(${leakedId})` : '없음'}` },
    { attackId: 'decider_resource_zone_local', expected: '로컬 가상 요청(심판 판정 아님): 내 메모 한 건 GET allow, 메모 전체 목록·반 공지 쓰기·강사 자료는 deny·resource_zone',
      observed: `로컬 판정기 호출 결과: 메모 한 건 ${show(ownNote)}, 메모 목록 ${show(noteList)}, 공지 쓰기 ${show(noticeWrite)}, 강사 자료 ${show(material)}` },
    { attackId: 'api_access_local', expected: '로컬 함수 호출(심판 판정 아님): 남의 메모는 not_owner, 강사 권한 없는 공지 쓰기는 not_instructor',
      observed: `src/access.mjs 호출 결과: 남의 메모 ${others.allowed ? '허용' : `거부·${others.reason}`}, 학생 공지 쓰기 ${noticeByStudent.allowed ? '허용' : `거부·${noticeByStudent.reason}`}` },
    { attackId: 'other_owner_live', expected: 'B 토큰으로 A 메모 GET /api/notes/:id를 직접 요청하면 403 NOTE_FORBIDDEN',
      observed: '미실행: 자동 점검은 비밀번호나 토큰을 쓰지 않으므로 브라우저 Console에서 직접 확인' },
  ];
}

// Stage 9: src/detect.mjs proposes revocation (burst_read) only when one
// pseudonymous user's GET events exceed 120 inside any 10-minute window.
// bundle.mjs accepts at most 20 checks, so the stage-8 duplicate of the
// B→A memo check (other_owner_live, also 미실행) gives its slot to this one.
async function detectChecks(config) {
  const checks = (await zoneChecks(config)).filter(item => item.attackId !== 'other_owner_live');
  const { detect } = await import('./detect.mjs');
  const start = Date.UTC(2026, 9, 1, 0, 0, 0);
  const reads = (count, seconds, sub = 'practice_sub_a') => Array.from({ length: count }, (_, index) => ({
    at: new Date(start + index * seconds * 1000).toISOString(), method: 'GET', identity: { sub } }));
  const show = answer => [answer?.action, answer?.reasonCode].filter(Boolean).join('·');
  const exactly120 = detect(reads(120, 2));
  const burst = detect(reads(121, 2));
  const mixed = detect([...reads(100, 2), ...reads(100, 2, 'practice_sub_b')]);
  const slow = detect(reads(200, 7));
  return [
    ...checks,
    { attackId: 'detect_burst_read', expected: '로컬 가상 사건(심판 판정·실제 회수 아님): 같은 가명 GET 10분 121건 이상만 propose_revocation·burst_read, 120건·두 사용자 각 100건·느린 조회는 observe',
      observed: `src/detect.mjs 호출 결과: 120건 ${show(exactly120)}, 121건 ${show(burst)}, 두 사용자 각 100건 ${show(mixed)}, 느린 200건 ${show(slow)}. 운영 반 엔진의 사건 전달·접속 회수는 이 환경에 없어 미실행` },
  ];
}

// Stage 10: restore from the verified backup.
// One real anonymous POST checks that the restore route refuses requests without a login.
// The policy copies are checked locally (hashes, test-copy difference, live decider and
// allowedRoutes against the verified copy); this is not a sent request or the judge's result.
// B's real restore needs B's login token, which the automatic check never uses.
// bundle.mjs accepts at most 20 checks, so two 미실행 items whose attack is covered elsewhere
// give their slots: logged_in_data_api_direct (direct Data API grants are in the DB policy copy,
// grants none) and unregistered_device_access (the judge's job; decider_device_registered_local stays).
async function restoreChecks(config) {
  const dropped = new Set(['logged_in_data_api_direct', 'unregistered_device_access']);
  const checks = (await detectChecks(config)).filter(item => !dropped.has(item.attackId));
  const app = appUrl(config);
  const { RESTORE_TARGET_ID } = await import('./restore-note.mjs');
  const restore = await fetch(new URL(`/api/notes/${RESTORE_TARGET_ID}/restore`, app), {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
  });
  const restoreBody = await restore.text();
  let restoreError = '없음';
  try { restoreError = JSON.parse(restoreBody)?.error ?? '없음'; } catch { /* not JSON */ }
  const restoreLeak = restore.headers.get('x-resource-id');

  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { POLICY_FILES, diffSnapshots, normalize, sha256, verifySnapshot } = await import('./policy-snapshot.mjs');
  const root = new URL('../', import.meta.url);
  let policy;
  try {
    const verified = verifySnapshot(fileURLToPath(new URL('policy-backups/verified', root)), { label: '검증한 사본' });
    const test = verifySnapshot(fileURLToPath(new URL('policy-backups/test-copy', root)), { label: '시험 정책 사본' });
    const lines = diffSnapshots(verified.texts, test.texts).reduce((sum, file) => sum + file.changes.length, 0);
    const byName = Object.fromEntries(verified.manifest.files.map(file => [file.name, file.sha256]));
    const liveDecider = sha256(normalize(readFileSync(new URL('src/decider.mjs', root), 'utf8'))) === byName['decider.mjs'];
    const liveRoutes = sha256(`${JSON.stringify({ allowedRoutes: config.allowedRoutes }, null, 2)}\n`) === byName['allowed-routes.json'];
    const db = JSON.parse(verified.texts['db-policy.json']).tables.find(table => table.table === 'notes');
    policy = `검증한 사본 해시 확인 통과(파일 ${POLICY_FILES.length}개, 커밋 ${String(verified.manifest.commit).slice(0, 7)}), 시험 정책과 차이 ${lines}줄, 운영 판정기 ${liveDecider ? '같음' : '다름'}, allowedRoutes ${liveRoutes ? '같음' : '다름'}, 사본의 notes RLS ${db?.rlsEnabled ? '켬' : '꺼짐'}·정책 ${db?.policies?.length ?? 0}개·직접 권한 ${db?.grants?.length ?? 0}개`;
  } catch (error) {
    policy = `중단: ${error.message}`;
  }
  return [
    ...checks,
    { attackId: 'anonymous_note_restore', expected: '토큰 없는 POST /api/notes/:id/restore는 401 LOGIN_REQUIRED, X-Resource-Id 머리글 없음, 메모를 되돌리지 않음',
      observed: `HTTP ${restore.status}, 오류 ${restoreError}, X-Resource-Id ${restoreLeak ? `있음(${restoreLeak})` : '없음'}` },
    { attackId: 'policy_restore_local', expected: '로컬 사본 확인(심판 판정 아님): 검증한 사본 해시 통과, 되돌린 시험 정책과 차이 0줄, 운영 판정기·allowedRoutes가 검증한 사본과 같음',
      observed: policy },
  ];
}

// Stage 11: installable app screen + device approval.
// Two real anonymous requests: the device approval route must refuse a request without a login
// (and hand out no device cookie), and the deployed screen must carry the manifest while saying
// that installing is not device approval, with no browser-storage use for keys.
// Approving a device needs a login token and the owner's Supabase step, which the automatic
// check never uses; the student checked it on the deployed screen (README).
// bundle.mjs accepts at most 20 checks, so two 미실행 items give their slots:
// logged_in_own_note_crud (manual screen check, repeated in the stage-11 README record) and
// step_up_live_block (the engine's job; decider_step_up_local stays).
async function appChecks(config) {
  const dropped = new Set(['logged_in_own_note_crud', 'step_up_live_block']);
  const checks = (await restoreChecks(config)).filter(item => !dropped.has(item.attackId));
  const app = appUrl(config);
  const device = await fetch(new URL('/api/device', app), {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
  });
  const deviceBody = await device.text();
  let deviceError = '없음';
  try { deviceError = JSON.parse(deviceBody)?.error ?? '없음'; } catch { /* not JSON */ }
  const cookie = device.headers.get('set-cookie');

  const page = await anonymousGet(app, '/');
  const manifest = await anonymousGet(app, '/manifest.webmanifest');
  const worker = await anonymousGet(app, '/sw.js');
  const linked = /<link[^>]+rel="manifest"[^>]+href="\/manifest\.webmanifest"/u.test(page.text);
  const notTrust = page.text.includes('설치 여부는 기기 확인이 아닙니다');
  const storage = [page, worker].reduce((sum, file) => sum
    + (file.text.match(/localStorage|indexedDB|document\.cookie/gu) ?? []).length, 0);
  const workerApi = /caches?\.(put|add)\([^)]*\/api/u.test(worker.text);
  return [
    ...checks,
    { attackId: 'anonymous_device_request', expected: '토큰 없는 POST /api/device(기기 승인 요청)는 401 LOGIN_REQUIRED, 기기 쿠키를 주지 않음',
      observed: `HTTP ${device.status}, 오류 ${deviceError}, Set-Cookie ${cookie ? '있음' : '없음'}` },
    { attackId: 'app_manifest_screen', expected: '화면(/)이 manifest를 연결하고 「설치 여부는 기기 확인이 아닙니다」를 표시, 화면·sw.js에 localStorage·indexedDB·document.cookie 0곳, sw.js가 /api를 저장하지 않음',
      observed: `/ HTTP ${page.status}, manifest HTTP ${manifest.status}(이름 ${manifest.data?.short_name ?? '없음'}, ${manifest.data?.display ?? '-'}), 연결 ${linked ? '있음' : '없음'}, 설치≠확인 문구 ${notTrust ? '있음' : '없음'}, 저장소 사용 ${storage}곳, sw /api 저장 ${workerApi ? '있음' : '없음'}` },
  ];
}

// Stage 12: 탈환 작전실(/api/ops) and the 1~11 regression table on the screen.
// Two real anonymous requests replace two items, keeping the bundle at 20 checks:
// - cross_owner_note_access (미실행 here) gives its slot to anonymous_ops_request. The B→A
//   read·update·delete denial was measured with real tokens in the screen's regression table
//   (2026-11-08, README 「현재 단계: 12단계」), not by this automatic check.
// - app_manifest_screen becomes app_ops_screen: same manifest checks, plus the 탈환 작전실 and
//   regression table on the deployed screen, and sessionStorage is counted too (stage-11 judge note).
async function opsChecks(config) {
  const checks = (await appChecks(config))
    .filter(item => item.attackId !== 'cross_owner_note_access' && item.attackId !== 'app_manifest_screen');
  const app = appUrl(config);
  const ops = await anonymousGet(app, '/api/ops');
  const page = await anonymousGet(app, '/');
  const manifest = await anonymousGet(app, '/manifest.webmanifest');
  const worker = await anonymousGet(app, '/sw.js');
  const linked = /<link[^>]+rel="manifest"[^>]+href="\/manifest\.webmanifest"/u.test(page.text);
  const notTrust = page.text.includes('설치 여부는 기기 확인이 아닙니다');
  const opsRoom = page.text.includes('탈환 작전실') && page.text.includes('/api/ops');
  const table = page.text.includes('1~11단계 회귀 확인표') && page.text.includes('미실행');
  const storage = [page, worker].reduce((sum, file) => sum
    + (file.text.match(/localStorage|sessionStorage|indexedDB|document\.cookie/gu) ?? []).length, 0);
  const workerApi = /caches?\.(put|add)\([^)]*\/api/u.test(worker.text);
  return [
    ...checks,
    { attackId: 'anonymous_ops_request', expected: '토큰 없는 GET /api/ops(탈환 작전실 요약)는 401 LOGIN_REQUIRED, 판정기·회수·복구 기록을 돌려주지 않음',
      observed: `HTTP ${ops.status}, 오류 ${typeof ops.data?.error === 'string' ? ops.data.error : '없음'}, 요약 칸 ${ops.data && typeof ops.data === 'object' && 'decider' in ops.data ? '있음' : '없음'}` },
    { attackId: 'app_ops_screen', expected: '화면(/)이 manifest를 연결하고 「설치 여부는 기기 확인이 아닙니다」·탈환 작전실(/api/ops)·회귀 확인표(미실행 표기)를 담음, 화면·sw.js에 localStorage·sessionStorage·indexedDB·document.cookie 0곳, sw.js가 /api를 저장하지 않음',
      observed: `/ HTTP ${page.status}, manifest HTTP ${manifest.status}(${manifest.data?.display ?? '-'}), 연결 ${linked ? '있음' : '없음'}, 설치≠확인 문구 ${notTrust ? '있음' : '없음'}, 작전실 ${opsRoom ? '있음' : '없음'}, 회귀 확인표 ${table ? '있음' : '없음'}, 저장소 사용 ${storage}곳, sw /api 저장 ${workerApi ? '있음' : '없음'}` },
  ];
}
