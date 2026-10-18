import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const file = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('single technical README preserves existing-backend migration safeguards', () => {
  const guide = file('README.md');
  assert.match(guide, /Do not run `supabase\/schema\.sql` or `supabase\/seed\.sql` over an existing live database\./);
  assert.match(guide, /EXISTING_PROJECT_LOGIN_UPGRADE\.sql/);
  assert.match(guide, /UPGRADE_WARD_DRAFT_HISTORY\.sql/);
  assert.match(guide, /existing.*Auth.*password|underlying Supabase Auth password/i);
  assert.match(guide, /demo default-password initialization/i);
  assert.match(guide, /hospital.*server.*frontend|hospital static frontend/i);
});

test('only README markdown remains and no database reset script can be shipped', () => {
  assert.equal(existsSync(new URL('../supabase/reset_dedicated_demo_public.sql', import.meta.url)), false);
  const removed = [
    'REUSE_EXISTING_SUPABASE.md', 'NEW_REPOSITORY_SETUP.md',
    'ACCOUNT_LOGIN_UPGRADE.md', 'NURSE_MEMO_DEMO_ACCOUNTS.md',
    'SELF_HOSTED_DOCUMENT_SETUP.md', 'WARD_DRAFT_HISTORY_UPGRADE.md',
  ];
  for (const legacy of removed) assert.equal(existsSync(new URL(`../${legacy}`, import.meta.url)), false, legacy);
  assert.match(file('README.md'), /Full document-editor build and packaging/i);
  assert.match(file('README.md'), /Production-grade password policies/i);
});

test('new site has a publishable key and never carries a service-role credential', () => {
  const config = file('config.js');
  assert.match(config, /SUPABASE_URL:\s*'https:\/\/[a-z0-9-]+\.supabase\.co'/);
  assert.match(config, /SUPABASE_PUBLISHABLE_KEY:\s*'sb_publishable_[A-Za-z0-9_-]+'/);
  assert.doesNotMatch(config, /service_role|sb_secret_/);
  assert.match(config, /FORCE_DEMO_MODE:\s*false/);
});
