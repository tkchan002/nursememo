import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Patrol History is a source-defined sidebar/archive view, not the old modal', () => {
  const html = read('patrol.html');
  assert.match(html, /id="patrolHistorySidebar"/);
  assert.match(html, /id="patrolHistoryNightList"/);
  assert.match(html, /id="patrolArchiveViewer"/);
  assert.match(html, /id="archiveRevisionList"/);
  assert.match(html, /id="archiveMemoFrame"/);
  assert.doesNotMatch(html, /id="historyModal"/);
  assert.doesNotMatch(html, /id="historyBody"/);
});

test('History mode hides the live Patrol workspace and returns explicitly', () => {
  const js = read('pages/patrol-page.js');
  assert.match(js, /async function enterHistoryMode\(\)/);
  assert.match(js, /#patrolHistorySidebar'\)\.hidden = false/);
  assert.match(js, /state\.historyMode = true;\s*setMemoEditorWorkspaceVisible\(false\)/);
  assert.match(js, /function exitHistoryMode\(\)/);
  assert.match(js, /state\.historyReturnMode/);
});

test('archive lists every reporting night and prefers Final over Draft over recovery', () => {
  const js = read('pages/patrol-page.js');
  const repo = read('data/repositories/patrol-memo-repository.js');
  const sql = read('supabase/schema.sql');
  assert.match(js, /listPatrolMemoArchive\(\)/);
  assert.match(js, /revisions\.find\(row => row\.revision_type === 'final'\) \|\| revisions\[0\]/);
  assert.match(repo, /supabase\.rpc\('list_patrol_memo_archive'\)/);
  assert.match(sql, /create or replace function public\.list_patrol_memo_archive\(\)/i);
  assert.match(sql, /coalesce\(final_rev\.id, latest\.id\) as preferred_revision_id/i);
});

test('past reporting nights are read-only and only the current night can restore a version', () => {
  const js = read('pages/patrol-page.js');
  assert.match(js, /const mayRestore = state\.archiveSelectedDate === state\.reportingDate/);
  assert.match(js, /if \(state\.archiveSelectedDate !== state\.reportingDate\) return;/);
});

test('destructive Patrol operations keep safety recovery checkpoints', () => {
  const js = read('pages/patrol-page.js');
  const sql = read('supabase/schema.sql');
  assert.match(js, /checkpointCurrentWorkingCopy\('before_start_new'\)/);
  assert.match(js, /checkpointCurrentWorkingCopy\('before_regenerate_ward_sections'\)/);
  assert.match(js, /checkpointCurrentWorkingCopy\(checkpointReason\)/);
  assert.match(sql, /create table public\.patrol_memo_recovery_snapshots/i);
  assert.match(sql, /offset 10/i);
});
