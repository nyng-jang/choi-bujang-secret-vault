// Stage 2: the screen reads the fictional notes through this server function.
// The Supabase secret key stays in Vercel environment variables. Never put it
// in public files, responses, or logs.
// Known weakness: this function is still a public URL with no login check.
import { createClient } from '@supabase/supabase-js';

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    return;
  }
  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    console.error('notes: SUPABASE_URL or SUPABASE_SECRET_KEY is not set');
    response.status(500).json({ error: 'NOTES_NOT_CONFIGURED' });
    return;
  }
  try {
    const supabase = createClient(url, secretKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    });
    const { data, error } = await supabase.from('notes')
      .select('title, content').order('id', { ascending: true });
    if (error) {
      console.error('notes: query failed', error.code ?? 'unknown');
      response.status(502).json({ error: 'NOTES_UNAVAILABLE' });
      return;
    }
    response.status(200).json({ notes: data });
  } catch {
    console.error('notes: request to Supabase failed');
    response.status(502).json({ error: 'NOTES_UNAVAILABLE' });
  }
}
