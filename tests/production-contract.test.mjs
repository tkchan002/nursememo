import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const sql = read('supabase/schema.sql');
const cycle = read('data/repositories/report-cycle-repository.js');
const ward = read('data/repositories/ward-repository.js');
const account = read('supabase/functions/admin-users/index.ts');

test('one independent PM/Night report per ward/date; beta legacy type excluded', () => {
  assert.match(sql, /report_type text not null check \(report_type in \('pm','night'\)\)/);
  assert.match(sql, /unique \(ward_id, report_date, report_type\)/);
  assert.doesNotMatch(sql, /'legacy'/);
});

test('authenticated RLS helper function privileges survive removing PUBLIC grants', () => {
  for (const func of ['app_role()', 'app_ward_id()', 'app_access_active()', 'ward_operational_on(uuid,date)']) {
    assert.match(sql, new RegExp(`grant execute on function [^;]*public\\.${func.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^;]* to authenticated;`, 'i'));
  }
});

test('report and draft optimistic concurrency is validated in the database, not only UI', () => {
  assert.match(sql, /expected_report_revision/);
  assert.match(sql, /expected_draft_revision/);
  assert.match(sql, /pg_advisory_xact_lock\(hashtextextended/);
  assert.match(sql, /REPORT_CONFLICT/);
  assert.match(cycle, /expected_report_revision/);
  assert.match(cycle, /expected_draft_revision/);
  assert.match(cycle, /draft\?\.revision/);
  assert.match(cycle, /expectedRevision/);
});

test('Ward creation and maintenance capacity edit are server-side transactions', () => {
  assert.match(ward, /\.rpc\('create_ward'/);
  assert.match(ward, /\.rpc\('save_ward_configuration'/);
  assert.match(sql, /create or replace function public\.create_ward\(p_config jsonb\)/);
  assert.match(sql, /create or replace function public\.save_ward_configuration\(/);
  assert.match(sql, /create trigger trg_capacity_config_audit/);
  assert.match(sql, /create trigger trg_items_config_audit/);
});

test('account administration has explicit user-auth and Maintenance-role boundaries', () => {
  assert.match(account, /withSupabase\(\{ auth: 'user' \}/);
  assert.match(account, /caller\.role !== 'maintenance'/);
  assert.match(account, /\.rpc\('admin_write_user_access'/);
  assert.match(sql, /auth\.role\(\) is distinct from 'service_role'/);
  assert.match(sql, /p_actor uuid, p_action text, p_account jsonb/);
});

test('original project and domain cannot be implicitly reused', () => {
  assert.match(read('config.js'), /FORCE_DEMO_MODE: false/);
  assert.match(read('config.js'), /YOUR-PROJECT/);
  assert.doesNotMatch(read('config.js'), /night-memo\.eu\.cc/);
  assert.equal(existsSync(new URL('../CNAME', import.meta.url)), false);
  assert.equal(existsSync(new URL('../public/CNAME', import.meta.url)), false);
  assert.equal(existsSync(new URL('../supabase/functions/admin-users/index.ts', import.meta.url)), true);
});

test('Ward S/D feature is current per-Ward data, not optional beta migration', () => {
  assert.match(sql, /single_double_reporting_enabled boolean not null default false/);
  assert.match(read('data/repositories/access-repository.js'), /single_double_reporting_enabled/);
  assert.match(read('domain/empty-bed-reporting.js'), /single_double_reporting_enabled/);
  assert.match(ward, /single_double_reporting_enabled/);
});


test('Ward device-by-bed inputs use canonical object format, never discarded array', () => {
  const source = read('pages/ward-page.js');
  assert.match(source, /normalizeDevice\(\{ mode: 'beds', beds: getBeds/);
  assert.doesNotMatch(source, /normalizeDevice\(getBeds/);
});
