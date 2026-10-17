import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const sql = read('supabase/schema.sql');
const ward = read('pages/ward-page.js');
const service = read('services/report-service.js');

test('fresh baseline accepts only PM and Night and keys reports independently', () => {
  assert.match(sql, /report_type text not null check \(report_type in \('pm','night'\)\)/);
  assert.match(sql, /unique \(ward_id, report_date, report_type\)/);
  assert.doesNotMatch(sql, /'legacy'|save_ward_report_session/);
});

test('submitted report and revision insertion share a single database transaction', () => {
  const fn = sql.split('create or replace function public.submit_ward_cycle_report(')[1]
    .split('create or replace function public.get_ward_cycle_draft(')[0];
  assert.match(fn, /insert into public\.ward_reports/);
  assert.match(fn, /insert into public\.ward_cycle_revisions/);
  assert.match(fn, /delete from public\.ward_cycle_drafts/);
  assert.match(fn, /assert_ward_cycle_access/);
});

test('audit trigger ignores client-supplied creator and keeps original on resubmit', () => {
  assert.match(sql, /new\.created_by = auth\.uid\(\)/);
  assert.match(sql, /new\.created_by = old\.created_by/);
  assert.match(sql, /revoke insert, update, delete on public\.ward_reports from authenticated/);
});

test('Ward save uses generation checking rather than a naive dirty reset', () => {
  assert.match(ward, /const savingVersion = state\.editVersion/);
  assert.match(ward, /state\.dirty = state\.editVersion !== savingVersion/);
  assert.match(ward, /const submittingVersion = state\.editVersion/);
  assert.match(ward, /state\.dirty = state\.editVersion !== submittingVersion/);
});

test('no old report submission fallback remains in service', () => {
  assert.match(service, /db\.submitWardCycleReport\(row\)/);
  assert.match(service, /db\.saveWardCycleDraft\(row\)/);
  assert.doesNotMatch(service, /saveWardReportSession|catch\s*\([^)]*\)\s*\{[^}]*legacy/);
});

test('clean schema contains each named repository RPC', () => {
  const names = new Set([...sql.matchAll(/create or replace function public\.([a-z_]+)\(/ig)].map(m => m[1]));
  const index = read('data/index.js');
  assert.match(index, /getWardCycleReport/);
  for (const rpc of ['save_ward_cycle_draft', 'submit_ward_cycle_report',
    'get_ward_cycle_draft', 'delete_ward_cycle_draft', 'save_manager_memo_revision',
    'save_manager_memo_recovery', 'night_memo_docx_layout_version', 'reorder_wards']) {
    assert.ok(names.has(rpc), `missing ${rpc}`);
  }
});
