# BYTE BACK 방어전 시작 틀 R5

이 저장소는 1단계에서 학생 본인이 GitHub 저장소와 Vercel 배포를 만드는 출발점입니다. 포함된 메모 네 건은 가상 자료입니다. 실제 학생 자료, 토큰, 비밀키를 넣지 마세요.

## 학생이 하는 일: 세 걸음

1. GitHub 계정을 만듭니다.
2. 방어전 1단계 카드의 **Deploy** 버튼을 누릅니다. Vercel에 GitHub로 로그인하고, 새 저장소가 **본인 계정의 Public 저장소**인지 확인한 뒤 Deploy를 누릅니다.
3. 배포가 끝나면 화면에 나온 `https://…vercel.app` 주소를 방어전 1단계 카드에 붙여넣고 제출합니다. 저장소 주소나 설정 파일은 적지 않습니다.

배포가 끝나면 `/`에서 점령된 가상 자료실을 볼 수 있습니다. 1단계에서는 `/data.json`에 같은 가상 메모가 공개되었습니다. 이 공개 상태를 확인하는 것이 1단계의 출발점입니다. 1단계 접수와 심판 판정은 포털에서 확인합니다. 지금 상태는 아래 「현재 단계: 10단계」를, 지난 단계 기록은 「9단계 기록」, 「8단계 기록」, 「7단계 기록」, 「6단계 기록」, 「5단계 기록」, 「4단계 기록」, 「3단계 기록」, 「2단계 기록」을 보세요.

## 시작 틀의 자동 처리

`vercel.json`은 정적 결과물 `public`과 `api` 폴더의 서버 함수를 배포합니다. 빌드 명령 `npm run build`는 Vercel이 제공하는 GitHub 저장소 소유자·이름, 커밋 SHA, 배포 URL을 검증하고 `public/aleph.json`을 생성합니다. 이 값이 없으면 빌드가 실패하므로, 성공한 것처럼 빈 주소를 내보내지 않습니다. `aleph.json`의 내용만으로 저장소 소유권이나 방어 성공을 인정하지 않습니다. 심판이 공개 저장소의 실제 커밋과 배포된 자료를 따로 대조해야 합니다.

`aleph.config.json`의 `repoUrl`과 `publicAppUrl`은 1단계 시작 틀에서는 자리표시자였고, 학생이 편집하지 않았습니다. 2단계 저장점(`f53f2cb`)에서 실제 저장소·프로덕션 주소로 채웠습니다. 2단계 이후 코딩 도구가 필요한 설정과 보호 기능을 단계별로 작성합니다. `npm run bundle`과 `bundle-notes.json`도 1단계의 세 걸음에는 포함되지 않습니다.

로컬에서 빌드만 확인할 때는 `npm run build -- --local`을 사용합니다. 로컬 실행은 Vercel 배포나 심판 접수를 증명하지 않습니다. 저장소의 `src/attack-check.mjs`는 `npm run bundle`이 실행하는 자기 점검입니다. 5단계에서는 실제 배포에 `/data.json`(메모가 없어야 함), 토큰 없는 `/api/notes` 읽기·추가와 `/api/notes/:id` 삭제, 서명 없는 가짜 토큰 읽기를 요청하고(모두 401이어야 정상), 배포의 `/login-config.json`에 있는 공개용 키(anon)로 `originalApiUrl`(Supabase Data API의 `notes`)을 직접 읽기·추가하며(권한 없음 42501이어야 정상), 배포된 화면 `/`의 코드에 Data API 직접 호출이 몇 곳인지(0곳이어야 정상) 세어 상태 코드와 건수만 기록합니다. 로그인한 상태의 내 메모 읽기·추가·수정·삭제, B→A 메모 접근, 로그인 토큰으로 원본 직접 읽기는 비밀번호나 토큰을 쓰지 않기 위해 자동 점검에서 빼고 「미실행」으로 남깁니다.

## 다음 단계의 코딩 도구에 전달할 규칙

[AGENTS.md](AGENTS.md)를 먼저 읽히고 한 번에 한 제작 단위만 요청하세요. 2단계부터는 자료 보호를 구현할 때 `public/data.json`을 복사하는 1단계 빌드 흐름도 함께 바꿔야 합니다. 3단계 이후의 로그인, 허용 경로, 5단계의 원본 API 주소, 6단계 이후 정책 규칙은 해당 단계 원고와 계약에 맞춰 추가합니다. 비밀번호·토큰·서버 전용 키·실제 학생 기록을 코드, Git, 제출 묶음에 넣지 않습니다.

`src/decider.mjs`와 `src/detect.mjs`의 로컬 시험은 반 엔진이나 운영 심판의 결과가 아닙니다. 1단계 이후 제출 묶음 계약 `aleph.defense.submission.v2`는 `scripts/bundle.mjs`에 남아 있으며, 코딩 도구가 해당 단계의 최신 배포 주소와 Git 원격을 맞춘 뒤 사용합니다.

## 현재 단계: 10단계 「백업에서 자료실을 되살립니다」

3차 침공(가상 메모와 안전 정책 변조)을 흉내 내고, 침해 전에 검증한 사본에서 대상만 되살렸습니다. 감사 기록은 덧붙이기만 합니다.

- 안전 정책 사본(커밋 `5572304`, `108546d`): `npm run policy:backup`이 `src/decider.mjs` 규칙, `allowedRoutes`, DB 접근 정책을 `policy-backups/verified`에 SHA-256 목록표와 함께 찍었습니다(커밋 `13657d1`, 전체 해시 `226888c1b4811d8f9543726da4a129d86450fba2f4b0f9f90d6b50d9ca2abcd0`). `npm run policy:diff`는 시험용 사본과의 차이만, `npm run policy:restore`는 바뀔 항목과 확인 코드를 먼저 보여 준 뒤 `--apply <코드>`로 바뀐 줄만 되돌리고 `policy-backups/audit.log`에 덧붙입니다. 실제 운영 정책은 바꾸지 않습니다.
- 메모 복원 대상: 시험 계정 B의 가상 메모 한 건, ID `1cd59ee0-e1a1-4d81-a1fc-1bfc3a6ffdb0`(사본 내용 해시 `39509e693024f7ee09fc5ba366a397f9a2aba44cfd156104051594085460c6dc`, 2026-11-07 09:01 UTC에 뜸).
  - 비공개 사본은 Supabase `public.notes_backup`(서버 키로 읽기만, 공개용 키·로그인 토큰 접근 없음)에 있고, 복원 기록은 `public.notes_restore_log`(서버 키로도 추가만)에 남습니다. 메모 문장이 들어 있어 사본과 만든 SQL은 Git에 넣지 않았습니다.
- 복원 경로: 서비스 `notes`, `POST /api/notes/:id/restore`(서버 함수 `api/restore.js`, `src/restore-note.mjs`). 본문은 읽지 않습니다.
  1. 로그인 토큰을 검증하고, `:id`가 위 복원 대상 ID가 아니면 403 `RESTORE_NOT_ALLOWED`입니다.
  2. 사본의 내용 해시를 다시 계산해 다르면 409 `BACKUP_MISMATCH`, 사본 주인이 요청한 사람이 아니면 403 `NOTE_FORBIDDEN`, 지금 행의 주인이 사본과 다르면 409 `OWNER_CONFLICT`로 멈춥니다.
  3. 그 한 행만 사본 내용으로 고치거나(지워졌으면 같은 ID로 다시 넣고), 다시 읽어 ID·주인·내용 해시를 사본과 대조합니다. 응답은 `{id, result, matches, check, contentSha256, logged}`이고 메모 문장·주인 ID는 돌려주지 않습니다. 다른 메모는 건드리지 않고, 결과마다 복원 기록 한 줄을 추가합니다.
- 확인은 시험 계정 B의 이 메모로만 합니다. 2026-11-07 학생이 배포 화면에서 B로 메모를 고친 뒤 복원해 09:07 `restored`, 다시 눌러 09:08 `unchanged`를 받았고, 두 번 모두 ID·주인·내용 해시가 사본과 같았습니다(자동 점검 기록 아님).
- 판정기 `src/decider.mjs`, `RULE_IDS`(`device_registered`, `resource_zone`, `unusual_access`, `step_up_required`, `starter.deny`), DB의 `notes` 정책·권한은 9단계와 같습니다. 정책을 되돌리는 대상은 시험용 사본뿐입니다.
- `aleph.config.json`: `step` 10, `restoreRoute` `POST /api/notes/:id/restore`. 배포 주소, `identityProvider`, `allowedRoutes`(세 경로), `originalApiUrl`, `judgeIssuer`는 9단계와 같습니다.
  - 복원 경로는 판정기 구역 표에 넣지 않아 `allowedRoutes` 밖입니다. 서버 함수가 로그인·대상 ID·사본 해시·주인을 직접 확인합니다. 판정기에 넣으면 검증한 정책 사본과 달라지므로 이번 단계에서는 바꾸지 않았습니다. 심판이 `restoreRoute`를 어떤 모양으로 기대하는지는 문서에 없어 `allowedRoutes`와 같은 「방법 경로」 모양으로 적었습니다.
- 자기 점검(`src/attack-check.mjs`) 20개: 9단계의 20개에서 미실행 두 개를 빼고 새 점검 두 개를 더했습니다. 제출 묶음은 점검을 20개까지만 받습니다.
  - 뺀 것: `logged_in_data_api_direct`(토큰을 쓰지 않아 미실행. Data API 직접 권한이 0개인 것은 DB 정책 사본에 남음), `unregistered_device_access`(심판이 맡아 미실행. 로컬 `decider_device_registered_local`은 그대로).
  - 더한 것: `anonymous_note_restore`(토큰 없는 복원 요청이 401인지, 실제 요청), `policy_restore_local`(사본 해시, 되돌린 시험 정책과의 차이, 운영 판정기·`allowedRoutes`가 검증한 사본과 같은지, 로컬 확인이며 심판 판정 아님).
- 다시 실행: PC PowerShell에서 저장소 폴더(`C:\Users\jny\Documents\choi-bujang-secret-vault`)로 이동해 `git pull` → `npm.cmd run policy:diff`(정상: `차이가 없습니다`) → `npm.cmd run policy:restore`(정상: `되돌릴 것이 없습니다`) → `npm.cmd run decider:test`, `npm.cmd run detect:test`. 그다음 저장소 폴더 맨 위에 `bundle-notes.json`(커밋하지 않음)을 두고 `npm.cmd run bundle`을 실행하면 `artifacts/submission.json`(커밋하지 않음)이 만들어집니다. PowerShell은 `npm.ps1`을 막으므로 `npm.cmd`를 씁니다.
- 해결 안 된 시험과 약점:
  - 확인용 해시가 사본과 같은 폴더에 있어, 사본과 목록표를 함께 바꾸면 사본 검사만으로는 알 수 없습니다. 위 전체 해시를 README와 Git 기록에 남겨 `npm run policy:diff -- --expect <해시>`로 대조할 수 있게 했습니다.
  - 메모 사본은 B의 한 건뿐이고, 사본을 다시 뜨거나 다른 메모를 고르는 경로는 없습니다(SQL로만).
  - 9단계까지의 약점(반 공지·강사 자료 API 없음, 화면이 쓰는 경로가 `allowedRoutes` 밖, `npm run test:package` 실패, 무차별 로그인 보너스 제작 3에서 멈춤, 운영 반 엔진의 사건 전달·회수 미연결)은 그대로입니다.

### 10단계 복구 뒤 다시 확인 순서

정책·자료를 되돌린 뒤 1~9단계의 정상 요청은 그대로 되고 막던 요청은 다시 거부되는지 아래 순서로 확인합니다. 「이번 결과」에는 실제로 실행한 것만 적고, 실행하지 않은 것은 「미실행」으로 둡니다. 로컬 시험은 심판 판정이 아닙니다.

| 순서 | 무엇을 | 어디서 | 정상 결과 | 이번 결과 |
|---|---|---|---|---|
| 1 | 정책이 돌아왔는지: `npm run policy:restore`, `npm run policy:diff`, `git diff 13657d1 -- src/decider.mjs aleph.config.json` | PC PowerShell, 저장소 폴더(`npm.cmd run …`) | 「바뀔 항목 0개」, 「차이가 없습니다」, git 출력 없음(운영 정책이 검증한 버전 그대로) | 2026-11-07 커밋 `e2c75e0`에서 코딩 도구가 실행: 세 가지 모두 정상 |
| 2 | 시험 정책에서 A·B 요청 다시 판정 | `npm run policy:restore -- --apply <코드>` 출력 | A 자기 메모 읽기 allow, B→A 읽기·지우기 deny | 2026-11-07 08:55 되돌릴 때 코딩 도구가 실행: 세 건 통과(로컬 사본 판정) |
| 3 | 자료가 돌아왔는지: 복원 기록 | Supabase > SQL Editor, `public.notes_restore_log` 조회 | `restored`(바뀜, 해시가 사본과 같음) 뒤 `unchanged` | 2026-11-07 09:07:43 `restored`, 09:08:13 `unchanged`, 둘 다 해시 `39509e69…` 일치(학생 실행) |
| 4 | B 메모 복원 요청 | 배포 화면에 B로 로그인 > F12 Console, `POST /api/notes/1cd59ee0-e1a1-4d81-a1fc-1bfc3a6ffdb0/restore` | 200, `matches: true`, 이미 같으면 `unchanged` | 2026-11-07 09:08 200 `unchanged`, `matches: true`(학생 실행) |
| 5 | 로컬 시험 `npm run decider:test`, `detect:test`, `fixture:7`, `test:r5` | PC PowerShell, 저장소 폴더 | 통과 4줄, 통과 6줄, 정상 allow·복합 이상 step_up, pass 2 | 2026-11-07 커밋 `e2c75e0`에서 코딩 도구가 실행: 모두 정상 |
| 6 | 1~9단계 실제 배포 자기 점검 20개(`/data.json` 메모 없음, 토큰 없는 읽기·추가·삭제 401, 가짜 토큰 401, 화면 코드의 직접 자료 호출 0곳, 판정기·탐지 로컬 점검 등) | PC PowerShell, 저장소 폴더 맨 위에 `bundle-notes.json`을 두고 `npm.cmd run bundle` → `artifacts/submission.json` | 실행한 점검은 모두 기대값, 토큰이 필요한 점검은 묶음 안에서도 미실행 | 2026-11-07 09:15 저장점 `cf064e8`에서 학생 노트북으로 실행: 실제 요청 8개 기대대로 거부, 로컬 확인 6개 기대대로, 6개는 묶음 안에서 미실행(토큰·운영 엔진 필요) |
| 7 | A가 자기 메모 목록·한 건 읽기 | 배포 화면에 A로 로그인 | 내 메모만 보임 | 2026-11-07 09:20 A 토큰으로 `GET /api/notes` → 200, 메모 4건(학생 Console 실행, ID만 출력) |
| 8 | B가 A 메모 한 건 읽기 | 배포 화면에 B로 로그인 > F12 Console, `GET /api/notes/<A 메모 ID>` | 403 `NOTE_FORBIDDEN` | 2026-11-07 09:20 B 토큰으로 A 메모 한 건 → 403 `NOTE_FORBIDDEN`(학생 Console 실행) |
| 9 | 공개용 키로 원본 Data API 직접 읽기·추가, 미등록 기기 실제 접속, 재로그인 전 실제 차단, 운영 반 엔진의 접속 회수 | 심판·운영 엔진 | 모두 거부 | 미실행(자동 점검에 공개용 키가 없고, 나머지는 심판·운영 엔진이 맡음) |

## 9단계 기록 「도플갱어를 찾고 권한을 거둡니다」

- 탐지 입력(커밋 `61fa493`): `src/detect.mjs`의 `readEvent`·`readEvents`가 사건마다 `docs/DETECT_EVENTS.md`의 `at`(시각), `method`(요청 종류), `identity.sub`(가명 사용자) 세 값만 꺼냅니다. 네트워크·기기·지역·본문·토큰 같은 다른 칸은 읽지 않고, 세 값의 형식이 맞지 않는 사건은 세지 않으며, 기록·출력은 하지 않습니다.
- 탐지 규칙 `burst_read`(커밋 `4fa7c04`): 같은 `identity.sub`의 `GET` 사건을 `at` 시각만으로 움직이는 10분 창에 세어 120건을 넘으면 `{ action: 'propose_revocation', reasonCode: 'burst_read', subject }`, 그 밖에는 `{ action: 'observe' }`만 돌려줍니다. 정확히 120건, 다른 사용자 합산, 10분 밖 사건은 의심이 아닙니다.
  - 첫 사건과 끝 사건이 정확히 10분 떨어지면 같은 창으로 세지 않고, 여러 사용자가 넘으면 먼저 넘은 한 사용자를 돌려줍니다(원고에 없어 정한 값).
  - 탐지기는 회수를 제안만 합니다. 판정기 `src/decider.mjs`의 응답 형식, API, 기기 권한, DB는 8단계와 같고 회수 API는 만들지 않았습니다. `burst_read`는 판정기 규칙이 아니므로 `RULE_IDS`는 8단계와 같은 `device_registered`, `resource_zone`, `unusual_access`, `step_up_required`, `starter.deny`입니다.
- `aleph.config.json`(9단계 당시): `step` 9. 배포 주소, `identityProvider`, `allowedRoutes`(세 경로), `originalApiUrl`, `judgeIssuer`는 8단계와 같고 `restoreRoute`는 비어 있습니다.
- 자기 점검(`src/attack-check.mjs`, 9단계 당시) 20개: 8단계의 20개에서 `other_owner_live`(B→A 메모 직접 요청, 미실행)를 빼고 탐지 로컬 가상 사건 1개를 더했습니다. 제출 묶음은 점검을 20개까지만 받고, 같은 공격은 4단계의 `cross_owner_note_access`(미실행)로 남아 있습니다. 탐지 점검은 120건·121건·두 사용자 각 100건·느린 200건의 결과를 기록하며 심판 판정이나 실제 회수가 아니고, 운영 반 엔진의 사건 전달·접속 회수는 「미실행」입니다.
- 다시 실행: PC의 Git Bash에서 저장소 폴더(`C:\Users\User\choi-bujang-secret-vault`)로 이동해 `git pull` → `npm run detect:test`(정상: `통과` 여섯 줄) → `npm run decider:test`(정상: `통과` 네 줄). 그다음 저장소 폴더 맨 위에 `bundle-notes.json`(커밋하지 않음)을 두고 `npm run bundle`을 실행하면 `artifacts/submission.json`(커밋하지 않음)이 만들어집니다.
- 해결 안 된 시험과 약점:
  - `npm run detect:test`가 통과해도 운영 반 엔진이 검증한 사건을 전달하거나 회수 제안을 집행하는 경로는 연결·시험하지 않았습니다.
  - 8단계의 약점(반 공지·강사 자료 API 없음, 화면이 쓰는 경로가 `allowedRoutes` 밖, `npm run test:package` 실패, 무차별 로그인 보너스 제작 3에서 멈춤)은 그대로입니다.

2026-11-07 커밋 `4fa7c04`에서 `detect:test` 6개, `decider:test` 4개 통과를 확인했습니다. 가상 사건·요청 연습이며 심판 판정이 아닙니다.

## 8단계 기록 「자료마다 갈 수 있는 구역을 나눕니다」

- 자원 ID(커밋 `eb9a82a`): `src/resources.mjs`가 서버가 확인한 경로만 보고 구역 이름표를 정합니다. 내 메모 목록 `notes/mine`, 메모 한 건 `notes/<번호>`, 반 공지 `notices/<번호>`, 강사 자료 `materials/<번호>`이고, 그 밖은 이름표 없음(거부)입니다. `/api/notes`는 로그인 확인 뒤 응답 머리글 `X-Resource-Id`에 이 값을 붙입니다.
- 판정기 구역 규칙 `resource_zone`(커밋 `e7eb209`): 서비스와 정확한 경로 모양만 허용합니다. 메모는 `GET /notes/:id`만(전체 목록·쓰기 거부), 반 공지는 `GET /notices`, `GET /notices/:id`만(쓰기는 누구에게나 거부), 강사 자료와 알 수 없는 경로는 모두 거부합니다. `path`가 경로 모양과 칸마다 같아야 하고, ID 형식은 좁히지 않으며 쿼리는 쓰지 않습니다. 메모 주인 비교는 판정기에 넣지 않았습니다.
  - `RULE_IDS`: `device_registered`, `resource_zone`, `unusual_access`, `step_up_required`, `starter.deny`. 6·7단계 규칙은 그대로입니다.
- 자료 API 마지막 대조(커밋 `990d225`): `src/access.mjs`가 검증된 토큰 사용자와 저장된 값만 대조합니다. 메모는 `notes.owner_id`(아니면 `not_owner`), 반 공지 쓰기와 강사 자료는 DB `public.instructors` 표에 저장된 강사만(아니면 `not_instructor`)입니다. 화면 메뉴와 요청 본문·머리글·쿼리의 `role`은 읽지 않습니다. 거부하면 서버 기록에 `notes: deny <사유>`만 남깁니다.
  - 2026-11-04 학생이 배포된 화면의 브라우저 Console에서 B 토큰으로 A 메모를 직접 요청해 `403`을 확인했습니다(자동 점검 기록 아님).
- `aleph.config.json`(8단계 당시): `step` 8. 배포 주소, `identityProvider`, `originalApiUrl`, `judgeIssuer`는 7단계와 같습니다. `allowedRoutes`는 판정기가 허용하는 `GET /api/notes/:id`, `GET /api/notices`, `GET /api/notices/:id` 세 개입니다.
- 자기 점검(`src/attack-check.mjs`, 8단계 당시) 20개: 7단계의 16개 + 토큰 없는 메모 한 건 요청에 이름표가 없는지(실제 요청) 1개 + 판정기 구역 규칙 로컬 가상 요청 1개 + `src/access.mjs` 로컬 호출 1개(둘 다 심판 판정 아님) + 다른 사람 메모 직접 요청 1개(토큰을 쓰지 않으므로 「미실행」).
- 다시 실행: PC의 Git Bash에서 저장소 폴더(`C:\Users\User\choi-bujang-secret-vault`)로 이동해 `git pull` → `npm run decider:test`(정상: `통과` 네 줄) → `npm run fixture:7`(정상: `정상 사건: allow`, `복합 이상 사건: step_up`). 그다음 저장소 폴더 맨 위에 `bundle-notes.json`(커밋하지 않음)을 두고 `npm run bundle`을 실행하면 `artifacts/submission.json`(커밋하지 않음)이 만들어집니다.
- 해결 안 된 시험과 약점:
  - 반 공지·강사 자료 API와 자료는 아직 없습니다. 구역 이름과 판정·대조 규칙만 있고, 강사 표 `public.instructors`를 만드는 SQL은 Git에 넣지 않았습니다(아직 읽는 API가 없음).
  - 화면이 쓰는 메모 목록(`GET /api/notes`), 메모 추가·수정·삭제, `/api/session`은 판정기 허용 경로가 아니어서 `allowedRoutes`에서 뺐습니다. 반 엔진을 거치는 실제 접속에서 화면이 어떻게 동작할지는 실측하지 않았습니다.
  - 공지·강사 자료의 서비스 이름(`notices`, `materials`)은 계약에 예시가 없어 정한 이름이고, 거부 이유 코드는 등록 목록을 몰라 기존 `starter_not_ready`를 씁니다.
  - `npm run test:package`는 `api/notes.js`가 `package/baseline-functions.json`에 없어서 계속 실패합니다.
  - 무차별 로그인 보너스(`xdr/brute-force/`, 커밋 `e50c31e`, `b5f8bf7`, `9a2139a`)는 제작 3까지 하고 멈춘 상태입니다.

이 판정기 시험은 미리 만든 가상 요청으로 하는 연습이며, 심판 판정이나 실제 접속 증거가 아닙니다. 2026-11-04 커밋 `990d225`에서 `decider:test` 4개 통과, `fixture:7` 통과를 확인했습니다.

## 7단계 기록 「평소와 다른 접속은 다시 확인합니다」

- 판정기 `src/decider.mjs`에 7단계 변경 세 가지를 넣었습니다. `RULE_IDS`는 `device_registered`, `unusual_access`, `step_up_required`, `starter.deny`입니다. 계약 `docs/DECIDER_REQUEST.md`에 있는 칸만 봅니다.
  - 입력 검사(커밋 `6c97c13`): `signals.source`가 `judge_fixture`(심판 가상 사건)일 때만 지역·네트워크·시각을 쓰고, `none`은 정보 없음, 그 밖의 값·빈 값·틀린 모양은 출처 불명으로 모두 `null`(모름)입니다. 계약에 없는 칸(위조 헤더, `geo` 등)은 읽지 않고 빈 값을 정상값으로 채우지 않습니다.
  - `unusual_access`(커밋 `5011744`): 등록 기기의 읽기 허용 조건을 통과한 요청이라도 심판 가상 사건에서 새벽 0~5시 + 처음 보는 네트워크(`unusual`) + 최근 5분 안 사건 수 합 10건 이상이 한꺼번에 겹치면 `step_up`, 이유 코드 `step_up_required`. 지역은 조건에 없어 지역 하나만으로는 막지 않고, 영구 차단도 하지 않습니다.
  - `step_up_required`(커밋 `9eb180c`): 복합 이상 요청은 `stepUp.verified`가 `true`이고 `authAgeSeconds`가 0~900초 정수이며 그 로그인이 가장 최근 이상 사건보다 나중일 때만 `allow`·`approved`로 다시 판정합니다. 하나라도 아니면 `step_up`을 유지합니다. 판정기는 토큰을 받지도 기록하지도 않습니다.
  - 6단계 `device_registered` 규칙(미등록 기기 거부, 읽기만 허용)은 그대로입니다.
- 자료실 주소, 화면, `/api/notes`, `/api/session`, DB 권한은 6단계와 같습니다.
- `aleph.config.json`: `step` 7. 배포 주소, `identityProvider`, `allowedRoutes`(일곱 경로), `originalApiUrl`, `judgeIssuer`는 6단계와 같고 `restoreRoute`는 비어 있습니다.
- 자기 점검(`src/attack-check.mjs`) 16개: 6단계의 14개 + 판정기 로컬 가상 요청 1개(정상 allow, 복합 이상 step_up, 새 로그인 뒤 allow, 출처 `browser` 위조는 규칙이 켜지지 않음을 기록하며 심판 판정이 아님) + 실제 재로그인 전 차단·새 요청 허용 1개(계약이 준비된 반 엔진이 이 환경에 없어 「미실행」).
- 다시 실행: PC의 Git Bash에서 저장소 폴더(`C:\Users\User\choi-bujang-secret-vault`)로 이동해 `git pull` → `npm run decider:test`(정상: `통과` 네 줄) → `npm run fixture:7`(정상: `정상 사건: allow`, `복합 이상 사건: step_up`)을 실행합니다. 그다음 저장소 폴더 맨 위에 `bundle-notes.json`(커밋하지 않음)을 두고 `npm run bundle`을 실행하면 `artifacts/submission.json`(커밋하지 않음)이 만들어집니다.
- 해결 안 된 시험과 약점:
  - 실제 접속 경로에서는 엔진이 `signals.source: "none"`, 지역·네트워크 `unknown`을 보내므로 `unusual_access`는 심판 가상 사건에서만 켜집니다. 실제 재로그인 전 차단은 실측하지 않았습니다.
  - 기준값(새벽 0~5시, 5분, 10건)은 단계 원고에 숫자가 없어 가상 사건과 정상 사건을 가르도록 정한 값입니다.
  - `npm run test:package`는 `api/notes.js`가 `package/baseline-functions.json`에 없어서 계속 실패합니다.
  - 무차별 로그인 보너스(`xdr/brute-force/`, 커밋 `e50c31e`, `b5f8bf7`, `9a2139a`)는 제작 3까지 하고 멈춘 상태입니다.

이 판정기 시험은 미리 만든 가상 요청으로 하는 연습이며, 심판 판정이나 실제 접속 증거가 아닙니다. 2026-11-04 커밋 `9eb180c`에서 `decider:test` 4개 통과, `fixture:7` 통과를 확인했습니다.

## 6단계 기록 「등록한 기기만 자료실에 들어옵니다」

- 판정기 `src/decider.mjs`에 규칙 `device_registered`를 넣었습니다(커밋 `deca797`, `6227e1d`, 저장점 `97bd0a3`). 6단계 당시 `RULE_IDS`는 `device_registered`, `starter.deny`였습니다. 계약 `docs/DECIDER_REQUEST.md`에 있는 칸만 봅니다.
  - `deviceRegistered`가 `true`가 아니면(false이거나 값이 없으면) `deny`, 이유 코드 `device_not_registered`
  - 등록 기기이고, `subjectId`(로그인한 주체)가 있고, `method`가 `GET`(읽기)이고, `route`가 `GET /`로 시작하면 `allow`, 이유 코드 `approved`
  - 그 밖(로그인 없음, 추가·수정·삭제, 동작과 경로가 다름)은 `deny`, `starter.deny`
- 자료실 주소, 화면, `/api/notes`, `/api/session`, DB 권한은 5단계와 같습니다. 따로 설치할 접속 프로그램은 없고, 실제 미등록 기기 공격은 심판이 맡습니다.
- `aleph.config.json`(6단계 당시): `step` 6. `identityProvider`, `allowedRoutes`(일곱 경로), `originalApiUrl`, `judgeIssuer`는 5단계와 같고 `restoreRoute`는 비어 있습니다. `RULE_IDS`는 실제로 쓰는 `device_registered`와 기본 거부 `starter.deny` 두 개입니다.
- 자기 점검(`src/attack-check.mjs`) 14개: 5단계의 12개 + 판정기 로컬 가상 요청 1개(등록 기기 allow·approved, 미등록 기기 deny·device_not_registered를 기록하며 심판 판정이 아님) + 미등록 기기 실제 접속 1개(심판이 맡으므로 「미실행」).
- 다시 실행: 아래 확인 순서로 판정기를 시험한 뒤, PC의 저장소 폴더 맨 위에 `bundle-notes.json`(커밋하지 않음)을 두고 Git Bash에서 `git pull && npm run bundle`을 실행하면 `artifacts/submission.json`(커밋하지 않음)이 만들어집니다.
- 해결 안 된 시험과 약점: `npm run test:package`는 `api/notes.js`가 `package/baseline-functions.json`에 없어서 계속 실패합니다. 판정기는 시작 틀이 아는 이유 코드(`approved`, `device_not_registered`, `starter_not_ready`)만 씁니다. 무차별 로그인 보너스(`xdr/brute-force/`, 커밋 `e50c31e`, `b5f8bf7`, `9a2139a`)는 제작 3까지 하고 멈춘 상태입니다.

### 6단계 판정기 확인 순서

PC의 Git Bash에서 저장소 폴더(`C:\Users\User\choi-bujang-secret-vault`)로 이동한 뒤 차례로 실행합니다.

1. `git pull`
2. `npm run decider:test`
   - 정상: `통과 · 등록 기기의 정상 요청`, `통과 · 미등록 기기의 가상 요청` 두 줄이 나오고 오류 없이 끝납니다.
   - 거부되어야 할 결과가 허용되면: 해당 줄이 `확인 필요`로 나오고 명령이 실패합니다.
3. 판정기 응답 글자를 직접 보려면 같은 곳에서 아래 한 줄을 실행합니다(파일을 만들지 않습니다).

   ```bash
   node --input-type=module -e 'import { decide } from "./src/decider.mjs"; import { fixtureRequests } from "./scripts/fixture-7.mjs"; const { normal } = fixtureRequests(); for (const [name, r] of [["등록 기기", normal], ["미등록 기기", { ...normal, deviceRegistered: false }]]) { const o = await decide(r); console.log(name, o.decision, o.reasonCode, o.ruleIds.join(",")); }'
   ```

   - 정상: `등록 기기 allow approved device_registered`
   - 거부되어야 할 결과: `미등록 기기 deny device_not_registered device_registered`

이 시험은 미리 만든 가상 요청으로 하는 연습이며, 심판 판정이나 실제 기기 접속 증거가 아닙니다. 2026-11-04 커밋 `6227e1d`에서 위 두 명령 모두 정상 결과가 나왔습니다.

## 5단계 기록 「자료 요청을 서버 한곳으로 모읍니다」

- 브라우저(`public/index.html`)의 메모 읽기·추가·수정·삭제는 모두 Vercel 서버 함수 `/api/notes`를 거칩니다. 브라우저가 Supabase를 부르는 곳은 로그인(`supabase.auth`의 signInWithPassword·signOut·onAuthStateChange·getSession)뿐이고, `.from('notes')`나 `/rest/v1` 같은 직접 자료 호출은 없습니다(4단계부터 이미 없어 화면 코드는 바꾸지 않음).
- DB(`public.notes`만): `PUBLIC`·`anon`·`authenticated`의 직접 권한을 모두 회수했습니다. 4단계에서 `authenticated`에 주었던 SELECT·INSERT·UPDATE·DELETE도 거둬서, 로그인한 사람의 토큰으로도 Data API를 직접 부를 수 없습니다. RLS와 정책 네 개는 켠 채로 두어, 나중에 실수로 권한이 다시 생겨도 남의 행은 막습니다. `service_role`(서버 전용 키) 권한은 Supabase 기본값 그대로이며 다른 테이블은 건드리지 않았습니다.
- 서버 함수(`api/notes.js`)는 바꾸지 않았습니다. 로그인 토큰 검증(401), 주인 확인(남의 메모 403, 없는 메모 404), 본문 `owner_id` 거절(400), 서버 전용 키 `SUPABASE_SECRET_KEY` 사용은 4단계와 같습니다.
- `aleph.config.json`(5단계 당시): `step` 5. `originalApiUrl`은 원본 자료 API의 쿼리 없는 HTTPS 주소 `https://kvzvodzkgrwavncezuiw.supabase.co/rest/v1/notes`(커밋 `093b783`)로, `identityProvider.issuer`와 같은 Supabase 프로젝트이고 `api/notes.js`가 서버 전용 키로 읽고 쓰는 바로 그 테이블입니다. 심판은 이 주소를 공개용 키(anon)로 직접 불러 거부되는지 봅니다. `identityProvider`, `allowedRoutes`(다섯 경로), `judgeIssuer`는 4단계와 같고 `restoreRoute`는 비어 있습니다. `src/decider.mjs`의 `RULE_IDS`는 `starter.deny` 하나뿐입니다.
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
