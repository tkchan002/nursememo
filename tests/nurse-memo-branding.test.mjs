import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { CONFIG } from '../config.js';
import { ACCOUNT_EMAIL_DOMAIN, loginIdToEmail } from '../supabase/functions/_shared/login-identity.mjs';
import { GENERATED_DEMO_FORMAT } from '../domain/demo-generator.js';
import { DEMO_ACCOUNTS } from '../demo-data.js';
import { MEMO_LABELS } from '../domain/report-cycle.js';
const dir = fileURLToPath(new URL('../', import.meta.url));
const read = file => readFileSync(join(dir,file),'utf8');

test('all entry points show Nurse Memo product branding', () => {
  assert.equal(CONFIG.APP_NAME, 'Nurse Memo');
  for (const [file, context] of [
    ['index.html', 'Login'], ['ward.html','Ward'],
    ['patrol.html','Patrol Night'], ['maintenance.html','Maintenance'],
    ['print.html','Print'],
  ]) assert.match(read(file), new RegExp(String.raw`<title>Nurse Memo \| ${context}<\/title>`));
  for (const page of ['index.html', 'patrol.html','maintenance.html']) {
    assert.match(read(page), /class="legacy-title-text"[^>]*>Nurse Memo<\/div>/);
  }
  assert.equal(JSON.parse(read('package.json')).name, 'nurse-memo');
  assert.match(read('.github/workflows/deploy-pages.yml'), /Deploy Nurse Memo/);
});

test('Supabase account identity and the existing maintenance ID remain intact', () => {
  assert.equal(ACCOUNT_EMAIL_DOMAIN, 'accounts.nightmemo.example.com');
  assert.equal(loginIdToEmail('C10'), 'c10@accounts.nightmemo.example.com');
  assert.equal(loginIdToEmail('NightMaintenance'), 'nightmaintenance@accounts.nightmemo.example.com');
  assert.ok(DEMO_ACCOUNTS.some(item => item.login_id === 'NightMaintenance' && item.role === 'maintenance'));
  assert.match(read('pages/login-page.js'), /maintenance: 'NightMaintenance'/);
  assert.match(read('scripts/bootstrap-accounts.mjs'), /'NightMaintenance', 'maintenance'/);
});

test('report formats and audit namespace are unchanged by branding', () => {
  assert.equal(GENERATED_DEMO_FORMAT, 'night-memo-pm-night-v1');
  const schema = read('supabase/schema.sql');
  assert.match(schema, /night-memo-pm-night-v1/);
  assert.match(schema, /nightmemo\.audit_explicit/);
  assert.match(read('services/auth-service.js'), /nightMemoDemoSession/);
  assert.match(read('data/repositories/access-repository.js'), /nightMemoDemoSession/);
  assert.match(read('services/print-job-service.js'), /nightMemoPrintJob:v1:/);
  assert.match(read('ward-print.js'), /nightMemoPdfSettingsV1/);
});

test('PM Memo and Night Memo remain distinct report names', () => {
  assert.deepEqual(MEMO_LABELS, {pm:'PM Memo', night:'Night Memo'});
  assert.match(read('ward.html'), /<option value="night">Night Memo<\/option>/);
  assert.match(read('patrol.html'), /data-patrol-tab="memo"[^>]*>Night Memo<\/button>/);
});
