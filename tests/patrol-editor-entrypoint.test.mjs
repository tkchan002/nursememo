import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

test('Patrol root entry keeps core page critical and Night Staffing resilient', async () => {
  const js = (await readFile(new URL('patrol.js', root), 'utf8')).trim();
  assert.match(js, /^import '\.\/pages\/patrol-page\.js';/);
  assert.match(js, /import\('\.\/pages\/patrol-night-operations\.js'\)\.catch/);
  assert.doesNotMatch(js, /import '\.\/pages\/patrol-night-operations\.js';/);
});

test('Patrol HTML uses the four-workspace architecture and retains the official document editor', async () => {
  const html = await readFile(new URL('patrol.html', root), 'utf8');
  assert.doesNotMatch(html, /templateEditorFrame|Print Template/);
  assert.match(html, /data-patrol-tab="submission"/);
  assert.match(html, /data-patrol-tab="ward-info"/);
  assert.match(html, /data-patrol-tab="memo"/);
  assert.match(html, /data-patrol-tab="staffing"/);
  assert.match(html, /id="memoEditor"/);
});
