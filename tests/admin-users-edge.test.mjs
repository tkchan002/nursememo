import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { InputError, parseAdminCommand } from '../supabase/functions/_shared/admin-users-policy.mjs';

const id = '12345678-1234-4234-a234-1234567890ab';
const ward = 'aaaabbbb-1234-4234-a234-1234567890ab';

test('account creation requires valid short ID, sufficiently long password and ward for ward users', () => {
  assert.deepEqual(parseAdminCommand({
    action: 'create', login_id: 'C10', role: 'ward', ward_id: ward,
    display_name: ' Test ', password: '12345678',
  }), {
    action: 'create', login_id: 'C10', role: 'ward', ward_id: ward,
    display_name: 'Test', password: '12345678',
  });
  assert.throws(() => parseAdminCommand({
    action: 'create', login_id: 'not-an-email@example.org', role: 'ward', ward_id: ward, password: '12345678',
  }), InputError);
  assert.throws(() => parseAdminCommand({
    action: 'create', login_id: 'C10', role: 'ward', password: '12345678',
  }), InputError);
  assert.throws(() => parseAdminCommand({
    action: 'create', login_id: 'C10', role: 'patrol', password: 'weak',
  }), InputError);
});

test('non-ward accounts never retain an extraneous ward assignment', () => {
  const result = parseAdminCommand({ action: 'create', login_id: 'patrol',
    role: 'patrol', ward_id: ward, password: '12345678' });
  assert.equal(result.ward_id, null);
});

test('role change enforces role, active flag, and UUID', () => {
  assert.deepEqual(parseAdminCommand({ action: 'update_access', auth_user_id: id,
    role: 'maintenance', active: true, display_name: 'Maint' }), {
    action: 'update_access', auth_user_id: id, role: 'maintenance', ward_id: null,
    active: true, display_name: 'Maint',
  });
  assert.throws(() => parseAdminCommand({ action: 'update_access', auth_user_id: id,
    role: 'maintenance', active: 'true' }), InputError);
  assert.throws(() => parseAdminCommand({ action: 'update_access', auth_user_id: 'bad',
    role: 'maintenance', active: true }), InputError);
  assert.throws(() => parseAdminCommand({ action: 'update_access', auth_user_id: id,
    role: 'owner', active: true }), InputError);
});

test('password reset and rename validate fields without exposing password in response contract', () => {
  assert.deepEqual(parseAdminCommand({ action: 'reset_password', auth_user_id: id,
    password: 'abcdefgh' }), { action: 'reset_password', auth_user_id: id,
    password: 'abcdefgh' });
  assert.equal(parseAdminCommand({ action: 'rename_login', auth_user_id: id,
    login_id: 'G11' }).login_id, 'G11');
  assert.throws(() => parseAdminCommand({ action: 'reset_password', auth_user_id: id,
    password: 'abcdefgh', active: true }), InputError);
  assert.throws(() => parseAdminCommand({ action: 'delete', auth_user_id: id }), InputError);
});

test('admin-users endpoint is present and explicitly checks maintenance role', () => {
  const fn = readFileSync(new URL('../supabase/functions/admin-users/index.ts', import.meta.url), 'utf8');
  const config = readFileSync(new URL('../supabase/config.toml', import.meta.url), 'utf8');
  assert.match(fn, /auth:\s*'user'/);
  assert.match(fn, /caller\.role !== 'maintenance'/);
  assert.match(fn, /actorId/);
  assert.match(fn, /supabaseAdmin/);
  assert.match(fn, /auth\.admin\.createUser/);
  assert.match(fn, /auth\.admin\.updateUserById/);
  assert.match(config, /\[functions\.admin-users\][\s\S]*verify_jwt\s*=\s*true/);
});
