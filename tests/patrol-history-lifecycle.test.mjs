import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

test('Patrol UI uses Save / History / Preview / Print and retires Finalize/Reopen', () => {
  const html = read('patrol.html');
  assert.match(html, /id="saveMemoBtn">Save</);
  assert.match(html, /id="historyBtn">History</);
  assert.match(html, /id="previewMemoBtn">Preview</);
  assert.match(html, /id="printMemoBtn">Print</);
  assert.doesNotMatch(html, /Finalize/);
  assert.doesNotMatch(html, /Reopen Draft/);
});

test('Patrol login has workspace chooser instead of automatic editor-only flow', () => {
  const html = read('patrol.html');
  const js = read('pages/patrol-page.js');
  assert.match(html, /id="memoWorkspacePanel"/);
  assert.match(html, /id="continueDraftBtn"/);
  assert.match(html, /id="startNewBtn"/);
  assert.match(js, /renderWorkspace\(\)/);
  assert.doesNotMatch(js, /loadOrCreateMemo\(/);
});

test('Save creates Draft revision and Print creates Final revision', () => {
  const js = read('pages/patrol-page.js');
  assert.match(js, /saveOfficialRevision\('draft', 'save'\)/);
  assert.match(js, /saveOfficialRevision\('final',\s*'print'\)/);
  assert.match(js, /showPdfPreview\(result\.finalPdf/);
});

test('autosave uses recovery path rather than history revision path', () => {
  const js = read('pages/patrol-page.js');
  assert.match(js, /setTimeout\(\(\) => saveRecoveryNow\(\)/);
  assert.match(js, /savePatrolDocxRecovery/);
});

test('DOCX exports do not invoke retired HTML Patrol print renderer', () => {
  const js = read('pages/patrol-page.js');
  assert.doesNotMatch(js, /renderPatrolMemoPrintHtml|onclick="window\.print\(\)"/);
  assert.match(js, /finalPdf/);
});

test('migration creates immutable revision table and history RPCs', () => {
  const sql = read('supabase/schema.sql');
  assert.match(sql, /create table public\.patrol_memo_revisions/i);
  assert.match(sql, /save_patrol_memo_recovery/i);
  assert.match(sql, /save_patrol_memo_revision/i);
  assert.match(sql, /list_patrol_memo_revisions/i);
  assert.match(sql, /get_patrol_memo_revision/i);
});
