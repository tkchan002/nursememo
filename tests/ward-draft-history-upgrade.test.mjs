import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mergeWardHistory, wardHistoryKey } from '../domain/ward-history.js';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const t1 = '2026-10-18T14:00:00.000Z';
const t2 = '2026-10-18T17:00:00.000Z';
const t3 = '2026-10-18T18:00:00.000Z';
const report = { id: 'r1', ward_id: 'w1', report_date: '2026-10-18', report_type: 'night', submitted_at: t1, payload: { value: 'official' } };
const draft = { ward_id: 'w1', report_date: '2026-10-18', report_type: 'night', updated_at: t3, revision: 3 };

test('History makes a draft visible without converting it to a submitted report', () => {
  const history = mergeWardHistory([], [draft]);
  assert.equal(history.length, 1);
  assert.equal(history[0].kind, 'draft');
  assert.equal(history[0].hasSubmittedVersion, false);
  assert.equal(history[0].report_date, '2026-10-18');
  assert.equal(history[0].activity_at, t3);
});

test('Submitted version and later unsubmitted draft are separately inspectable', () => {
  const history = mergeWardHistory([report], [draft]);
  assert.deepEqual(history.map(e => e.kind), ['draft', 'submitted']);
  assert.equal(history[0].hasSubmittedVersion, true);
  assert.notEqual(wardHistoryKey(history[0]), wardHistoryKey(history[1]));
  assert.equal(history[1].payload.value, 'official');
  assert.equal(history[0].submitted_at, undefined);
});

test('PM and Night drafts use distinct keys and historical activity ordering', () => {
  const pmDraft = { ...draft, report_type: 'pm', updated_at: t2 };
  const olderReport = { ...report, id: 'r2', report_date: '2026-10-17', submitted_at: t1 };
  const history = mergeWardHistory([olderReport], [pmDraft, draft]);
  assert.deepEqual(history.map(wardHistoryKey), [
    'draft:2026-10-18:night', 'draft:2026-10-18:pm', 'submitted:2026-10-17:night',
  ]);
  assert.equal(mergeWardHistory([olderReport], [pmDraft, draft], 2).length, 2);
});

test('Draft-list RPC is authenticated, ward-scoped, read-only and metadata-only', async () => {
  const sql = await read('supabase/UPGRADE_WARD_DRAFT_HISTORY.sql');
  const schema = await read('supabase/schema.sql');
  for (const source of [sql, schema]) {
    assert.match(source, /create or replace function public\.list_ward_cycle_drafts\(p_ward_id uuid, p_limit integer default 30\)/);
    assert.match(source, /security definer set search_path = public, pg_temp/);
    assert.match(source, /auth\.uid\(\) is null/);
    assert.match(source, /a\.active and a\.role = 'ward'/);
    assert.match(source, /a\.ward_id = p_ward_id/);
    assert.match(source, /ward_id, report_date, report_type, revision, updated_at, created_at/);
    assert.match(source, /revoke all on function public\.list_ward_cycle_drafts\(uuid,integer\) from public,anon/);
    assert.match(source, /grant execute on function public\.list_ward_cycle_drafts\(uuid,integer\) to authenticated/);
    assert.doesNotMatch(source, /select\s+\*\s+from\s+public\.ward_cycle_drafts/i);
    assert.doesNotMatch(source, /grant select on public\.ward_cycle_drafts/i);
  }
});

test('Ward History retrieves metadata, then fetches the selected draft with the authorized RPC', async () => {
  const page = await read('pages/ward-page.js');
  const repository = await read('data/repositories/report-cycle-repository.js');
  const service = await read('services/report-service.js');
  const html = await read('ward.html');
  assert.match(page, /listWardCycleDrafts\(state\.ward\.id, CONFIG\.RECENT_HISTORY_LIMIT\)/);
  assert.match(page, /getRecentReports\(state\.ward\.id, CONFIG\.RECENT_HISTORY_LIMIT\)/);
  assert.match(page, /getWardCycleDraft\(state\.ward\.id, entry\.report_date, entry\.report_type\)/);
  assert.match(page, /await loadForDate\(entry\.report_date\)/);
  assert.match(page, /Unsubmitted changes/);
  assert.match(page, /historyListRequests\.isCurrent\(requestId\)/);
  assert.match(page, /getWardCycleDraft\(/);
  assert.match(repository, /supabase\.rpc\('list_ward_cycle_drafts'/);
  assert.match(repository, /\.map\(\(\{ ward_id, report_date, report_type, revision, updated_at, created_at \}\)/);
  assert.match(service, /db\.getWardCycleDraft\(wardId, date, memoType\)/);
  assert.match(html, /id="hbResumeDraft"/);
  assert.match(html, /Save Draft<\/button>/);
  assert.doesNotMatch(service, /listWardCycleDrafts/); // Patrol's source path remains submitted-only.
});

test('Ward success messages no longer change page layout and failure messages are dismissible', async () => {
  const css = await read('css/ward-draft-submit.css');
  const page = await read('pages/ward-page.js');
  assert.match(css, /\.ward-page #statusBox \{[\s\S]*?position: fixed/);
  assert.match(css, /\.ward-page #statusBox\.warning\.is-visible \{ display: block/);
  assert.match(page, /if \(type === 'success'\) showStatus\._t/);
  assert.match(page, /if \(type === 'error' \|\| type === 'warning'\)/);
  assert.match(page, /aria-label', 'Dismiss notification'/);
});
