// 10단계 복원 경로: POST /api/notes/:id/restore (vercel.json이 /api/restore?id=:id로 보냄)
// 로그인 토큰을 서버가 검증하고, 비공개 사본(public.notes_backup)에서 복원 대상 한 건만 되살립니다.
// 요청 본문은 읽지 않습니다. 주인은 언제나 검증된 토큰의 사용자이고, 사본의 주인과 같아야 합니다.
// 서버 전용 키는 Vercel 환경변수에만 있습니다. 응답·기록에 키·토큰·메모 문장을 넣지 않습니다.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { createLoginVerifier } from '../src/verify-login.mjs';
import { restoreNote } from '../src/restore-note.mjs';
import { checkApprovedDevice } from '../src/device-approval.mjs';

const config = JSON.parse(readFileSync(new URL('../aleph.config.json', import.meta.url), 'utf8'));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

let server;

function setup() {
  if (server) return server;
  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) throw new Error('restore: SUPABASE_URL or SUPABASE_SECRET_KEY is not set');
  if (new URL(url).origin !== new URL(config.identityProvider?.issuer ?? 'https://invalid.invalid').origin) {
    throw new Error('restore: SUPABASE_URL does not match aleph.config.json identityProvider.issuer');
  }
  const supabase = createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  server = { supabase, verifyLogin: createLoginVerifier({ config, supabaseSecretKey: secretKey }) };
  return server;
}

// 테스트에서 가짜 DB·로그인을 넣을 수 있게 만든 처리 함수입니다.
export async function handleRestore(request, response, { supabase, verifyLogin }) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    return;
  }
  const user = await verifyLogin(request.headers.authorization);
  if (!user) {
    response.setHeader('WWW-Authenticate', 'Bearer');
    response.status(401).json({ error: 'LOGIN_REQUIRED' });
    return;
  }
  // 11단계: 서버가 이 기기를 승인했을 때만 복원합니다. 확인을 못 하면 멈춥니다.
  try {
    const device = await checkApprovedDevice({ supabase, user, cookieHeader: request.headers.cookie });
    if (!device.allowed) {
      console.warn(`restore: deny ${device.reason}`);
      response.status(403).json({ error: 'DEVICE_NOT_APPROVED' });
      return;
    }
  } catch (error) {
    console.error('restore: device check failed', error?.code ?? 'unknown');
    response.status(503).json({ error: 'DEVICE_CHECK_UNAVAILABLE' });
    return;
  }
  const id = request.query?.id;
  if (typeof id !== 'string' || !UUID.test(id)) {
    response.status(400).json({ error: 'INVALID_NOTE_ID' });
    return;
  }
  const noteId = id.toLowerCase();
  response.setHeader('X-Resource-Id', `notes/${noteId}`);
  try {
    const outcome = await restoreNote({ supabase, user, noteId });
    if (outcome.status !== 200) console.warn(`restore: ${outcome.log}`);
    response.status(outcome.status).json(outcome.body);
  } catch (error) {
    console.error('restore: query failed', error?.code ?? 'unknown');
    response.status(502).json({ error: 'RESTORE_UNAVAILABLE' });
  }
}

export default async function handler(request, response) {
  let deps;
  try {
    deps = setup();
  } catch (error) {
    console.error(error.message);
    response.setHeader('Cache-Control', 'no-store');
    response.status(500).json({ error: 'RESTORE_NOT_CONFIGURED' });
    return;
  }
  await handleRestore(request, response, deps);
}
