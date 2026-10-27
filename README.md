# BYTE BACK 방어전 시작 틀 R5

이 저장소는 1단계에서 학생 본인이 GitHub 저장소와 Vercel 배포를 만드는 출발점입니다. 포함된 메모 네 건은 가상 자료입니다. 실제 학생 자료, 토큰, 비밀키를 넣지 마세요.

## 학생이 하는 일: 세 걸음

1. GitHub 계정을 만듭니다.
2. 방어전 1단계 카드의 **Deploy** 버튼을 누릅니다. Vercel에 GitHub로 로그인하고, 새 저장소가 **본인 계정의 Public 저장소**인지 확인한 뒤 Deploy를 누릅니다.
3. 배포가 끝나면 화면에 나온 `https://…vercel.app` 주소를 방어전 1단계 카드에 붙여넣고 제출합니다. 저장소 주소나 설정 파일은 적지 않습니다.

배포가 끝나면 `/`에서 점령된 가상 자료실을 볼 수 있습니다. 1단계에서는 `/data.json`에 같은 가상 메모가 공개되었습니다. 이 공개 상태를 확인하는 것이 1단계의 출발점입니다. 1단계 접수와 심판 판정은 포털에서 확인합니다. 지금 상태는 아래 「현재 단계: 5단계」를, 지난 단계 기록은 「4단계 기록」, 「3단계 기록」, 「2단계 기록」을 보세요.

## 시작 틀의 자동 처리

`vercel.json`은 정적 결과물 `public`과 `api` 폴더의 서버 함수를 배포합니다. 빌드 명령 `npm run build`는 Vercel이 제공하는 GitHub 저장소 소유자·이름, 커밋 SHA, 배포 URL을 검증하고 `public/aleph.json`을 생성합니다. 이 값이 없으면 빌드가 실패하므로, 성공한 것처럼 빈 주소를 내보내지 않습니다. `aleph.json`의 내용만으로 저장소 소유권이나 방어 성공을 인정하지 않습니다. 심판이 공개 저장소의 실제 커밋과 배포된 자료를 따로 대조해야 합니다.

`aleph.config.json`의 `repoUrl`과 `publicAppUrl`은 1단계 시작 틀에서는 자리표시자였고, 학생이 편집하지 않았습니다. 2단계 저장점(`f53f2cb`)에서 실제 저장소·프로덕션 주소로 채웠습니다. 2단계 이후 코딩 도구가 필요한 설정과 보호 기능을 단계별로 작성합니다. `npm run bundle`과 `bundle-notes.json`도 1단계의 세 걸음에는 포함되지 않습니다.

로컬에서 빌드만 확인할 때는 `npm run build -- --local`을 사용합니다. 로컬 실행은 Vercel 배포나 심판 접수를 증명하지 않습니다. 저장소의 `src/attack-check.mjs`는 `npm run bundle`이 실행하는 자기 점검입니다. 5단계에서는 실제 배포에 `/data.json`(메모가 없어야 함), 토큰 없는 `/api/notes` 읽기·추가와 `/api/notes/:id` 삭제, 서명 없는 가짜 토큰 읽기를 요청하고(모두 401이어야 정상), 배포의 `/login-config.json`에 있는 공개용 키(anon)로 `originalApiUrl`(Supabase Data API의 `notes`)을 직접 읽기·추가하며(권한 없음 42501이어야 정상), 배포된 화면 `/`의 코드에 Data API 직접 호출이 몇 곳인지(0곳이어야 정상) 세어 상태 코드와 건수만 기록합니다. 로그인한 상태의 내 메모 읽기·추가·수정·삭제, B→A 메모 접근, 로그인 토큰으로 원본 직접 읽기는 비밀번호나 토큰을 쓰지 않기 위해 자동 점검에서 빼고 「미실행」으로 남깁니다.

## 다음 단계의 코딩 도구에 전달할 규칙

[AGENTS.md](AGENTS.md)를 먼저 읽히고 한 번에 한 제작 단위만 요청하세요. 2단계부터는 자료 보호를 구현할 때 `public/data.json`을 복사하는 1단계 빌드 흐름도 함께 바꿔야 합니다. 3단계 이후의 로그인, 허용 경로, 5단계의 원본 API 주소, 6단계 이후 정책 규칙은 해당 단계 원고와 계약에 맞춰 추가합니다. 비밀번호·토큰·서버 전용 키·실제 학생 기록을 코드, Git, 제출 묶음에 넣지 않습니다.

`src/decider.mjs`와 `src/detect.mjs`의 로컬 시험은 반 엔진이나 운영 심판의 결과가 아닙니다. 1단계 이후 제출 묶음 계약 `aleph.defense.submission.v2`는 `scripts/bundle.mjs`에 남아 있으며, 코딩 도구가 해당 단계의 최신 배포 주소와 Git 원격을 맞춘 뒤 사용합니다.

## 현재 단계: 5단계 「자료 요청을 서버 한곳으로 모읍니다」

- 브라우저(`public/index.html`)의 메모 읽기·추가·수정·삭제는 모두 Vercel 서버 함수 `/api/notes`를 거칩니다. 브라우저가 Supabase를 부르는 곳은 로그인(`supabase.auth`의 signInWithPassword·signOut·onAuthStateChange·getSession)뿐이고, `.from('notes')`나 `/rest/v1` 같은 직접 자료 호출은 없습니다(4단계부터 이미 없어 화면 코드는 바꾸지 않음).
- DB(`public.notes`만): `PUBLIC`·`anon`·`authenticated`의 직접 권한을 모두 회수했습니다. 4단계에서 `authenticated`에 주었던 SELECT·INSERT·UPDATE·DELETE도 거둬서, 로그인한 사람의 토큰으로도 Data API를 직접 부를 수 없습니다. RLS와 정책 네 개는 켠 채로 두어, 나중에 실수로 권한이 다시 생겨도 남의 행은 막습니다. `service_role`(서버 전용 키) 권한은 Supabase 기본값 그대로이며 다른 테이블은 건드리지 않았습니다.
- 서버 함수(`api/notes.js`)는 바꾸지 않았습니다. 로그인 토큰 검증(401), 주인 확인(남의 메모 403, 없는 메모 404), 본문 `owner_id` 거절(400), 서버 전용 키 `SUPABASE_SECRET_KEY` 사용은 4단계와 같습니다.
- `aleph.config.json`: `step` 5. `originalApiUrl`은 원본 자료 API의 쿼리 없는 HTTPS 주소 `https://kvzvodzkgrwavncezuiw.supabase.co/rest/v1/notes`(커밋 `093b783`)로, `identityProvider.issuer`와 같은 Supabase 프로젝트이고 `api/notes.js`가 서버 전용 키로 읽고 쓰는 바로 그 테이블입니다. 심판은 이 주소를 공개용 키(anon)로 직접 불러 거부되는지 봅니다. `identityProvider`, `allowedRoutes`(다섯 경로), `judgeIssuer`는 4단계와 같고 `restoreRoute`는 비어 있습니다. `src/decider.mjs`의 `RULE_IDS`는 `starter.deny` 하나뿐입니다.
- 실제 배포·DB에서 학생이 직접 확인한 것(2026-10-27): 회수 전후 권한 대조에서 회수 뒤 `public`·`anon`·`authenticated`는 모든 권한 false, `service_role`은 그대로. 브라우저 Console에서 공개용 키만으로, 그리고 A 로그인 토큰으로 Data API `notes`를 직접 읽기 → 둘 다 거부(401/403, 42501). 회수 뒤에도 A의 화면 목록·추가·수정·삭제는 `/api/notes`로 200/201이고, Network에 `rest/v1` 요청은 화면에서 생기지 않음.
- 자기 점검(`src/attack-check.mjs`) 11개(아래 가점에서 키 점검 1개를 더해 12개): 4단계의 9개(공개용 키 직접 읽기·추가는 이제 `originalApiUrl`로 보냄), 배포 화면 코드의 직접 자료 호출 수 1개, 로그인 토큰으로 원본 직접 읽기 1개(토큰을 쓰지 않으므로 「미실행」).
- 다시 실행: Supabase 대시보드 > SQL Editor > New query에서 `notes_grants_check_stage5.sql`(권한 대조) → `notes_revoke_direct.sql`(권한 회수) → `notes_grants_check_stage5.sql`을 차례로 실행합니다(Git에 올리지 않음). PC의 저장소 폴더 맨 위에 `bundle-notes.json`(커밋하지 않음)을 두고 Git Bash에서 `git pull && npm run bundle`을 실행하면 `artifacts/submission.json`(커밋하지 않음)이 만들어집니다.
- 해결 안 된 시험과 약점: `npm run test:package`는 `api/notes.js`가 `package/baseline-functions.json`에 없어서 계속 실패합니다. Supabase의 「Allow new users to sign up」은 끄는 것을 권합니다. 2단계에 적은 옛 공개 커밋·옛 배포 문제도 그대로입니다.

### 5단계 가점: 화면 코드에 Supabase 키 없애기

- 로그인·로그아웃도 서버 함수 `api/session.js`가 합니다. `POST /api/session` 본문 `{email,password}` → 서버가 Vercel 환경변수의 공개용 키로 Supabase Auth에 로그인하고, 브라우저에는 내 접근 토큰·만료 시각·이메일만 돌려줍니다(새로 고침 토큰·키는 돌려주지 않음). 실패하면 `{error:"LOGIN_FAILED",reason}`이고, 화면은 3단계와 같은 문장으로 이유를 보여 줍니다. `DELETE /api/session`은 토큰을 검증한 뒤 그 Supabase 세션을 끝냅니다(이미 받은 접근 토큰은 만료 시각까지 유효).
- 화면(`public/index.html`)은 Supabase 브라우저 라이브러리를 쓰지 않고, 토큰을 그 탭의 sessionStorage에만 둡니다(탭을 닫거나 토큰이 만료되면 다시 로그인). 빌드는 `public/login-config.json`과 `public/vendor/`를 더 이상 만들지 않고 남은 것도 지웁니다. `SUPABASE_PUBLISHABLE_KEY`는 서버 함수만 씁니다.
- `/api/notes`의 토큰 검증·주인 확인, `nosniff` 헤더는 그대로입니다. `allowedRoutes`에 `POST /api/session`, `DELETE /api/session`을 더해 일곱 경로입니다.
- 자기 점검에 `/`·`/login-config.json`·`/vendor/supabase.js`의 키 형태 값 개수(0개여야 정상)를 더했습니다. 공개용 키로 원본을 직접 부르는 두 점검은 이제 화면에서 키를 얻을 수 없으므로, `npm run bundle` 때 환경변수 `SUPABASE_PUBLISHABLE_KEY`를 줄 때만 실행하고 없으면 「미실행」입니다.
- 되돌리기: 로그인이 깨지면 Vercel Deployments에서 이전 배포를 Instant Rollback하고, 저장소는 `git revert <이 커밋>`으로 되돌립니다.

## 4단계 기록 「로그인해도 내 자료만 보이게 합니다」

- 메모 주인 정리: 처음 가상 메모 네 건은 A 계정, 공개 가능한 시험 메모 「B 시험 메모」 한 건은 B 계정 소유입니다. 소유자는 이메일로 `auth.users`에서 ID를 찾는 학습용 SQL로 맞췄습니다(SQL은 메모 문장이 있어 Git에 올리지 않음).
- 앱 API(`api/notes.js`, 커밋 `f019db3`): 주인은 언제나 서버가 검증한 토큰의 사용자 ID이고, URL·본문의 `owner_id`는 믿지 않습니다(본문에 있으면 400). `GET·PUT·DELETE /api/notes/:id`는 DB의 `owner_id`와 비교해 없으면 404 `NOTE_NOT_FOUND`, 남의 메모면 403 `NOTE_FORBIDDEN`으로 기본 거부합니다. 추가는 토큰 ID로 저장하고, 수정은 기존 행과 바뀐 행이 모두 내 것인지, 삭제는 내 행인지 `owner_id` 조건으로 확인합니다. 한 건 응답 `{id,title,body}`와 수정 본문 `{title,body}`는 3단계와 같습니다.
- DB(`public.notes`만): `PUBLIC`·`anon`·`authenticated` 권한을 모두 회수한 뒤 `authenticated`에만 SELECT·INSERT·UPDATE·DELETE를 주었습니다. RLS 정책 네 개가 모두 `auth.uid() = owner_id`일 때만 허용합니다(SELECT·DELETE는 기존 행 USING, INSERT는 새 행 WITH CHECK, UPDATE는 둘 다). `anon`에는 권한이 없습니다. 앱 API는 서버 전용 키(service_role, RLS를 건너뜀)를 쓰므로 앱의 주인 확인은 API가 하고, RLS는 Data API로 직접 들어오는 길을 막는 두 번째 벽입니다. 심판이 재현할 수 없는 `authenticated` 역할의 직접 접근은 점수 확인에서 뺍니다.
- `aleph.config.json`(4단계 당시): `step` 4. `identityProvider`, `allowedRoutes`(다섯 경로), `judgeIssuer`는 3단계와 같고, `originalApiUrl`·`restoreRoute`는 5단계 전이라 비어 있습니다. `src/decider.mjs`의 `RULE_IDS`는 `starter.deny` 하나뿐입니다. 로그아웃 상태의 JSON 401, `/aleph.json`, `X-Content-Type-Options: nosniff`는 그대로입니다.
- 실제 배포·DB에서 학생이 직접 확인한 것(2026-10-26): B 토큰으로 A 메모 id에 `GET·PUT·DELETE` → 모두 403, A 메모는 그대로. A·B 각자 화면에서 내 메모 추가·수정·삭제 동작. 공개용 키로 Data API `notes` 직접 읽기 → 401 `42501 permission denied for table notes`. 적용 후 `information_schema.role_table_grants`·`has_table_privilege` 대조에서 `anon`은 권한 없음, `authenticated`는 SELECT·INSERT·UPDATE·DELETE만.
- 자기 점검(`src/attack-check.mjs`) 9개: 3단계의 비로그인·가짜 토큰 점검 5개, 공개용 키로 Data API 직접 읽기·추가 2개, 로그인한 내 메모 CRUD와 B→A 접근 2개(토큰을 쓰지 않으므로 「미실행」).
- 다시 실행: Supabase SQL Editor에서 소유자 정리 SQL, `notes_rls.sql`(권한·RLS), `notes_grants_check.sql`(권한 대조)을 차례로 실행하고(셋 다 Git에 올리지 않음), Vercel에 다시 배포합니다. PC의 저장소 폴더 맨 위에 `bundle-notes.json`(커밋하지 않음)을 두고 `git pull && npm run bundle`을 실행하면 `artifacts/submission.json`(커밋하지 않음)이 만들어집니다.
- 해결 안 된 시험과 약점: `npm run test:package`는 `api/notes.js`가 `package/baseline-functions.json`에 없어서 계속 실패합니다. Supabase의 「Allow new users to sign up」이 켜져 있으면 공개용 키로 누구나 계정을 만들 수 있으니 끄는 것을 권합니다. 2단계에 적은 옛 공개 커밋·옛 배포 문제도 그대로입니다.

## 3단계 기록 「진짜 로그인을 붙입니다」

- 화면(`/`)에서 Supabase Auth의 이메일·비밀번호로 로그인하고 로그아웃합니다. 로그인하면 가상 메모 목록이 보이고, 메모를 추가·수정·삭제할 수 있습니다. 로그인 전에는 `/api/notes`를 부르지 않고 「로그인하면 가상 메모가 보입니다」만 보입니다.
- 서버 함수 `api/notes.js`는 모든 요청에서 `Authorization: Bearer <토큰>`을 틀의 `src/verify-login.mjs`(고치지 않음)로 검증합니다. 학생 토큰은 Supabase `auth.getClaims`로 서명·발급자·대상(`authenticated`)·만료를 확인하고, 심판 토큰은 `judgeIssuer`의 공개키로 확인합니다. 토큰이 없거나 검증에 실패하면 자료 없이 401 `LOGIN_REQUIRED`입니다. 토큰 내용을 서버가 직접 풀어서 믿지 않습니다.
- 자료 API(`vercel.json`이 `/api/notes/:id`를 같은 함수로 연결):
  - `GET /api/notes`: 로그인한 계정이 주인(`owner_id`)인 메모 배열 `[{id,title,body}]`
  - `POST /api/notes`: 본문 `{id?,title,body}`. `id`는 UUID이며 없으면 서버가 만들어 201 `{id}`를 돌려줍니다. 이미 있는 `id`면 409입니다.
  - `GET /api/notes/:id`: `{id,title,body}`. 없거나 지운 메모는 404 `NOTE_NOT_FOUND`
  - `PUT /api/notes/:id`: 본문 `{title,body}`로 바꾸고 `{id,title,body}`를 돌려줍니다.
  - `DELETE /api/notes/:id`: 지우고 `{id}`를 돌려줍니다.
- 새 메모의 `owner_id`는 요청 본문이 아니라 서버가 검증한 토큰의 사용자 ID로 채웁니다. 본문에는 위의 칸만 받고(`title` 1~100자, `body` 2000자 이하), `userId`·`role`·`owner_id` 같은 다른 칸이 있으면 400입니다. API의 `id`는 DB의 `public_id`(UUID) 칸이고, `body`는 DB의 `content` 칸입니다. 처음 가상 메모 네 건은 A 계정 소유로 옮겼습니다.
- 브라우저에는 프로젝트 주소와 공개용 `SUPABASE_PUBLISHABLE_KEY`만 줍니다. 빌드가 이 두 값으로 `public/login-config.json`을 만들고, Supabase 브라우저 라이브러리는 `package-lock.json`에 고정된 판을 `public/vendor/supabase.js`로 복사합니다(둘 다 Git에는 올리지 않음). `sb_publishable_`로 시작하지 않는 키는 빌드가 거부합니다. 서버 전용 `SUPABASE_SECRET_KEY`는 서버 함수에서만 씁니다.
- `aleph.config.json`(3단계 당시): `step` 3, `identityProvider`는 Supabase Auth 발급자 `https://kvzvodzkgrwavncezuiw.supabase.co/auth/v1`, 공개키 주소 `…/auth/v1/.well-known/jwks.json`, 대상 `authenticated`입니다. `allowedRoutes`는 위 다섯 경로(`GET /api/notes`, `POST /api/notes`, `GET /api/notes/:id`, `PUT /api/notes/:id`, `DELETE /api/notes/:id`)입니다. `SUPABASE_URL`이 이 발급자와 다른 프로젝트면 빌드와 `/api/notes`(500 `NOTES_NOT_CONFIGURED`)가 모두 실패합니다.
- 보안 헤더 `X-Content-Type-Options: nosniff`는 2단계와 같이 모든 응답에 붙습니다. `vercel.json`은 `api/notes.js`가 `aleph.config.json`을 읽을 수 있게 함께 배포합니다.
- 다시 실행: Vercel 환경변수 `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_PUBLISHABLE_KEY` 세 개를 넣고, Supabase Authentication > Users > Add user에서 「Auto Confirm User」로 연습용 계정 A·B를 만들고, SQL Editor에서 `public_id` 칸 추가와 가상 메모 네 건의 A 소유 이전 SQL(Git에 올리지 않음)을 실행한 뒤 다시 배포합니다. 정상이면 로그인 전에는 메모가 안 보이고, A로 로그인하면 내 메모가 보이며 추가·수정·삭제가 되고, 지운 메모의 `GET /api/notes/:id`는 404입니다. `curl -s -o /dev/null -w "%{http_code}\n" "https://<배포주소>/api/notes?cb=$(date +%s)"`는 401이어야 정상입니다.

### 3단계 저장점 (2026-10-26)

- 실제 배포에서 학생이 직접 확인한 것: 토큰 없는 `GET /api/notes`와 `DELETE /api/notes/:id`는 401 `LOGIN_REQUIRED`, A 계정 로그인·로그아웃 뒤 화면 상태가 바뀜, 틀린 비밀번호는 「이메일 또는 비밀번호가 맞지 않습니다」로 거절, A의 메모 추가·수정·삭제 동작.
- 설정 대조: `aleph.config.json`의 `step` 3은 빌드가 만드는 `/aleph.json`과 같고, `publicAppUrl`은 프로덕션 주소입니다. `identityProvider`는 `api/notes.js`가 `src/verify-login.mjs`에 넘기는 Supabase 발급자·공개키 주소·대상이고, `allowedRoutes`는 `api/notes.js`와 `vercel.json`이 실제로 받는 다섯 경로입니다. `judgeIssuer`는 운영 측 값 그대로이고, `originalApiUrl`·`restoreRoute`는 5단계 전이라 비어 있습니다. `src/decider.mjs`의 `RULE_IDS`는 `decide()`가 실제로 쓰는 `starter.deny` 하나뿐입니다.
- 자기 점검(`src/attack-check.mjs`) 6개: `/data.json` 메모 없음, 토큰 없는 목록 읽기·추가·삭제 거부, 서명 없는 가짜 토큰 거부, 로그인 상태 추가·수정·삭제(비밀번호·토큰을 쓰지 않으므로 「미실행」).
- 다시 실행: PC의 저장소 폴더 맨 위에 `bundle-notes.json`(커밋하지 않음)을 두고 `git pull && npm run bundle`을 실행합니다. 결과는 `artifacts/submission.json`(커밋하지 않음)입니다.
- 해결 안 된 시험: `npm run test:package`는 2단계부터 `api/notes.js`가 시작 틀 기준표 `package/baseline-functions.json`에 없어서 실패합니다. 기준표를 고칠지는 아직 정하지 않았습니다.

### 3단계 당시 알려진 약점 (4단계에서 주인 확인으로 막음)

3단계의 로그인은 **누가** 요청했는지만 확인했습니다. 목록에는 내 메모만 나왔지만 `GET·PUT·DELETE /api/notes/:id`는 주인을 확인하지 않아, B 계정이 A 메모의 `id`를 알면 읽고 고치고 지울 수 있었습니다.

## 2단계 기록 「자료를 코드 밖으로 옮깁니다」

- 가상 메모 네 건은 Supabase의 `public.notes` 테이블에 있습니다. RLS가 켜져 있고 정책이 없으며, `anon`·`authenticated`의 권한은 모두 회수했습니다. `owner_id uuid` 칸은 나중 로그인 단계를 위해 비워 두었습니다.
- 화면(`/`)은 Vercel 서버 함수 `api/notes.js`(주소 `/api/notes`)를 불러 메모를 보여 줍니다. 함수는 환경변수 `SUPABASE_URL`과 서버 전용 `SUPABASE_SECRET_KEY`로 Supabase를 읽습니다. 키 값은 Vercel 프로젝트의 Environment Variables 비밀 입력란에만 넣고, 코드·Git·브라우저 파일·응답·로그에는 넣지 않습니다.
- 빌드는 더 이상 `public/data.json`을 만들지 않으며, 남아 있던 파일도 지웁니다. 배포의 `/aleph.json`은 계속 만들어지고 `step`은 `aleph.config.json`의 값(2)을 따릅니다.
- `aleph.config.json`: `step` 2, `repoUrl`과 `publicAppUrl`은 실제 저장소·프로덕션 주소입니다. 로그인 발급자(`identityProvider`)와 허용 경로(`allowedRoutes`)는 3단계 전이라 비어 있습니다. `judgeIssuer`는 운영 측 값 그대로입니다. 정책 규칙은 시작 틀의 `starter.deny` 하나뿐입니다.
- 보안 헤더: `vercel.json`의 `headers` 설정으로 모든 응답(`/`, `/aleph.json`, `/api/notes` 등)에 `X-Content-Type-Options: nosniff`를 붙입니다(커밋 `e1d31d8`). 브라우저가 파일 종류를 추측해 다른 형식으로 실행하지 않게 하는 헤더이며, 로그인이나 접근 제한은 아닙니다.
- 다시 실행: Vercel 환경변수 두 개를 넣은 뒤 다시 배포합니다(환경변수를 바꾼 뒤에는 Deployments > Create Deployment > `main`). 정상이면 `/`에 카드 네 장이 보이고, `/data.json`은 404이며, `/api/notes`는 메모 네 건을 돌려줍니다. 환경변수가 없으면 `/api/notes`는 500 `NOTES_NOT_CONFIGURED`를 돌려줍니다. 헤더 확인: `curl -sI "https://<배포주소>/?cb=$(date +%s)" | grep -i x-content-type-options` — `x-content-type-options: nosniff`가 나와야 정상입니다.

### 2단계 당시 알려진 약점 (3단계에서 로그인 확인으로 막음)

2단계의 `/api/notes`는 **로그인 확인이 없는 공개 주소**였습니다. 화면을 거치지 않아도 이 주소를 아는 누구나 메모를 그대로 받을 수 있습니다. 2단계는 메모를 코드 밖으로 옮긴 것이지 접근을 막은 것이 아닙니다. 로그인과 허용 경로는 3단계 이후에 추가합니다.

### 메모 문장 검색 확인 절차

가상 메모 문장이 지금 공개된 곳에 남아 있는지 아래 순서로 검색합니다. 검색어는 `실습용[ ]가상`처럼 정규식으로 써서, 이 README 자체가 검색에 걸리지 않게 합니다. `<배포주소>`는 Vercel 프로덕션 주소입니다.

1. GitHub 최신 파일: `git fetch origin main && git grep -n "실습용[ ]가상" origin/main` — 아무것도 나오지 않아야 정상입니다.
2. GitHub 과거 커밋: `git fetch --depth=1000 origin main && git grep -l "실습용[ ]가상" $(git rev-list origin/main)` — 나오는 커밋이 옛 공개 기록입니다.
3. 현재 배포 정적 파일: `curl -s "https://<배포주소>/?cb=$(date +%s)" | grep -c "실습용[ ]가상"`와 `curl -s "https://<배포주소>/aleph.json?cb=$(date +%s)" | grep -c "실습용[ ]가상"` — 0이어야 정상입니다. `/aleph.json`의 `commit`이 GitHub 최신 커밋과 같은지도 봅니다.
4. 옛 공개 파일: `curl -s -o /dev/null -w "%{http_code}\n" "https://<배포주소>/data.json?cb=$(date +%s)"` — 404여야 정상입니다.
5. 공개 API: `curl -s "https://<배포주소>/api/notes?cb=$(date +%s)" | grep -c "실습용[ ]가상"` — 0보다 크면 아래 「알려진 약점」이 그대로 남아 있다는 뜻입니다.

캐시된 사본을 보지 않도록 매번 새 `cb` 값을 붙입니다.

### 검색 기록 (2026-10-26, 커밋 9cab40e 배포 기준)

| 검색 대상 | 결과 |
|---|---|
| GitHub 최신 파일(`9cab40e`) | 메모 문장 0건 |
| GitHub 과거 커밋 | `6aa304b` Initial commit의 `data.json`, `public/data.json`에 메모 문장 있음 |
| 배포 `/` | 메모 문장 0건, 화면은 `/api/notes`를 읽음 |
| 배포 `/aleph.json` | 메모 문장 0건, `commit` 9cab40e…, `step` 2 |
| 배포 `/data.json` | 파일 없음(조회 실패, 404로 추정) |
| 배포 `/api/notes` | 로그인 없이 메모 네 건(제목·내용)을 그대로 돌려줌 — 공개 API 약점 확인. 키 값은 응답에 없음 (환경변수를 넣은 뒤 새로 배포해 확인) |
| 옛 배포 고유 주소의 `/data.json` | Vercel 로그인 화면으로 이동해 본문 확인 불가 |

### 남은 약점 (해소되지 않음)

- **공개 API:** `/api/notes`는 로그인 확인 없이 메모 네 건을 돌려줍니다. 주소만 알면 누구나 메모를 받을 수 있습니다. (3단계에서 로그인 확인을 붙여 비로그인 요청은 401로 막음)
- **옛 공개 커밋:** 공개 저장소의 `6aa304b`에 메모 문장이 그대로 남아 있습니다. 최신 파일에서 지웠어도 Git 기록으로 누구나 볼 수 있습니다.
- **옛 배포:** 1단계 배포에서 `/data.json`이 비로그인으로 공개되었고, 그 배포들은 Vercel 프로젝트에 아직 남아 있습니다. 지금은 고유 주소가 Vercel 로그인으로 이동하지만 삭제된 것은 아니며, 공개되었던 동안 이미 복사되었을 수 있습니다.

옛 공개 커밋과 옛 배포가 남아 있는 한, 과거 노출은 해소되지 않았습니다. 이번 단계에서 바뀐 것은 최신 코드와 현재 배포에 메모 문장을 더 두지 않는다는 점뿐입니다.
