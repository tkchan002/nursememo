import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createPatrolDocumentEditor, EDITOR_ORIGIN } from '../editor/patrol-ranuts.js';

const source = filename => readFileSync(new URL('../' + filename, import.meta.url), 'utf8');

function mockEditor(onNativeExport) {
  const previous = {window:globalThis.window, document:globalThis.document, location:globalThis.location};
  const listeners = new Map();
  const sent = [];
  const frame = {
    tagName:'IFRAME', src:'', inert:false,
    contentWindow:{ postMessage(message){sent.push(message);} },
    classList:{toggle(){}},setAttribute(){},removeAttribute(){},
  };
  globalThis.window = {
    addEventListener(event,listener){listeners.set(event,listener);},
    removeEventListener(event){listeners.delete(event);},
  };
  globalThis.document = { querySelector(){return frame;} };
  globalThis.location = { origin:'https://nursememo.app' };
  const exports = [];
  const editor = createPatrolDocumentEditor('#memoEditor', ()=>{}, {
    onNativeExport: file => { exports.push(file); return onNativeExport?.(file); },
  });
  const send = (data, {origin=EDITOR_ORIGIN, source=frame.contentWindow}={}) =>
    listeners.get('message')?.({origin, source, data});
  return {editor,send,frame,exports,sent,cleanup(){editor.destroy(); Object.assign(globalThis,previous);} };
}

test('native File > Download As export reaches the host even with no pending save, but forged messages do not', async () => {
  const m = mockEditor();
  try {
    m.send({type:'document:ready'});
    await m.editor.ready();
    const pdf = new Blob(['%PDF-1.7\n...'], {type:'application/pdf'});
    m.send({type:'document:exported',payload:{file:pdf}},{origin:'https://attacker.example'});
    m.send({type:'document:exported',payload:{file:pdf}},{source:{}});
    m.send({type:'document:exported',payload:{file:{data:'forged'}}});
    assert.equal(m.exports.length,0);
    m.send({type:'document:exported',payload:{file:pdf}});
    assert.equal(m.exports.length,1);
    assert.equal(m.exports[0],pdf);
    assert.equal(m.sent.length,0, 'receiving a native export must not cause another save');
  } finally {m.cleanup();}
});

test('a native export does not steal the id of a pending document:save response', async () => {
  const m = mockEditor();
  try {
    m.send({type:'document:ready'});
    await m.editor.ready();
    const bytes = new Uint8Array(110); bytes[0]=0x50;bytes[1]=0x4b;
    const opening = m.editor.open(bytes);
    await Promise.resolve();await Promise.resolve();
    m.send({type:'document:opened',id:m.sent[0].id});
    await opening;
    const saving=m.editor.export('PDF');
    await Promise.resolve();await Promise.resolve();
    const request=m.sent.at(-1);
    assert.equal(request.type,'document:save');
    m.send({type:'document:exported',payload:{file:new Blob(['%PDF-native'])}});
    assert.equal(m.exports.length,1);
    m.send({type:'document:saved',id:request.id,payload:{file:new Blob(['%PDF-saved'])}});
    assert.equal(await (await saving).text(),'%PDF-saved');
  } finally {m.cleanup();}
});

test('the pinned upstream build is patched only at the embedded no-op export branch',()=>{
  const temp=mkdtempSync(join(tmpdir(),'nm-native-export-'));
  const upstream=join(temp,'lib','onlyoffice');
  mkdirSync(upstream,{recursive:true});
  const filename=join(upstream,'save-stream.ts');
  try {
    const original=`function routeSavedFile(file: File) {
      if (state.request) { request.resolve(file); return; }
      if (isEmbedMode()) {
        console.warn('Local save is disabled in iframe embed mode. Use document:save from the parent page.');
        return;
      }
      saveFileToDisk(file, file.name);
    }`;
    writeFileSync(filename,original);
    const run=()=>spawnSync(process.execPath,['scripts/patch-editor-embedded-downloads.mjs'],{
      cwd:new URL('..',import.meta.url),encoding:'utf8',
      env:{...process.env,RANUTS_SOURCE_DIR:temp},timeout:15000,
    });
    const patched=run();
    assert.equal(patched.status,0,patched.stderr);
    const result=readFileSync(filename,'utf8');
    assert.match(result,/if \(state.request\) \{ request.resolve\(file\); return; \}/);
    assert.match(result,/type: 'document:exported'/);
    assert.match(result,/window\.parent\.postMessage/);
    assert.doesNotMatch(result,/Local save is disabled in iframe embed mode/);
    assert.match(result,/hostOrigin,\s*\)/); 
    assert.match(result,/get\('embedOrigin'\)/);
    assert.match(result,/saveFileToDisk\(file, file\.name\)/);
    assert.equal(run().status,1,'unexpected upstream changes should abort the build');
  } finally {rmSync(temp,{force:true,recursive:true});}
});

test('the deployed site patches upstream before build and Nurse Memo connects both editors',()=>{
  const workflow=source('.github/workflows/deploy-pages.yml');
  const patch=workflow.indexOf('node scripts/patch-editor-embedded-downloads.mjs');
  const build=workflow.indexOf('pnpm run build');
  assert.ok(patch>0 && build>patch);
  const patrol=source('pages/patrol-page.js');
  assert.match(patrol,/handleNativeEditorExport\(file\)/);
  assert.match(patrol,/handleNativeEditorExport\(file, \{ history: true \}\)/);
  assert.match(patrol,/showPdfPreview\(file,/);
  assert.match(patrol,/link\.click\(\)/);
  assert.match(patrol,/'%PDF-'/);
  assert.match(patrol,/const supported = new Set\(\['pdf'/);
  assert.match(patrol,/if \(ext === 'docx'\)/);
  assert.match(patrol,/setTimeout\(\(\) => URL\.revokeObjectURL\(url\), 60000\)/);
});
