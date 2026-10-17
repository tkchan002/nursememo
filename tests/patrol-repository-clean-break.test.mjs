import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = path => readFileSync(join(root, path), 'utf8');
const blockedTitle = String.fromCharCode(109, 97, 110, 97, 103, 101, 114);
const ignored = new Set(['.git', '.private', '.upstream', 'node_modules', 'dist', '.vite']);
function trackedFiles(directory = root) {
  const files = [];
  for (const name of readdirSync(directory)) {
    if (ignored.has(name)) continue;
    const path = join(directory, name);
    if (statSync(path).isDirectory()) files.push(...trackedFiles(path));
    else files.push(path);
  }
  return files;
}

test('release gate: protected former role identifier is absent from all repository paths and files', () => {
  const word = new RegExp(blockedTitle, 'i');
  const offenders = [];
  for (const file of trackedFiles()) {
    const name = relative(root, file);
    if (word.test(name) || word.test(readFileSync(file).toString('utf8'))) offenders.push(name);
  }
  assert.deepEqual(offenders, [], 'Protected role terminology found in repository');
});

test('Patrol Night entrypoint, account role, API names and database contracts agree', () => {
  const login = read('pages/login-page.js');
  const html = read('patrol.html');
  const entry = read('vite.config.js');
  const page = read('pages/patrol-page.js');
  const sql = read('supabase/schema.sql');
  const edge = read('supabase/functions/_shared/admin-users-policy.mjs');
  assert.match(login, /patrol:\s*'\.\/patrol\.html'/);
  assert.match(entry, /patrol:\s*'patrol\.html'/);
  assert.match(html, /src="\.\/patrol\.js"/);
  assert.match(page, /requireRole\('patrol'\)/);
  assert.match(sql, /role in \('ward','patrol','maintenance'\)/);
  assert.match(sql, /create table public\.patrol_memos\s*\(/);
  assert.match(sql, /create or replace function public\.save_patrol_memo_revision_docx\(/);
  assert.match(sql, /create or replace function public\.read_patrol_memo_docx\(/);
  assert.match(sql, /public\.app_role\(\)\s*=\s*'patrol'/);
  assert.match(edge, /new Set\(\['ward', 'patrol', 'maintenance'\]\)/);
  assert.equal(existsSync(join(root, 'supabase', 'migrations')), false);
  assert.equal(existsSync(join(root, 'supabase', 'patches')), false);
});

test('there are no transitional login aliases and existing public project credentials are reusable', () => {
  const auth = read('services/auth-service.js');
  const bootstrap = read('scripts/bootstrap-accounts.mjs');
  const settings = read('config.js');
  assert.doesNotMatch(auth, /oldDemoPatrol|legacyPassword|oldDemoLogin/);
  assert.match(bootstrap, /\['patrol', 'patrol'\]/);
  assert.match(settings, /SUPABASE_URL:\s*'https:\/\/[a-z0-9-]+\.supabase\.co'/);
  assert.match(settings, /SUPABASE_PUBLISHABLE_KEY:\s*'sb_publishable_[A-Za-z0-9_-]+'/);
});
