import { createClient } from '@supabase/supabase-js';

declare global {
  interface ImportMeta {
    readonly env: Record<string, string | undefined>;
  }
}

const url = import.meta.env?.VITE_SUPABASE_URL || (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_URL) || '';
const key = import.meta.env?.VITE_SUPABASE_ANON_KEY || (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY) || '';

if (!url || !key) {
  console.warn("[SUPABASE INITIALIZATION BLOCKED]: Missing target endpoint strings. Defaulting to mock routing boundaries.");
}

export const supabase = createClient(url, key);
