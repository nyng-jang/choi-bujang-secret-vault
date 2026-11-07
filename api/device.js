// 11단계 기기 승인 요청과 결과 확인 (src/device-approval.mjs)
//   GET  /api/device   로그인한 사람 + 이 기기의 상태 {status, deviceId}
//   POST /api/device   승인 요청: 'pending' 한 줄을 만들고 기기 비밀값을 HttpOnly 쿠키로 돌려줌
// 두 경로 모두 로그인 토큰을 서버가 먼저 검증합니다(없으면 401).
// 승인은 이 경로로 할 수 없습니다. 자료실 주인이 Supabase SQL Editor에서 'approved'로 바꿉니다.
// 요청 본문은 읽지 않습니다. 응답·기록에 기기 비밀값, 토큰, 사용자 ID를 넣지 않습니다.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { createLoginVerifier } from '../src/verify-login.mjs';
import { readDeviceStatus, requestDeviceApproval } from '../src/device-approval.mjs';

const config = JSON.parse(readFileSync(new URL('../aleph.config.json', import.meta.url), 'utf8'));

let server;

function setup() {
  if (server) return server;
  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) throw new Error('device: SUPABASE_URL or SUPABASE_SECRET_KEY is not set');
  if (new URL(url).origin !== new URL(config.identityProvider?.issuer ?? 'https://invalid.invalid').origin) {
    throw new Error('device: SUPABASE_URL does not match aleph.config.json identityProvider.issuer');
  }
  const supabase = createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  server = { supabase, verifyLogin: createLoginVerifier({ config, supabaseSecretKey: secretKey }) };
  return server;
}

// 테스트에서 가짜 DB·로그인을 넣을 수 있게 만든 처리 함수입니다.
export async function handleDevice(request, response, { supabase, verifyLogin }) {
  response.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'POST'].includes(request.method)) {
    response.setHeader('Allow', 'GET, POST');
    response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    return;
  }
  const user = await verifyLogin(request.headers.authorization);
  if (!user) {
    response.setHeader('WWW-Authenticate', 'Bearer');
    response.status(401).json({ error: 'LOGIN_REQUIRED' });
    return;
  }
  if (user.kind === 'judge') {
    // 심판 요청은 운영 릴레이가 기기를 확인합니다. 이 자료실의 기기 표에는 쓰지 않습니다.
    response.status(200).json({ status: 'relay_checked', deviceId: null });
    return;
  }
  const cookieHeader = request.headers.cookie;
  try {
    if (request.method === 'GET') {
      response.status(200).json(await readDeviceStatus({ supabase, user, cookieHeader }));
      return;
    }
    const result = await requestDeviceApproval({ supabase, user, cookieHeader });
    if (result.setCookie) response.setHeader('Set-Cookie', result.setCookie);
    console.warn(`device: request ${result.status}`);
    response.status(result.setCookie ? 201 : 200).json({ status: result.status, deviceId: result.deviceId });
  } catch (error) {
    console.error('device: query failed', error?.code ?? 'unknown');
    response.status(503).json({ error: 'DEVICE_CHECK_UNAVAILABLE' });
  }
}

export default async function handler(request, response) {
  let deps;
  try {
    deps = setup();
  } catch (error) {
    console.error(error.message);
    response.setHeader('Cache-Control', 'no-store');
    response.status(500).json({ error: 'DEVICE_NOT_CONFIGURED' });
    return;
  }
  await handleDevice(request, response, deps);
}
