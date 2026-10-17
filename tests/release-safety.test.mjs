import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const base = new URL('../', import.meta.url);
const file = relative => readFile(new URL(relative, base), 'utf8');

test('isolated site cannot publish a CNAME for another repository', async () => {
  await assert.rejects(access(fileURLToPath(new URL('public/CNAME', base))));
  await assert.rejects(access(fileURLToPath(new URL('CNAME', base))));
});

test('login page does not connect to the original Supabase project', async () => {
  const page = await file('index.html');
  assert.doesNotMatch(page, /csibbrzbljemusyzpzmo|preconnect.*esm\.sh/i);
});

test('demo login defaults match real demo account names and accept non-email IDs', async () => {
  const login = await file('pages/login-page.js');
  const accounts = await import('../demo-data.js');
  for (const id of ['C10', 'patrol', 'NightMaintenance']) {
    assert.ok(accounts.DEMO_ACCOUNTS.some(a => a.login_id === id), id);
    assert.ok(login.includes(`'${id === 'patrol' ? 'patrol' : id}'`), `${id} must be selectable through its current login name`);
  }
  assert.match(login, /qs\('#loginId'\)\.type = 'text'/);
});

test('local service role environment files are Git-ignored', async () => {
  const ignore = await file('.gitignore');
  assert.match(ignore, /^\.env$/m);
  assert.match(ignore, /^\.env\.\*$/m);
  const script = await file('scripts/bootstrap-accounts.mjs');
  assert.doesNotMatch(script, /import 'dotenv\/config'/);
  assert.match(script, /login_id: account\.loginId/);
  assert.match(ignore, /^\.private\/$/m);
});
