// 12단계 탈환 작전실 요약: GET /api/ops (src/ops-summary.mjs)
// 로그인 토큰을 서버가 먼저 검증하고(없으면 401), 승인된 기기에서만 돌려줍니다(아니면 403).
// 판정기 규칙·탐지 사건·회수 상태·복구 버전을 칸마다 confirmed / not_run / unavailable로 나눠 돌려줍니다.
// 메모 제목·본문, 사용자 ID, 토큰, 기기 비밀값, 키는 응답과 기록에 넣지 않습니다.
// 이 경로는 판정기 구역 표에 넣지 않아 allowedRoutes 밖이며, /api/device처럼 서버 함수가 직접 확인합니다.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { createLoginVerifier } from '../src/verify-login.mjs';
import { checkApprovedDevice } from '../src/device-approval.mjs';
import { buildOpsSummary } from '../src/ops-summary.mjs';

const config = JSON.parse(readFileSync(new URL('../aleph.config.json', import.meta.url), 'utf8'));

let server;

function setup() {
  if (server) return server;
  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) throw new Error('ops: SUPABASE_URL or SUPABASE_SECRET_KEY is not set');
  if (new URL(url).origin !== new URL(config.identityProvider?.issuer ?? 'https://invalid.invalid').origin) {
    throw new Error('ops: SUPABASE_URL does not match aleph.config.json identityProvider.issuer');
  }
  const supabase = createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  server = { supabase, verifyLogin: createLoginVerifier({ config, supabaseSecretKey: secretKey }) };
  return server;
}

// 테스트에서 가짜 DB·로그인·파일을 넣을 수 있게 만든 처리 함수입니다.
export async function handleOps(request, response, { supabase, verifyLogin, files }) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    return;
  }
  const user = await verifyLogin(request.headers.authorization);
  if (!user) {
    response.setHeader('WWW-Authenticate', 'Bearer');
    response.status(401).json({ error: 'LOGIN_REQUIRED' });
    return;
  }
  try {
    const device = await checkApprovedDevice({ supabase, user, cookieHeader: request.headers.cookie });
    if (!device.allowed) {
      console.warn(`ops: deny ${device.reason}`);
      response.status(403).json({ error: 'DEVICE_NOT_APPROVED' });
      return;
    }
  } catch (error) {
    console.error('ops: device check failed', error?.code ?? 'unknown');
    response.status(503).json({ error: 'DEVICE_CHECK_UNAVAILABLE' });
    return;
  }
  const summary = await buildOpsSummary({ supabase, user, config, files });
  response.status(200).json(summary);
}

export default async function handler(request, response) {
  let deps;
  try {
    deps = setup();
  } catch (error) {
    console.error(error.message);
    response.setHeader('Cache-Control', 'no-store');
    response.status(500).json({ error: 'OPS_NOT_CONFIGURED' });
    return;
  }
  await handleOps(request, response, deps);
}
