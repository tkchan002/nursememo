import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderNightStaffPrintHtml, renderNightRunnerPrintHtml } from '../night-roster-print.js';
const read=file=>readFile(new URL(`../${file}`,import.meta.url),'utf8');
test('Patrol workspace preserves source-owned Night Staffing markup',async()=>{
 const html=await read('patrol.html'),js=await read('pages/patrol-night-operations.js');
 assert.match(html,/data-patrol-tab-panel="staffing"/);
 assert.match(html,/id="nightWardStaffRows"/);
 assert.doesNotMatch(js,/installPanel|installStyles/);
});
test('official memo uses DOCX export; roster HTML printing remains portrait',async()=>{
 const page=await read('pages/patrol-page.js'),docx=await read('documents/patrol-docx.js');
 assert.match(page,/result\.finalPdf/);
 assert.doesNotMatch(page,/renderPatrolMemoPrintHtml/);
 assert.match(docx,/PageOrientation.LANDSCAPE/);
 for (const html of [renderNightStaffPrintHtml({wardRosters:[]}),renderNightRunnerPrintHtml({runners:[]})]) {
  assert.match(html,/data-print-system="patrol-v2"/);
  assert.match(html,/@page\{size:A4 portrait/);
  assert.doesNotMatch(html,/@page\{size:A4 landscape/);
 }
});
