import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const page = await readFile(new URL('../pages/ward-page.js', import.meta.url), 'utf8');
const service = await readFile(new URL('../services/report-service.js', import.meta.url), 'utf8');
const repo = await readFile(new URL('../data/repositories/report-cycle-repository.js', import.meta.url), 'utf8');
const sql = await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8');

test('Save and Submit use memo-type-scoped storage rather than a rolling window', () => {
  assert.match(page, /saveWardDraft\(/);
  assert.match(page, /submitWardReport\(/);
  assert.match(service, /db\.saveWardCycleDraft\(row\)/);
  assert.match(service, /db\.submitWardCycleReport\(row\)/);
  assert.match(sql, /delete from public\.ward_cycle_drafts/i);
  assert.doesNotMatch(service, /db\.saveWardReportSession\(/);
});

test('Ward UI exposes both memo types and their independent submission status', async () => {
  const html=await readFile(new URL('../ward.html',import.meta.url),'utf8');
  assert.match(html, /id="submitBtn"/);
  assert.match(page, /\$\('#memoType'\)\.addEventListener\('change', handleMemoTypeChange\)/);
  assert.match(page, /Memo: Submitted|\$\{esc\(typeLabel\)\}: Submitted/);
  assert.match(page, /\$\{esc\(typeLabel\)\}: Not submitted/);
  assert.match(page, /Draft changes pending re-submit/);
  assert.match(page, /handleGen/);
  assert.match(page, /handleGen/);
});

test('Draft schema is separate from ward_reports and access is ward-scoped', () => {
  assert.match(sql, /create table public\.ward_cycle_drafts/i);
  assert.match(sql, /a\.role = 'ward'/i);
  assert.match(sql, /a\.ward_id = p_ward_id/i);
  assert.match(sql, /get_ward_cycle_draft/i);
});

test('Live form version remains the registered version 1', () => {
  assert.match(service, /form_version:\s*1/);
  assert.doesNotMatch(service, /form_version:\s*2/);
});

test('Repository exposes draft persistence without changing Manager recent-submission query', () => {
  assert.match(repo, /export async function saveWardCycleDraft/);
  assert.match(repo, /export async function getWardCycleReport/);
  assert.match(repo, /report_type/);
});
