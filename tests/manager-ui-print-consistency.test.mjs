import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderNightStaffPrintHtml, renderNightRunnerPrintHtml } from '../night-roster-print.js';
const read=file=>readFile(new URL(`../${file}`,import.meta.url),'utf8');
test('Manager workspace preserves source-owned Night Staffing markup',async()=>{
 const html=await read('manager.html'),js=await read('pages/manager-night-operations.js');
 assert.match(html,/data-manager-tab-panel="staffing"/);
 assert.match(html,/id="nightWardStaffRows"/);
 assert.doesNotMatch(js,/installPanel|installStyles/);
});
test('official memo uses DOCX export; roster HTML printing remains portrait',async()=>{
 const page=await read('pages/manager-page.js'),docx=await read('documents/manager-docx.js');
 assert.match(page,/result\.finalPdf/);
 assert.doesNotMatch(page,/renderManagerMemoPrintHtml/);
 assert.match(docx,/PageOrientation.LANDSCAPE/);
 for (const html of [renderNightStaffPrintHtml({wardRosters:[]}),renderNightRunnerPrintHtml({runners:[]})]) {
  assert.match(html,/data-print-system="manager-v2"/);
  assert.match(html,/@page\{size:A4 portrait/);
  assert.doesNotMatch(html,/@page\{size:A4 landscape/);
 }
});
