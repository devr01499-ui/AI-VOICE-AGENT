import { createClient } from '@supabase/supabase-js';

const url = (import.meta as any).env?.VITE_SUPABASE_URL?.trim() || '';
const key = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY?.trim() || '';

if (!url || !key) {
  console.error('[SUPABASE CONFIG ERROR]: Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables.');
}

export const supabase = createClient(
  url || 'https://missing-supabase-url.invalid',
  key || 'missing-supabase-key'
);
