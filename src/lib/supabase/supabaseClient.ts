import { createClient } from '@supabase/supabase-js';

// Auto-load environment in Node runtime if available and not yet loaded
if (typeof process !== 'undefined' && (!process.env?.VITE_SUPABASE_URL || !process.env?.VITE_SUPABASE_ANON_KEY)) {
  try {
    if (typeof (process as any).loadEnvFile === 'function') {
      (process as any).loadEnvFile();
    }
  } catch {}
}

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

const dummyKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.dummy';
const supabaseUrl = getEnv('VITE_SUPABASE_URL', 'https://placeholder.supabase.co');
const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY', dummyKey);

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl !== 'https://placeholder.supabase.co' &&
  supabaseAnonKey !== dummyKey &&
  !supabaseUrl.includes('your-project-id')
);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
