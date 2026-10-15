export const CONFIG = {
  // Replace these two values after creating your Supabase project.
  SUPABASE_URL: 'https://YOUR-PROJECT.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'YOUR_SUPABASE_PUBLISHABLE_KEY',

  // Fail closed by default. Use true ONLY for deliberate, browser-local demo testing.
  FORCE_DEMO_MODE: false,

  APP_NAME: 'Night Memo',
  RECENT_HISTORY_LIMIT: 30,
};

export function isSupabaseConfigured() {
  return !CONFIG.FORCE_DEMO_MODE &&
    CONFIG.SUPABASE_URL.startsWith('https://') &&
    !CONFIG.SUPABASE_URL.includes('YOUR-PROJECT') &&
    CONFIG.SUPABASE_PUBLISHABLE_KEY &&
    !CONFIG.SUPABASE_PUBLISHABLE_KEY.includes('YOUR_SUPABASE');
}
