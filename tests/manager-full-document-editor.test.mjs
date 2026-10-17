import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildManagerMemoData } from '../domain/manager-memo.js';
const read=name=>readFile(new URL(`../${name}`,import.meta.url),'utf8');
test('new Night Memo source model produces tables and narrative sections',()=>{
 const model=buildManagerMemoData({bundle:[],reportingDate:'2026-10-16'});
 assert.equal(model.header.date,'16/10/2026');
 assert.ok(Array.isArray(model.mainTableRows));
 assert.ok(Array.isArray(model.infectionRows));
 assert.ok(Object.hasOwn(model,'earlyBirdHtml'));
 assert.ok(Object.hasOwn(model,'ct'));
 assert.ok(Object.hasOwn(model,'signature'));
});
test('Manager uses embedded DOCX editor and binary persistence',async()=>{
 const html=await read('manager.html'),page=await read('pages/manager-page.js'),adapter=await read('editor/manager-ranuts.js');
 assert.match(html,/<iframe id="memoEditor"/);
 assert.match(adapter,/document:open-buffer/);
 assert.match(adapter,/document:save/);
 assert.match(page,/saveManagerDocxRecovery/);
 assert.match(page,/saveManagerDocxRevision/);
 assert.match(page,/getManagerDocxBytes/);
 assert.match(page,/Regenerate this Night Memo/);
});
