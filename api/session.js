// Login and logout run on this server so the browser never receives a
// Supabase key (stage 5 bonus). The browser only gets its own access token.
// Routes:
//   POST /api/session     {email,password} -> {accessToken,expiresAt,email}
//   DELETE /api/session   Authorization: Bearer <token> -> 204 (ends the Supabase session)
// Never log or return the password, the refresh token, or any key.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { createLoginVerifier } from '../src/verify-login.mjs';

const config = JSON.parse(readFileSync(new URL('../aleph.config.json', import.meta.url), 'utf8'));
const NO_SESSION = { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false };
// Supabase Auth error codes the screen explains. Anything else is "unknown".
const REASONS = new Set(['invalid_credentials', 'email_not_confirmed', 'over_request_rate_limit',
  'over_email_send_rate_limit', 'user_banned', 'validation_failed']);

let server;

function setup() {
  if (server) return server;
  const url = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !publishableKey || !secretKey) {
    throw new Error('session: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY or SUPABASE_SECRET_KEY is not set');
  }
  if (new URL(url).origin !== new URL(config.identityProvider?.issuer ?? 'https://invalid.invalid').origin) {
    throw new Error('session: SUPABASE_URL does not match aleph.config.json identityProvider.issuer');
  }
  const admin = createClient(url, secretKey, { auth: NO_SESSION });
  const verifyLogin = createLoginVerifier({ config, supabaseSecretKey: secretKey });
  server = { url, publishableKey, admin, verifyLogin };
  return server;
}

function fail(response, status, error, reason) {
  response.status(status).json(reason ? { error, reason } : { error });
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (!['POST', 'DELETE'].includes(request.method)) {
    response.setHeader('Allow', 'POST, DELETE');
    fail(response, 405, 'METHOD_NOT_ALLOWED');
    return;
  }
  let s;
  try {
    s = setup();
  } catch (error) {
    console.error(error.message);
    fail(response, 500, 'SESSION_NOT_CONFIGURED');
    return;
  }

  if (request.method === 'DELETE') {
    const user = await s.verifyLogin(request.headers.authorization);
    if (!user) {
      response.setHeader('WWW-Authenticate', 'Bearer');
      fail(response, 401, 'LOGIN_REQUIRED');
      return;
    }
    if (user.kind === 'student') {
      const token = request.headers.authorization.slice('Bearer '.length);
      const { error } = await s.admin.auth.admin.signOut(token, 'local');
      if (error) console.error('session: sign out failed', error.code ?? error.status ?? 'unknown');
    }
    response.status(204).end();
    return;
  }

  if (!String(request.headers['content-type'] ?? '').startsWith('application/json')) {
    fail(response, 415, 'JSON_REQUIRED');
    return;
  }
  const input = request.body;
  if (!input || typeof input !== 'object' || Array.isArray(input)
      || Object.keys(input).some(key => !['email', 'password'].includes(key))
      || typeof input.email !== 'string' || typeof input.password !== 'string'
      || !input.email.trim() || input.email.length > 320
      || !input.password || input.password.length > 1024) {
    fail(response, 400, 'INVALID_LOGIN');
    return;
  }

  // A new client per request, so one person's session never sits in a client
  // that the next request (someone else) would reuse.
  const auth = createClient(s.url, s.publishableKey, { auth: NO_SESSION }).auth;
  let result;
  try {
    result = await auth.signInWithPassword({ email: input.email.trim(), password: input.password });
  } catch {
    fail(response, 502, 'LOGIN_FAILED', 'auth_unreachable');
    return;
  }
  const { data, error } = result;
  if (error || !data?.session?.access_token) {
    if (error?.name === 'AuthRetryableFetchError' || error?.status === 0) {
      fail(response, 502, 'LOGIN_FAILED', 'auth_unreachable');
      return;
    }
    const reason = REASONS.has(error?.code) ? error.code : 'unknown';
    const status = reason.startsWith('over_') ? 429 : reason === 'validation_failed' ? 400 : 401;
    fail(response, status, 'LOGIN_FAILED', reason);
    return;
  }
  response.status(200).json({
    accessToken: data.session.access_token,
    expiresAt: data.session.expires_at,
    email: data.user?.email ?? null,
  });
}
