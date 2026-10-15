import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../supabase/patches/20261015_service_role_grants.sql', import.meta.url), 'utf8');
const required = [
  /grant\s+select\s+on\s+(?:table\s+)?public\.wards\s+to\s+service_role\s*;/i,
  /grant\s+select\s*,\s*insert\s+on\s+(?:table\s+)?public\.user_access\s+to\s+service_role\s*;/i,
  /grant\s+insert\s+on\s+(?:table\s+)?public\.audit_log\s+to\s+service_role\s*;/i,
];

test('fresh Supabase schema declares minimum service-role access needed by bootstrap and admin users', () => {
  for (const pattern of required) assert.match(sql, pattern);
});
test('existing-project permission patch matches canonical schema', () => {
  for (const pattern of required) assert.match(migration, pattern);
});
test('account bootstrap uses a server-side secret and no browser-side service role credential', () => {
  const bootstrap = readFileSync(new URL('../scripts/bootstrap-accounts.mjs', import.meta.url), 'utf8');
  assert.match(bootstrap, /SUPABASE_SECRET_KEY/);
  assert.match(bootstrap, /createClient\(url, secret/);
});
