import { createClient } from '@supabase/supabase-js';

const defaultUrl = 'https://elbgdgahyoyfbtuwsktx.supabase.co';
const defaultAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsYmdkZ2FoeW95ZmJ0dXdza3R4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3NDIzMjYsImV4cCI6MjA5NzMxODMyNn0.XV-ewYakT_qdZmW1zP1g9KzEUG8v0xGg3dthFCO8Xvg';

const url = (import.meta as any).env?.VITE_SUPABASE_URL?.trim() || defaultUrl;
const key = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY?.trim() || defaultAnonKey;

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'claritiy_voice_supabase_auth_token'
  }
});
