import { createClient } from '@supabase/supabase-js';

const rawUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
const rawKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

const url = rawUrl && rawUrl.trim().length > 0 ? rawUrl.trim() : 'https://claritiyvoice.supabase.co';
const key = rawKey && rawKey.trim().length > 0 ? rawKey.trim() : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsYXJpdGl5dm9pY2UiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTY3MjUxMjAwMCwiZXhwIjoyMDE4MDg4MDAwfQ.placeholder';

let client;
try {
  client = createClient(url, key);
} catch (err) {
  console.warn("[SUPABASE INITIALIZATION FALLBACK]:", err);
  client = createClient('https://claritiyvoice.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsYXJpdGl5dm9pY2UiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTY3MjUxMjAwMCwiZXhwIjoyMDE4MDg4MDAwfQ.placeholder');
}

export const supabase = client;

