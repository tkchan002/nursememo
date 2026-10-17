import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assertDocxBytes, base64ToBytes, bytesToBase64, docxMetadata } from '../documents/docx-bytes.js';
const src=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
test('DOCX bytes round-trip losslessly and are referenced by metadata',()=>{
 const bytes=Uint8Array.from([0x50,0x4b,...Array.from({length:100},(_,i)=>i%256)]);
 const encoded=bytesToBase64(bytes);
 assert.deepEqual(base64ToBytes(encoded),bytes);
 assert.deepEqual(docxMetadata('example-id',bytes),{version:5,format:'docx',document_id:'example-id',size_bytes:bytes.length});
 assert.throws(()=>assertDocxBytes(new Uint8Array([0x50,0x4b])),/Invalid or oversized/);
 assert.throws(()=>base64ToBytes('aGVsbG8='),/Invalid or oversized/);
});
test('Patrol only uses DOCX-specific save RPCs and PDF exporter for official memo',()=>{
 const page=src('pages/patrol-page.js');
 const entry=src('patrol.js');
 assert.match(page,/savePatrolDocxRecovery/);assert.match(page,/savePatrolDocxRevision/);
 assert.match(page,/getPatrolDocxBytes/);
 assert.match(page,/result\.finalPdf/);
 assert.doesNotMatch(page,/renderPatrolMemoPrintHtml|savePatrolMemoRecovery\(|savePatrolMemoRevision\(/);
 assert.doesNotMatch(entry,/jodit/);
 assert.match(src('patrol.html'),/<iframe id="memoEditor"/);
});
test('DOCX generator makes landscape tables, repeatable headers and non-spaced signature layout',()=>{
 const gen=src('documents/patrol-docx.js');
 assert.match(gen,/PageOrientation.LANDSCAPE/);
 assert.match(gen,/tableHeader:true/);
 assert.match(gen,/Signature: /);
 assert.match(gen,/designation.*N.O.\/APN/);
 assert.doesNotMatch(gen,/Signature:[^\n]{20,} {10,}Designation:/);
});
test('SQL performs binary and reference persistence together, disallows public table access',()=>{
 const sql=src('supabase/schema.sql');
 assert.match(sql,/data bytea not null/i);
 assert.match(sql,/enable row level security/i);
 assert.match(sql,/revoke all on public\.patrol_memo_docx_documents from public, anon, authenticated/i);
 assert.match(sql,/public\.save_patrol_memo_recovery\(/);
 assert.match(sql,/public\.save_patrol_memo_revision\(/);
 assert.match(sql,/save_patrol_memo_recovery_docx/);
 assert.match(sql,/save_patrol_memo_revision_docx/);
 assert.match(sql,/read_patrol_memo_docx/);
 assert.match(sql,/PATROL_ACCESS_REQUIRED/);
 assert.match(sql,/DOCX_NOT_REFERENCED/);
});
test('External document-editor messages are restricted by both origin and frame',()=>{
 const js=src('editor/patrol-ranuts.js');
 assert.match(js,/event\.origin!==EDITOR_ORIGIN/);
 assert.match(js,/event\.source!==frame\.contentWindow/);
 assert.match(js,/targetExt:format/);
 assert.match(js,/document:open-buffer/);
 assert.match(js,/document:dirty-changed/);
});
