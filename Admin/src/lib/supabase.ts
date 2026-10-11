import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || 'https://elbgdgahyoyfbtuwsktx.supabase.co';
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsYmdkZ2FoeW95ZmJ0dXdza3R4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3NDIzMjYsImV4cCI6MjA5NzMxODMyNn0.XV-ewYakT_qdZmW1zP1g9KzEUG8v0xGg3dthFCO8Xvg';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
