import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPatrolDocumentEditor, EDITOR_ORIGIN } from '../editor/patrol-ranuts.js';
const src = name => readFileSync(new URL('../'+name, import.meta.url),'utf8');

test('load after ready cannot cancel an open-buffer request', async () => {
  const previous={window:globalThis.window,document:globalThis.document,location:globalThis.location};
  const windowListeners=new Map();
  const frameListeners=new Map();
  const classSet=new Set();
  const sent=[];
  const frame={
    tagName:'IFRAME', src:'',
    contentWindow:{postMessage(message,origin){sent.push({message,origin});}},
    addEventListener(type,fn){frameListeners.set(type,fn);},
    setAttribute(){},removeAttribute(){},
    classList:{toggle(key,active){if(active)classSet.add(key);else classSet.delete(key);}},
  };
  globalThis.window={addEventListener(type,fn){windowListeners.set(type,fn);},removeEventListener(type){windowListeners.delete(type);}};
  globalThis.document={querySelector(id){assert.equal(id,'#memoEditor');return frame;}};
  globalThis.location={origin:'https://nursememo.app'};
  const send=(data)=>windowListeners.get('message')({origin:EDITOR_ORIGIN,source:frame.contentWindow,data});
  let editor;
  try{
    editor=createPatrolDocumentEditor('#memoEditor');
    send({type:'document:ready'});
    await editor.ready();
    const docx=new Uint8Array(110);docx[0]=0x50;docx[1]=0x4b;
    const opened=editor.open(docx);
    await Promise.resolve();await Promise.resolve();
    assert.equal(sent.length,1);
    assert.equal(sent[0].message.type,'document:open-buffer');
    // Some editors post ready before the iframe's normal load event completes.
    // This event must not reject the still-pending DOCX request.
    frameListeners.get('load')?.();
    send({type:'document:opened',id:sent[0].message.id});
    await opened; // resolving (rather than rejecting) is the contract
    editor.setReadOnly(true);
    await Promise.resolve();
    assert.equal(classSet.has('docx-readonly'),true);
    assert.notEqual(frame.inert,true,'read-only documents must remain scrollable');
    assert.deepEqual(sent.at(-1).message.type,'document:set-readonly');
    assert.deepEqual(sent.at(-1).message.payload,{readonly:true},'remote editor must actually disable editing');
    const beforeTemporary=sent.length;
    editor.setReadOnly(true,{temporary:true});
    assert.equal(frame.inert,true,'temporary save lock must prevent interaction');
    editor.setReadOnly(false,{temporary:true});
    assert.equal(frame.inert,false,'temporary lock must release interaction');
    assert.equal(sent.length,beforeTemporary,'saving must not send remote readonly (it blocks export)');
    editor.setReadOnly(false);
    await Promise.resolve();
    assert.deepEqual(sent.at(-1).message.payload,{readonly:false});
  }finally{
    editor?.destroy();
    globalThis.window=previous.window;globalThis.document=previous.document;globalThis.location=previous.location;
  }
});

test('Night Memo opens as a full-viewport workspace without blocking PDF modal',()=>{
  const css=src('css/patrol-document.css');
  const patrol=src('pages/patrol-page.js');
  const html=src('patrol.html');
  assert.match(css,/#editorArea\s*\{[\s\S]*?position:fixed/);
  assert.match(css,/height:100dvh/);
  assert.match(css,/z-index:900/);
  assert.match(css,/#memoEditor\s*\{[\s\S]*?height:100%/);
  assert.match(patrol,/setMemoEditorWorkspaceVisible\(true\)/);
  assert.match(patrol,/temporary: !enabled && state\.officialSaving/);
  assert.match(css,/max-height:none;/);
  assert.match(patrol,/setMemoEditorWorkspaceVisible\(false\)/);
  assert.match(patrol,/state\.historyMode = true;\s*setMemoEditorWorkspaceVisible\(false\)/);
  assert.match(html,/id="memoEditorStatus"/);
  assert.doesNotMatch(css,/\.docx-readonly\s*\{\s*pointer-events:none/);
});
