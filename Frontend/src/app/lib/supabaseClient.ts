import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("[SUPABASE CLIENT CRITICAL ERROR]: Frontend environment variables are missing! Signup/Login will fail.");
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');
