import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const file = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('same-project setup preserves user Auth IDs and account passwords', () => {
  const guide = file('REUSE_EXISTING_SUPABASE.md');
  assert.match(guide, /Supabase Auth password stays unchanged/i);
  assert.match(guide, /same account IDs/i);
  assert.match(guide, /auth\.users/);
  assert.match(guide, /old database names will not appear/i);
  assert.match(guide, /not included in this GitHub repository ZIP/i);
});

test('same-project package cannot accidentally ship a database reset', () => {
  assert.equal(existsSync(new URL('../supabase/reset_dedicated_demo_public.sql', import.meta.url)), false);
  const guide = file('NEW_REPOSITORY_SETUP.md');
  assert.match(guide, /REUSE_EXISTING_SUPABASE.md/);
  assert.match(guide, /Do not run/);
});

test('new site has a publishable key and never carries a service-role credential', () => {
  const config = file('config.js');
  assert.match(config, /SUPABASE_URL:\s*'https:\/\/[a-z0-9-]+\.supabase\.co'/);
  assert.match(config, /SUPABASE_PUBLISHABLE_KEY:\s*'sb_publishable_[A-Za-z0-9_-]+'/);
  assert.doesNotMatch(config, /service_role|sb_secret_/);
  assert.match(config, /FORCE_DEMO_MODE:\s*false/);
});
