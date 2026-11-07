// 11단계 기기 승인: 서버가 이 기기를 등록 기기로 확인했는지 정합니다.
// - 기기 비밀값은 서버가 만들어 HttpOnly 쿠키로만 돌려줍니다. 화면 코드는 읽지 못하고,
//   localStorage·sessionStorage·IndexedDB에는 아무것도 넣지 않습니다.
// - DB(public.device_registrations, 서버 키로만 접근)에는 비밀값의 SHA-256과 상태만 둡니다.
// - 이 코드는 'pending'(대기)만 만듭니다. 'approved'(승인)는 자료실 주인이
//   Supabase SQL Editor에서 직접 바꿉니다. 화면의 버튼이나 요청 본문으로는 승인되지 않습니다.
// - 앱 설치 여부, 요청 머리글·본문·쿼리의 값은 읽지 않습니다.
import { createHash, randomBytes } from 'node:crypto';

export const DEVICE_COOKIE = 'bb_device';
const SECRET = /^[A-Za-z0-9_-]{43}$/u; // 32바이트 base64url
const MAX_AGE = 60 * 60 * 24 * 30; // 30일
const TABLE = 'device_registrations';

export function secretSha256(secret) {
  return createHash('sha256').update(secret, 'utf8').digest('hex');
}

// Cookie 머리글에서 이 자료실의 기기 비밀값 하나만 꺼냅니다. 모양이 틀리면 없음.
export function readDeviceSecret(cookieHeader) {
  if (typeof cookieHeader !== 'string' || cookieHeader.length > 8192) return null;
  const values = cookieHeader.split(';').map(part => part.trim())
    .filter(part => part.startsWith(`${DEVICE_COOKIE}=`))
    .map(part => part.slice(DEVICE_COOKIE.length + 1));
  if (values.length !== 1 || !SECRET.test(values[0])) return null;
  return values[0];
}

export function deviceCookie(secret) {
  return `${DEVICE_COOKIE}=${secret}; Path=/api; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Strict`;
}

const view = row => ({ status: row.status, deviceId: row.device_id });

// 이 사람 + 이 기기 한 쌍의 상태: none(요청 전) | pending | approved | revoked
export async function readDeviceStatus({ supabase, user, cookieHeader }) {
  const secret = readDeviceSecret(cookieHeader);
  if (!secret) return { status: 'none', deviceId: null };
  const { data, error } = await supabase.from(TABLE).select('device_id, status')
    .eq('user_id', user.userId).eq('secret_sha256', secretSha256(secret)).maybeSingle();
  if (error) throw error;
  return data ? view(data) : { status: 'none', deviceId: null };
}

// 승인 요청: 이미 있으면 그대로 돌려주고, 없으면 'pending' 한 줄만 만듭니다.
// 돌려주는 setCookie는 새 비밀값을 만들었을 때만 있습니다.
export async function requestDeviceApproval({ supabase, user, cookieHeader }) {
  let secret = readDeviceSecret(cookieHeader);
  let setCookie = null;
  if (secret) {
    const current = await readDeviceStatus({ supabase, user, cookieHeader });
    if (current.status !== 'none') return { ...current, setCookie };
  } else {
    secret = randomBytes(32).toString('base64url');
    setCookie = deviceCookie(secret);
  }
  const { data, error } = await supabase.from(TABLE)
    .insert({ device_id: randomBytes(8).toString('hex'), user_id: user.userId,
      secret_sha256: secretSha256(secret), status: 'pending' })
    .select('device_id, status').single();
  if (error) throw error;
  return { ...view(data), setCookie };
}

// 보호 자료 API가 부릅니다. 승인된 기기만 통과합니다.
// 심판 토큰(운영 측 ES256 서명, 15분)은 운영 릴레이가 판정기보다 먼저 기기를 확인해 보내므로
// (docs/DECIDER_REQUEST.md) 이 자료실의 기기 표로 다시 막지 않습니다.
export async function checkApprovedDevice({ supabase, user, cookieHeader }) {
  if (user.kind === 'judge') return { allowed: true, reason: 'relay_checked' };
  const device = await readDeviceStatus({ supabase, user, cookieHeader });
  return device.status === 'approved'
    ? { allowed: true, reason: 'device_approved' }
    : { allowed: false, reason: `device_${device.status}` };
}
