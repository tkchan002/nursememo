import { createClient } from '@supabase/supabase-js';
import { APP_RUNTIME, CONFIG } from '../config.js';

export const DB_MODE = APP_RUNTIME.mode;
if (!APP_RUNTIME.ready) {
  // Fail closed: never create demo sessions when production credentials are absent.
  throw new Error(APP_RUNTIME.error);
}

export const supabase = DB_MODE === 'supabase'
  ? createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
  : null;
