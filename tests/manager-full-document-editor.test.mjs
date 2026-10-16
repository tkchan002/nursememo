import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildManagerMemoDocument, regenerateWardDerivedSections } from '../domain/manager-memo.js';
import { renderEditableManagerMemoHtml, sanitizeManagerMemoHtml } from '../domain/manager-memo-html.js';
import { renderManagerMemoPrintHtml } from '../manager-memo-print.js';
const read = name => readFile(new URL(`../${name}`, import.meta.url), 'utf8');

test('new memo uses one canonical editable HTML string with tables, CT scan and signature', () => {
  const doc = buildManagerMemoDocument({bundle:[],reportingDate:'2026-10-16'});
  assert.deepEqual(Object.keys(doc).sort(), ['html','version']);
  assert.equal(doc.version,4);
  assert.match(doc.html, /<table class="nm-document-table nm-document-main">/);
  assert.match(doc.html, /Infectious Case:|Infectious Case/);
  assert.match(doc.html, /Total No. of CT scan done/);
  assert.match(doc.html, /Signature/);
});

test('auto-generated wards are HTML escaped before display', () => {
  const html=renderEditableManagerMemoHtml({mainTableRows:[{ward:'<img src=x onerror=alert(1)>', admissionEC:'5'}]});
  assert.match(html,/&lt;img src=x/);
  assert.doesNotMatch(html,/<img /);
});

test('manager works with editable A4 print rendered from canonical html only', () => {
  const print=renderManagerMemoPrintHtml({version:4,html:'<b>A&amp;B</b>'});
  assert.match(print, /manager-memo-document/);
  assert.match(print, /@page\{size:A4 portrait/);
  assert.doesNotMatch(print, /manager-print-title">Night Memo/);
  assert.match(print, /A&amp;amp;B/); // DOM-free Node fail-closed escaping, browser uses DOM sanitizer.
});

test('document regeneration creates a new document and does not carry over edited text',()=>{
 const previous={version:4,html:'<p>MANUALLY EDITED</p>'};
 const next=regenerateWardDerivedSections(previous,{bundle:[],reportingDate:'2026-10-16'});
 assert.equal(next.version,4);
 assert.doesNotMatch(next.html,/MANUALLY EDITED/);
 assert.match(next.html,/Early bird:/);
});

test('Jodit is lazy-loaded, replacing segmented contenteditable document sections',async()=>{
 const html=await read('manager.html');const page=await read('pages/manager-page.js');const adapter=await read('editor/manager-jodit.js');
 assert.match(html,/<textarea id="memoEditor"/);
 assert.doesNotMatch(html,/id="memoFromName"|id="memoMainRows"|id="memoEarlyBird"/);
 assert.match(adapter,/import\('jodit'\)/);
 assert.match(adapter,/['"]font['"],['"]fontsize['"]/);
 assert.match(adapter,/['"]table['"]/);
 assert.match(page,/memoEditorInstance\.getValue\(\)/);
 assert.match(page,/Regenerate this Night Memo/);
});

test('HTML sanitizer fails closed when no trusted DOM is available',()=>{
 const input='<script>alert(1)</script><p onclick="bad()">A</p>';
 const cleaned=sanitizeManagerMemoHtml(input);
 assert.doesNotMatch(cleaned,/<script|<p onclick=/);
 assert.match(cleaned,/&lt;script&gt;/);
});
