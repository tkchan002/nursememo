import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fetchAllAuthUsers, reconcileAccountDirectory, loadAccountDirectory } from '../supabase/functions/_shared/account-directory.mjs';
import { InputError, parseAdminCommand } from '../supabase/functions/_shared/admin-users-policy.mjs';
import { toStoredMaintenancePassword, validateMaintenancePassword } from '../domain/maintenance-accounts.js';

const id = '12345678-1234-4234-a234-1234567890ab';
const record = { auth_user_id: id, login_id: 'C10', role: 'ward', display_name: 'Test Ward', active: true, ward_id: 'ward-10', wards: { id: 'ward-10', name: 'C10' }, created_at: '2026-10-15', updated_at: '2026-10-15' };

const user = { id, email: 'c10@accounts.nightmemo.example.com', email_confirmed_at: '2026-10-15T00:00:00Z', last_sign_in_at: '2026-10-16T00:00:00Z', encrypted_password: 'hash-should-never-be-sent', app_metadata: { secrets: 'no' }, identities: [{provider:'email'}] };

test('actual Supabase Auth user is reconciled without leaking secrets', () => {
  const result = reconcileAccountDirectory([record], [user]);
  assert.equal(result.length, 1);
  assert.equal(result[0].auth_exists, true);
  assert.equal(result[0].auth_email_confirmed, true);
  assert.equal(result[0].auth_login_matches, true);
  assert.equal(result[0].auth_last_sign_in_at, user.last_sign_in_at);
  assert.equal(result[0].wards.name, 'C10');
  assert.equal('encrypted_password' in result[0], false);
  assert.equal('app_metadata' in result[0], false);
  assert.equal(JSON.stringify(result).includes('hash-should-never-be-sent'), false);
  assert.equal(JSON.stringify(result).includes('secrets'), false);
});

test('deleted and mismatched Supabase accounts are reported accurately', () => {
  const [missing] = reconcileAccountDirectory([record], []);
  assert.equal(missing.auth_exists, false);
  assert.equal(missing.auth_email, null);
  assert.equal(missing.auth_login_matches, false);
  const [mismatch] = reconcileAccountDirectory([record], [{...user, email:'someone@else.test'}]);
  assert.equal(mismatch.auth_exists, true);
  assert.equal(mismatch.auth_login_matches, true, 'Auth email is independent of app login');
});

test('Auth directory requests handle pagination, failures and excessive pages', async () => {
  const calls = [];
  const users = await fetchAllAuthUsers({listUsers: async options => {
    calls.push(options);
    return {data:{users:options.page === 1 ? [user,user] : [user]},error:null};
  }}, 2, 4);
  assert.equal(users.length, 3);
  assert.deepEqual(calls, [{page:1,perPage:2},{page:2,perPage:2}]);
  await assert.rejects(fetchAllAuthUsers({listUsers:async()=>({data:null,error:new Error('Auth unavailable')})}), /Auth unavailable/);
  await assert.rejects(fetchAllAuthUsers({listUsers:async()=>({data:{users:[user]},error:null})},1,2), /supported listing limit/);
});

test('loading the live account directory reads both database permissions and Auth', async () => {
  const query = {
    select(columns) { assert.match(columns, /wards\(id,name\)/); return this; },
    async order(field) { assert.equal(field, 'login_id'); return {data:[record],error:null}; },
  };
  const mockDb = {
    from(table) { assert.equal(table, 'user_access'); return query; },
    auth: { admin: { listUsers: async () => ({data:{users:[user]},error:null}) } },
  };
  const result = await loadAccountDirectory(mockDb,'auth_user_id,login_id');
  assert.equal(result[0].auth_exists, true);
  assert.equal(result[0].login_id, 'C10');
  await assert.rejects(loadAccountDirectory({
    from: () => ({select: () => ({order: async () => ({data:null,error:new Error('RLS query failure')})})}),
  }, 'test'), /RLS query failure/);
});

test('list_accounts command accepts only explicitly named read-only action', () => {
  assert.deepEqual(parseAdminCommand({action:'list_accounts'}),{action:'list_accounts'});
  assert.throws(() => parseAdminCommand({action:'list_accounts',password:'c10'}), InputError);
});

test('matching short password is allowed only with explicit test mode', () => {
  assert.equal(validateMaintenancePassword('C10', 'c10', true), true);
  assert.equal(toStoredMaintenancePassword('C10', 'c10', true), 'c10');
  assert.equal(toStoredMaintenancePassword('C10', 'c10', true, 'demo'), 'c10');
  assert.throws(() => validateMaintenancePassword('C10', 'c10', false), /8 characters/);
  assert.equal(toStoredMaintenancePassword('C10', 'e10', true), 'e10');
  assert.equal(toStoredMaintenancePassword('C10','abcdefgh',false),'abcdefgh');
});

test('Maintenance real account listing uses authenticated Edge Function, not only access table', () => {
  const repo = readFileSync(new URL('../data/repositories/account-repository.js',import.meta.url),'utf8');
  const handler = readFileSync(new URL('../supabase/functions/admin-users/index.ts',import.meta.url),'utf8');
  const markup = readFileSync(new URL('../maintenance.html',import.meta.url),'utf8');
  const page = readFileSync(new URL('../pages/maintenance-page.js',import.meta.url),'utf8');
  assert.match(repo,/adminAccount\('list_accounts', \{\}\)/);
  assert.match(handler,/caller\.role !== 'maintenance'/);
  assert.ok(handler.indexOf("caller.role !== 'maintenance'") < handler.indexOf("command.action === 'list_accounts'"));
  assert.match(handler,/loadAccountDirectory\(db, PUBLIC_COLUMNS\)/);
  assert.match(markup,/Existing passwords/);
  assert.match(page,/toStoredMaintenancePassword\(/);
  assert.match(page,/confirmNewPassword/);
});
