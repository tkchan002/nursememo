/** One-time account bootstrap for an EMPTY, freshly seeded Night Memo project.
 * Run from a trusted Codespace with SUPABASE_URL and SUPABASE_SECRET_KEY (or
 * legacy SUPABASE_SERVICE_ROLE_KEY) configured as Codespaces environment secrets.
 * Do not use a publishable key. Never put either credential in GitHub files.
 * Passwords are random per account and are written ONLY to ignored local disk.
 */
import { randomBytes } from 'node:crypto';
import { mkdir, open, readFile, writeFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { normalizeLoginId, loginIdToEmail } from '../supabase/functions/_shared/login-identity.mjs';

const url = process.env.SUPABASE_URL?.trim();
const secret = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim();
if (!url || !/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)) {
  throw new Error('Set SUPABASE_URL to the NEW project URL (https://PROJECT.supabase.co).');
}
if (!secret || (!secret.startsWith('sb_secret_') && !secret.startsWith('eyJ'))) {
  throw new Error('Set SUPABASE_SECRET_KEY (sb_secret_...) or a legacy service-role key in Codespaces secrets.');
}
const client = createClient(url, secret, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});

function assertNoError(error, context) {
  if (error) throw new Error(`${context}: ${error.message}`);
}

// Use the actual database wards; do not hard-code names from an older seed.
const { data: wards, error: wardsError } = await client.from('wards')
  .select('id,name,active').eq('active', true).order('name');
assertNoError(wardsError, 'Reading wards');
if (!wards?.length) throw new Error('No active wards found. Run schema.sql and seed.sql first.');
const names = new Set();
const desired = wards.map(ward => {
  const loginId = normalizeLoginId(ward.name);
  const canonical = loginId.toLowerCase();
  if (names.has(canonical)) throw new Error(`Duplicate Ward account ID: ${ward.name}`);
  names.add(canonical);
  return { loginId, displayName: loginId, role: 'ward', wardId: ward.id };
});
for (const [loginId, role] of [['PatrolNight', 'manager'], ['NightMaintenance', 'maintenance']]) {
  if (names.has(loginId.toLowerCase())) throw new Error(`Account ID collision: ${loginId}`);
  names.add(loginId.toLowerCase());
  desired.push({ loginId, displayName: loginId, role, wardId: null });
}

// Existing accounts are never reset or reassigned by this script. A partially
// completed run can resume only when its original ignored credential file is
// present and every existing account matches the expected role and Auth user.
const { data: existingAccess, error: accessError } = await client.from('user_access')
  .select('auth_user_id,login_id,role,ward_id,active');
assertNoError(accessError, 'Checking existing accounts');

const authUsers = [];
for (let page = 1;; page++) {
  const { data, error } = await client.auth.admin.listUsers({ page, perPage: 200 });
  assertNoError(error, 'Checking existing Auth users');
  authUsers.push(...data.users);
  if (data.users.length < 200) break;
  if (page > 100) throw new Error('Unexpectedly large Auth user list. Stop and inspect your project.');
}
const authByEmail = new Map(authUsers.map(u => [(u.email || '').toLowerCase(), u]));
const desiredById = new Map(desired.map(a => [a.loginId.toLowerCase(), a]));
for (const row of existingAccess || []) {
  const planned = desiredById.get(String(row.login_id).toLowerCase());
  const user = authByEmail.get(loginIdToEmail(row.login_id));
  if (!planned || !user || user.id !== row.auth_user_id ||
      row.role !== planned.role || row.ward_id !== planned.wardId || !row.active) {
    throw new Error('Existing account(s) differ from the new bootstrap plan. No changes made.');
  }
}
for (const account of desired) {
  const email = loginIdToEmail(account.loginId);
  const authExists = authByEmail.has(email);
  const accessExists = (existingAccess || []).some(a =>
    a.login_id.toLowerCase() === account.loginId.toLowerCase());
  if (authExists !== accessExists) {
    throw new Error(`Incomplete Auth/role pair for ${account.loginId}; inspect the account before resuming.`);
  }
}

// The project marker prevents accidental reuse of previous credentials against
// another Supabase project. Both files are ignored by Git.
await mkdir('.private', { recursive: true, mode: 0o700 });
const markerPath = '.private/account-bootstrap-project.json';
const filePath = '.private/initial-accounts.csv';
let completed = new Map();
let resumed = false;
try {
  const marker = JSON.parse(await readFile(markerPath, 'utf8'));
  if (marker.url !== url) throw new Error('Credential file belongs to another Supabase project.');
  const csv = await readFile(filePath, 'utf8');
  const lines = csv.trimEnd().split('\n');
  if (lines.shift() !== 'login_id,role,password') throw new Error('Unexpected credential file format.');
  for (const line of lines) {
    const [id, role, password, extra] = line.split(',');
    if (!id || !role || !password || extra !== undefined || completed.has(id.toLowerCase())) {
      throw new Error('Damaged credential file: stop and inspect.');
    }
    completed.set(id.toLowerCase(), {role, password});
  }
  resumed = true;
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  if ((existingAccess || []).length > 0) throw new Error('Existing accounts but no original credential file. Refusing to reset them.');
  await writeFile(markerPath, JSON.stringify({ url }) + '\n', { flag:'wx', mode:0o600 });
}
for (const row of existingAccess || []) {
  const entry = completed.get(row.login_id.toLowerCase());
  if (!entry || entry.role !== row.role) {
    throw new Error(`Account ${row.login_id} exists without its original saved credentials. Manual recovery required.`);
  }
}
for (const [id] of completed) {
  if (!(existingAccess || []).some(row => row.login_id.toLowerCase() === id)) {
    throw new Error(`Saved credentials for ${id} have no corresponding account. Manual inspection required.`);
  }
}

const output = await open(filePath, resumed ? 'a' : 'wx', 0o600);
if (!resumed) await output.appendFile('login_id,role,password\n');
try {
  for (const account of desired) {
    if (completed.has(account.loginId.toLowerCase())) {
      console.log(`Already provisioned ${account.loginId}; password preserved`);
      continue;
    }
    const password = randomBytes(24).toString('base64url');
    const email = loginIdToEmail(account.loginId);
    const { data: created, error: authError } = await client.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { display_name: account.displayName },
    });
    assertNoError(authError, `Creating Auth user ${account.loginId}`);
    if (!created?.user?.id) throw new Error(`Auth did not return an ID for ${account.loginId}`);
    const { error: accessError } = await client.from('user_access').insert({
      auth_user_id: created.user.id,
      login_id: account.loginId,
      display_name: account.displayName,
      role: account.role,
      ward_id: account.wardId,
      active: true,
    });
    if (accessError) {
      const { error: rollbackError } = await client.auth.admin.deleteUser(created.user.id);
      throw new Error(`Creating role for ${account.loginId} failed: ${accessError.message}. Auth rollback ${rollbackError ? 'FAILED; inspect Supabase Auth' : 'succeeded'}.`);
    }
    await output.appendFile(`${account.loginId},${account.role},${password}\n`);
    await output.sync();
    console.log(`Created ${account.loginId} (${account.role})`);
  }
} finally {
  await output.close();
}
console.log(`Completed ${desired.length} accounts. Download ${filePath} privately from Codespaces. Do NOT commit or share it.`);
