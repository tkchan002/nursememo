import test from 'node:test';
import assert from 'node:assert/strict';
import { loginIdToEmail, normalizeLoginId, ACCOUNT_EMAIL_DOMAIN } from '../supabase/functions/_shared/login-identity.mjs';
import { parseAdminCommand, InputError } from '../supabase/functions/_shared/admin-users-policy.mjs';

const ward = 'aaaabbbb-1234-4234-a234-1234567890ab';

test('all roles use one reversible-in-practice, deterministic login-ID scheme', () => {
  assert.equal(ACCOUNT_EMAIL_DOMAIN, 'accounts.nightmemo.example.com');
  for (const [typed, expected] of [
    ['C10', 'c10'], ['c10', 'c10'], ['  E10 ', 'e10'],
    ['G2', 'g2'], ['patrol', 'patrol'], ['NightMaintenance', 'nightmaintenance'],
  ]) {
    assert.equal(loginIdToEmail(typed), `${expected}@${ACCOUNT_EMAIL_DOMAIN}`);
  }
});

test('malformed ID and email input are rejected; cannot inject an arbitrary email', () => {
  for (const invalid of ['', 'c', 'c10@example.com', 'a b', '1start', ' a\\nb ', 'x'.repeat(33), 'x+tag', 'é10']) {
    assert.throws(() => normalizeLoginId(invalid), /Account ID/);
  }
});

test('maintenance account create and rename use the same short-ID contract', () => {
  const create = parseAdminCommand({ action:'create', login_id:'C10', role:'ward', ward_id:ward, password:'StrongPassword123' });
  assert.equal(loginIdToEmail(create.login_id), 'c10@accounts.nightmemo.example.com');
  const rename = parseAdminCommand({action:'rename_login', auth_user_id:'12345678-1234-4234-a234-1234567890ab',login_id:'G2'});
  assert.equal(loginIdToEmail(rename.login_id), 'g2@accounts.nightmemo.example.com');
  assert.throws(() => parseAdminCommand({ action:'create', login_id:'someone@hospital.org', role:'ward', ward_id:ward, password:'StrongPassword123' }), InputError);
});
