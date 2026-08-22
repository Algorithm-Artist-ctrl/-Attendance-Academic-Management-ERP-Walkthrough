import { createClient } from '@supabase/supabase-js';

const getEnv = (key: string, fallback: string): string => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
      return import.meta.env[key];
    }
  } catch {}
  try {
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key]!;
    }
  } catch {}
  return fallback;
};

const supabaseUrl = getEnv('VITE_SUPABASE_URL', 'https://obssoojzryqiudllnlkh.supabase.co');
const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ic3Nvb2p6cnlxaXVkbGxubGtoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0MDU0NzUsImV4cCI6MjEwMjk4MTQ3NX0.eFCU024aroXFpTqnOaVUOpOUpONBwm3KDDdLfzlZ5co');

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes('your-project-id')
);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
