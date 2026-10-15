/** Public browser configuration. Only publishable Supabase credentials belong here. */
export const CONFIG = Object.freeze({
  SUPABASE_URL: 'https://fdayxcfhjjamipmgkkpr.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_cARGDldBHLvA2FtXuQgq4g_FyWVeLaZ',

  // Explicit local-only demonstration environment; never inferred from missing keys.
  FORCE_DEMO_MODE: false,

  APP_NAME: 'Night Memo',
  RECENT_HISTORY_LIMIT: 30,
});

/**
 * Pure startup configuration resolution shared by the login page and database.
 * Invalid live configuration is a distinct failure state, NEVER an implicit demo.
 */
export function resolveRuntimeConfig(config) {
  if (config?.FORCE_DEMO_MODE === true) {
    return Object.freeze({ mode: 'demo', ready: true, error: null });
  }

  if (config?.FORCE_DEMO_MODE !== false) {
    return Object.freeze({
      mode: 'supabase',
      ready: false,
      error: 'Invalid FORCE_DEMO_MODE setting in config.js. Set it explicitly to true or false.',
    });
  }

  const address = String(config.SUPABASE_URL || '').trim();
  const key = String(config.SUPABASE_PUBLISHABLE_KEY || '').trim();
  let validAddress = false;
  try {
    const url = new URL(address);
    validAddress = url.protocol === 'https:' && Boolean(url.hostname) &&
      !url.username && !url.password && !url.search && !url.hash &&
      !/YOUR-PROJECT|YOUR_SUPABASE/i.test(address);
  } catch {
    // Invalid or missing URL; do not contact Supabase.
  }

  // This clean installation accepts only new Supabase publishable keys.
  // Never allow a service-role JWT or sb_secret key into a browser deployment.
  const validKey = /^sb_publishable_[A-Za-z0-9_-]{8,}$/.test(key);

  if (!validAddress || !validKey) {
    return Object.freeze({
      mode: 'supabase',
      ready: false,
      error: 'Supabase is not configured. Set a valid URL and publishable key in config.js, or explicitly enable local demo mode.',
    });
  }
  return Object.freeze({ mode: 'supabase', ready: true, error: null });
}

/** Single immutable startup decision for every part of the application. */
export const APP_RUNTIME = resolveRuntimeConfig(CONFIG);
