import { createClient } from '@supabase/supabase-js';

const url = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) || process.env?.NEXT_PUBLIC_SUPABASE_URL || '';
const key = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) || process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!url || !key) {
  console.warn("[SUPABASE INITIALIZATION BLOCKED]: Missing target endpoint strings. Defaulting to mock routing boundaries.");
}

export const supabase = createClient(url, key);
