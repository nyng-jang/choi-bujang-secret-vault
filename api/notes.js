// Stage 3: every request must carry a login token that this server verifies.
// The Supabase secret key stays in Vercel environment variables. Never put it
// (or a user's token) in public files, responses, or logs.
// Known weakness until stage 4: any logged-in account can read, edit, and
// delete every note, not just its own. Login only proves who is asking.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { createLoginVerifier } from '../src/verify-login.mjs';

const config = JSON.parse(readFileSync(new URL('../aleph.config.json', import.meta.url), 'utf8'));
const TITLE_MAX = 100;
const CONTENT_MAX = 2000;
const ID = /^[1-9][0-9]{0,15}$/u;

let server;

function setup() {
  if (server) return server;
  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) throw new Error('notes: SUPABASE_URL or SUPABASE_SECRET_KEY is not set');
  if (new URL(url).origin !== new URL(config.identityProvider?.issuer ?? 'https://invalid.invalid').origin) {
    throw new Error('notes: SUPABASE_URL does not match aleph.config.json identityProvider.issuer');
  }
  const supabase = createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const verifyLogin = createLoginVerifier({ config, supabaseSecretKey: secretKey });
  server = { supabase, verifyLogin };
  return server;
}

function fail(response, status, error) {
  response.status(status).json({ error });
}

function noteInput(body, { partial }) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const keys = Object.keys(body);
  if (!keys.length || keys.some(key => key !== 'title' && key !== 'content')) return null;
  const note = {};
  if ('title' in body) {
    if (typeof body.title !== 'string') return null;
    const title = body.title.trim();
    if (!title || title.length > TITLE_MAX) return null;
    note.title = title;
  } else if (!partial) return null;
  if ('content' in body) {
    if (typeof body.content !== 'string' || body.content.length > CONTENT_MAX) return null;
    note.content = body.content;
  } else if (!partial) return null;
  return note;
}

function noteView(row, user) {
  return { id: row.id, title: row.title, content: row.content, mine: row.owner_id === user.userId };
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(request.method)) {
    response.setHeader('Allow', 'GET, POST, PATCH, DELETE');
    fail(response, 405, 'METHOD_NOT_ALLOWED');
    return;
  }
  let supabase;
  let verifyLogin;
  try {
    ({ supabase, verifyLogin } = setup());
  } catch (error) {
    console.error(error.message);
    fail(response, 500, 'NOTES_NOT_CONFIGURED');
    return;
  }

  // The server decides who is asking. The note owner never comes from the body.
  const user = await verifyLogin(request.headers.authorization);
  if (!user) {
    response.setHeader('WWW-Authenticate', 'Bearer');
    fail(response, 401, 'LOGIN_REQUIRED');
    return;
  }

  const id = typeof request.query?.id === 'string' ? request.query.id : undefined;
  if ((request.method === 'PATCH' || request.method === 'DELETE') && !ID.test(id ?? '')) {
    fail(response, 400, 'INVALID_NOTE_ID');
    return;
  }
  if ((request.method === 'POST' || request.method === 'PATCH')
      && !String(request.headers['content-type'] ?? '').startsWith('application/json')) {
    fail(response, 415, 'JSON_REQUIRED');
    return;
  }

  try {
    if (request.method === 'GET') {
      const { data, error } = await supabase.from('notes')
        .select('id, owner_id, title, content').order('id', { ascending: true });
      if (error) throw error;
      response.status(200).json({ notes: data.map(row => noteView(row, user)) });
      return;
    }
    if (request.method === 'DELETE') {
      const { data, error } = await supabase.from('notes').delete().eq('id', id).select('id');
      if (error) throw error;
      if (!data.length) { fail(response, 404, 'NOTE_NOT_FOUND'); return; }
      response.status(200).json({ deleted: data[0].id });
      return;
    }
    const note = noteInput(request.body, { partial: request.method === 'PATCH' });
    if (!note) { fail(response, 400, 'INVALID_NOTE'); return; }
    if (request.method === 'POST') {
      const { data, error } = await supabase.from('notes')
        .insert({ ...note, owner_id: user.userId })
        .select('id, owner_id, title, content').single();
      if (error) throw error;
      response.status(201).json({ note: noteView(data, user) });
      return;
    }
    const { data, error } = await supabase.from('notes').update(note).eq('id', id)
      .select('id, owner_id, title, content');
    if (error) throw error;
    if (!data.length) { fail(response, 404, 'NOTE_NOT_FOUND'); return; }
    response.status(200).json({ note: noteView(data[0], user) });
  } catch (error) {
    console.error('notes: query failed', error?.code ?? 'unknown');
    fail(response, 502, 'NOTES_UNAVAILABLE');
  }
}
