import { createClient } from '@supabase/supabase-js';

const url = import.meta.env?.VITE_SUPABASE_URL || '';
const key = import.meta.env?.VITE_SUPABASE_ANON_KEY || '';

if (!url || !key) {
  console.warn("[SUPABASE INITIALIZATION BLOCKED]: Missing target endpoint strings. Defaulting to mock routing boundaries.");
}

export const supabase = createClient(url, key);
