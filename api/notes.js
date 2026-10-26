// Every request must carry a login token that this server verifies (stage 3),
// and every note is limited to its owner (stage 4).
// The Supabase secret key stays in Vercel environment variables. Never put it
// (or a user's token) in public files, responses, or logs.
// Routes (vercel.json rewrites /api/notes/:id to this function with ?id=):
//   GET /api/notes          the logged-in user's notes [{id,title,body}]
//   POST /api/notes         {id?,title,body} -> 201 {id}
//   GET /api/notes/:id      {id,title,body}
//   PUT /api/notes/:id      {title,body} -> {id,title,body}
//   DELETE /api/notes/:id   -> {id}
// Stage 4 owner check: the owner is always the verified token's user ID, never
// a value from the URL or body. /:id routes compare it with the row's owner_id
// and deny by default: missing note 404, someone else's note 403 NOTE_FORBIDDEN.
// Writes also filter on owner_id so the database only touches the caller's row.
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { createLoginVerifier } from '../src/verify-login.mjs';

const config = JSON.parse(readFileSync(new URL('../aleph.config.json', import.meta.url), 'utf8'));
const TITLE_MAX = 100;
const BODY_MAX = 2000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
// public_id is the note's UUID. The bigint id column stays internal.
const COLUMNS = 'public_id, title, content';
const OWNED_COLUMNS = `${COLUMNS}, owner_id`;

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

function noteView(row) {
  return { id: row.public_id, title: row.title, body: row.content };
}

function isOwner(row, user) {
  return typeof row?.owner_id === 'string'
    && row.owner_id.toLowerCase() === user.userId.toLowerCase();
}

// Only these fields are read from the request body. userId, role, owner_id,
// or anything else the browser sends is rejected, never trusted.
function noteInput(input, allowed) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  if (Object.keys(input).some(key => !allowed.includes(key))) return null;
  if (typeof input.title !== 'string' || typeof input.body !== 'string') return null;
  const title = input.title.trim();
  if (!title || title.length > TITLE_MAX || input.body.length > BODY_MAX) return null;
  if ('id' in input && (typeof input.id !== 'string' || !UUID.test(input.id))) return null;
  return { id: input.id?.toLowerCase(), title, content: input.body };
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  const id = request.query?.id;
  const allowed = id === undefined ? ['GET', 'POST'] : ['GET', 'PUT', 'DELETE'];
  if (!allowed.includes(request.method)) {
    response.setHeader('Allow', allowed.join(', '));
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

  if (id !== undefined && (typeof id !== 'string' || !UUID.test(id))) {
    fail(response, 400, 'INVALID_NOTE_ID');
    return;
  }
  const noteId = id?.toLowerCase();
  if ((request.method === 'POST' || request.method === 'PUT')
      && !String(request.headers['content-type'] ?? '').startsWith('application/json')) {
    fail(response, 415, 'JSON_REQUIRED');
    return;
  }

  try {
    if (request.method === 'GET' && noteId === undefined) {
      const { data, error } = await supabase.from('notes').select(COLUMNS)
        .eq('owner_id', user.userId).order('id', { ascending: true });
      if (error) throw error;
      response.status(200).json(data.map(noteView));
      return;
    }
    if (request.method === 'POST') {
      const note = noteInput(request.body, ['id', 'title', 'body']);
      if (!note) { fail(response, 400, 'INVALID_NOTE'); return; }
      const { data, error } = await supabase.from('notes')
        .insert({ public_id: note.id ?? randomUUID(), owner_id: user.userId,
          title: note.title, content: note.content })
        .select('public_id, owner_id').single();
      if (error?.code === '23505') { fail(response, 409, 'NOTE_ID_TAKEN'); return; }
      if (error) throw error;
      if (!isOwner(data, user)) throw new Error('owner mismatch after insert');
      response.status(201).json({ id: data.public_id });
      return;
    }

    // /:id routes: find the row first, then allow only its owner.
    const found = await supabase.from('notes').select(OWNED_COLUMNS)
      .eq('public_id', noteId).maybeSingle();
    if (found.error) throw found.error;
    if (!found.data) { fail(response, 404, 'NOTE_NOT_FOUND'); return; }
    if (!isOwner(found.data, user)) { fail(response, 403, 'NOTE_FORBIDDEN'); return; }

    if (request.method === 'GET') {
      response.status(200).json(noteView(found.data));
      return;
    }
    if (request.method === 'DELETE') {
      const { data, error } = await supabase.from('notes').delete()
        .eq('public_id', noteId).eq('owner_id', user.userId).select('public_id');
      if (error) throw error;
      if (!data.length) { fail(response, 404, 'NOTE_NOT_FOUND'); return; }
      response.status(200).json({ id: data[0].public_id });
      return;
    }
    // PUT: the old row must be mine (filter) and the new row must stay mine
    // (owner_id written from the token, then checked on the returned row).
    const note = noteInput(request.body, ['title', 'body']);
    if (!note) { fail(response, 400, 'INVALID_NOTE'); return; }
    const { data, error } = await supabase.from('notes')
      .update({ owner_id: user.userId, title: note.title, content: note.content })
      .eq('public_id', noteId).eq('owner_id', user.userId).select(OWNED_COLUMNS);
    if (error) throw error;
    if (!data.length) { fail(response, 404, 'NOTE_NOT_FOUND'); return; }
    if (!isOwner(data[0], user)) throw new Error('owner mismatch after update');
    response.status(200).json(noteView(data[0]));
  } catch (error) {
    console.error('notes: query failed', error?.code ?? 'unknown');
    fail(response, 502, 'NOTES_UNAVAILABLE');
  }
}
