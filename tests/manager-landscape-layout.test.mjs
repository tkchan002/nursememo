import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderNightRunnerPrintHtml } from '../night-roster-print.js';
const read = file => readFileSync(new URL(`../${file}`,import.meta.url),'utf8');

test('DOCX memo is landscape but Night Runner HTML print stays portrait',()=>{
  const docx=read('documents/manager-docx.js');
  const runner=renderNightRunnerPrintHtml({runners:[]});
  assert.match(docx,/PageOrientation.LANDSCAPE/);
  assert.match(runner,/@page\{size:A4 portrait/);
  assert.doesNotMatch(runner,/@page\{size:A4 landscape/);
});
test('embedded DOCX editor remains a visible iframe with native pagination',()=>{
  const js=read('editor/manager-ranuts.js'),css=read('css/manager-document.css'),manager=read('manager.html');
  assert.match(js,/document:open-buffer/); assert.match(js,/document:dirty-changed/);
  assert.match(css,/#memoEditor/); assert.doesNotMatch(css,/\.jodit-wysiwyg/);
  assert.match(manager,/A4 landscape/); assert.match(manager,/<iframe id="memoEditor"/);
});
test('the signature is a borderless flow block, never a repeating table header',()=>{
  const docx=read('documents/manager-docx.js');
  assert.match(docx,/signatureBlock\(s,layout,width\)/);
  assert.match(docx,/borders:noBorders/);
  assert.match(docx,/cantSplit:true/);
  assert.match(docx,/tableHeader:true/);
});
