import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, APP_RUNTIME, resolveRuntimeConfig } from '../config.js';
import { readFileSync } from 'node:fs';

const placeholder = {
  FORCE_DEMO_MODE: false,
  SUPABASE_URL: 'https://YOUR-PROJECT.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'YOUR_SUPABASE_PUBLISHABLE_KEY',
};
const valid = {
  FORCE_DEMO_MODE: false,
  SUPABASE_URL: 'https://test-night-memo.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_key',
};

test('demo requires explicit true; missing credentials cannot silently enable it', () => {
  assert.deepEqual(resolveRuntimeConfig({ ...placeholder, FORCE_DEMO_MODE: true }),
    { mode: 'demo', ready: true, error: null });
  const missing = resolveRuntimeConfig(placeholder);
  assert.equal(missing.mode, 'supabase');
  assert.equal(missing.ready, false);
  assert.match(missing.error, /Supabase is not configured/);
  assert.equal(resolveRuntimeConfig({ ...placeholder, FORCE_DEMO_MODE: undefined }).ready, false);
  assert.equal(resolveRuntimeConfig({ ...placeholder, FORCE_DEMO_MODE: 'true' }).ready, false);
});

test('ready production mode requires valid public Supabase credentials', () => {
  assert.deepEqual(resolveRuntimeConfig(valid), { mode: 'supabase', ready: true, error: null });
  assert.equal(resolveRuntimeConfig({ ...valid, SUPABASE_URL: 'http://test-night-memo.supabase.co' }).ready, false);
  assert.equal(resolveRuntimeConfig({ ...valid, SUPABASE_URL: 'javascript:alert(1)' }).ready, false);
  assert.equal(resolveRuntimeConfig({ ...valid, SUPABASE_PUBLISHABLE_KEY: 'YOUR_SUPABASE_PUBLISHABLE_KEY' }).ready, false);
  assert.equal(resolveRuntimeConfig({ ...valid, SUPABASE_PUBLISHABLE_KEY: 'sb_secret_not_for_browser' }).ready, false);
  assert.equal(resolveRuntimeConfig({ ...valid, SUPABASE_PUBLISHABLE_KEY: 'service_role' }).ready, false);
  assert.equal(resolveRuntimeConfig({ ...valid, SUPABASE_PUBLISHABLE_KEY: 'eyJx.e30.sig' }).ready, false);
});

test('the deployed configuration is an immutable single startup decision', () => {
  assert.ok(Object.isFrozen(CONFIG));
  assert.ok(Object.isFrozen(APP_RUNTIME));
  assert.deepEqual(APP_RUNTIME, resolveRuntimeConfig(CONFIG));
  assert.equal(APP_RUNTIME.mode, CONFIG.FORCE_DEMO_MODE ? 'demo' : 'supabase');
});

test('the login document exposes a persistent accessible startup error', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../css/login.css', import.meta.url), 'utf8');
  assert.match(html, /id="loginConfigError"[^>]*role="alert"/);
  assert.match(css, /\.login-config-error/);
});
