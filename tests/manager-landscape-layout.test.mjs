import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderManagerMemoPrintHtml } from '../manager-memo-print.js';
import { renderNightRunnerPrintHtml } from '../night-roster-print.js';
const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('memo alone prints landscape; roster remains portrait', () => {
  const memo = renderManagerMemoPrintHtml({version:4, html:'<p>Test</p>'});
  const runner = renderNightRunnerPrintHtml({runners:[]});
  assert.match(memo, /@page\{size:A4 landscape/);
  assert.match(memo, /@media screen\{\.manager-print-page\{width:297mm/);
  assert.doesNotMatch(runner, /@page\{size:A4 landscape/);
  assert.match(runner, /@page\{size:A4 portrait/);
});

test('DOCX embedded editor is visible and owns pagination rather than continuous fake paper',()=>{
 const js=read('editor/manager-ranuts.js');const css=read('css/manager-document.css');const manager=read('manager.html');
 assert.match(js,/document:open-buffer/);assert.match(js,/document:dirty-changed/);
 assert.match(css,/#memoEditor/);assert.doesNotMatch(css, /\.jodit-wysiwyg/);
 assert.match(manager,/A4 landscape/);assert.match(manager,/<iframe id="memoEditor"/);
});
test('official DOCX generation specifies A4 landscape and separate roster HTML printing remains portrait',()=>{
 const docx=read('documents/manager-docx.js');const print=read('manager-document-print-css.js');
 assert.match(docx,/PageOrientation.LANDSCAPE/);assert.match(docx,/tableHeader:true/);
 assert.match(print,/font-size:9pt;table-layout:auto/);
});
