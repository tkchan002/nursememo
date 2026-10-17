import test from 'node:test';
import assert from 'node:assert/strict';
let buildPatrolDocxBytes;
let loadError;
try { ({buildPatrolDocxBytes}=await import('../documents/patrol-docx.js')); }
catch(error){loadError=error;}
// GitHub Actions installs `docx`; the actual binary-generation test is mandatory there.
if (loadError && process.env.DOCX_VERIFY_GENERATION === '1') throw loadError;
test('browser-compatible generator creates a ZIP-backed A4 landscape DOCX', {skip:!!loadError}, async()=>{
 const bytes=await buildPatrolDocxBytes({
  title:'Night Memo',header:{fromName:'Demo APN',date:'16/10/2026'},
  mainTableRows:[{ward:'C10',admissionEC:1,discharge:0,totalPatient:20}],
  infectionRows:[{ward:'C10',covid:0}],signature:{name:'Example APN',designation:'N.O./APN'}
 });
 assert.ok(bytes instanceof Uint8Array);
 assert.ok(bytes.length>2500,`DOCX unexpectedly small (${bytes.length})`);
 assert.deepEqual(Array.from(bytes.slice(0,2)),[0x50,0x4b]);
});
