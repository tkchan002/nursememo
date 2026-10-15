import { createClient } from '@supabase/supabase-js';
import { CONFIG, isSupabaseConfigured } from '../config.js';

export const DB_MODE = CONFIG.FORCE_DEMO_MODE ? 'demo' : 'supabase';
if (DB_MODE === 'supabase' && !isSupabaseConfigured()) {
  throw new Error('Supabase is not configured. Set the URL and publishable key in config.js, or explicitly enable local demo mode.');
}

export let supabase = null;

if (DB_MODE === 'supabase') {
  supabase = createClient(
    CONFIG.SUPABASE_URL,
    CONFIG.SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    }
  );
}
