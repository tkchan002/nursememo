/** Self-hosted ranuts/document embed protocol. Only fictional demo data is permitted. */
import { assertDocxBytes } from '../documents/docx-bytes.js';
export const EDITOR_URL = new URL('../office/editor.html', import.meta.url).href;
export const EDITOR_ORIGIN=new URL(EDITOR_URL).origin;
const TIMEOUT_MS=120000;
const zipBuffer=bytes=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
export function createManagerDocumentEditor(selector,onChange=()=>{}, {readonly=false,onNativeExport=()=>{}}={}) {
  const frame=document.querySelector(selector);
  if(!frame || frame.tagName!=='IFRAME')throw new Error('DOCX editor requires an iframe.');
  let ready=false, destroyed=false, current=null, count=0, readOnly=readonly;
  let readyResolve,readyReject;
  const readyPromise=new Promise((res,rej)=>{readyResolve=res;readyReject=rej;});
  const readyTimer=setTimeout(()=>readyReject(new Error('Word processor did not signal ready. Check the self-hosted editor deployment.')),45000);
  function fail(error) {
    if(current){const request=current;current=null;clearTimeout(request.timer);request.reject(error instanceof Error?error:new Error(String(error)));}
  }
  function onMessage(event) {
    if(destroyed||event.origin!==EDITOR_ORIGIN||event.source!==frame.contentWindow||!event.data?.type?.startsWith('document:'))return;
    const {type,id,payload={}}=event.data;
    if(type==='document:ready'){ready=true;clearTimeout(readyTimer);readyResolve();return;}
    if(type==='document:dirty-changed'){if(payload.dirty && !readOnly)onChange();return;}
    // An unsolicited export originates from ONLYOFFICE's own File > Download As
    // menu, not from an outstanding document:save request. Only our own iframe
    // on the expected origin may supply it (checked above).
    if(type==='document:exported'){
      if(!(payload?.file instanceof Blob))return;
      try { Promise.resolve(onNativeExport(payload.file)).catch(error=>console.error('Native document export failed:',error)); }
      catch(error) { console.error('Native document export failed:',error); }
      return;
    }
    if(!current || current.id!==id)return;
    const request=current;current=null;clearTimeout(request.timer);
    if(type==='document:error'){request.reject(new Error(payload.message||'Word processor reported an error.'));return;}
    if(request.type==='document:open-buffer' && type==='document:opened'){request.resolve(true);return;}
    if(request.type==='document:save' && type==='document:saved'){
      const blob=payload.file;
      if(!(blob instanceof Blob)){request.reject(new Error('Editor returned no document file.'));return;}
      request.resolve({blob,dirty:Boolean(payload.dirty)});if(payload.dirty && !readOnly)onChange();return;
    }
    if(request.type==='document:get-state' && type==='document:state'){request.resolve(payload);return;}
    request.reject(new Error(`Unexpected editor message: ${type}`));
  }
  window.addEventListener('message',onMessage);
  frame.src=`${EDITOR_URL}?embed=1&embedOrigin=${encodeURIComponent(location.origin)}&locale=en`;

  // A browser iframe load event is NOT evidence of a reload. The editor may send
  // document:ready before its initial load event. Rejecting a pending open here
  // caused a false failure even while the DOCX was visibly opening correctly.
  // Operation completion is confirmed only by a matching document:opened/saved
  // message; actual interruption is handled by the existing request timeout.
  async function request(type,payload={}){
    await readyPromise;
    if(destroyed)throw new Error('Editor was closed.');
    if(current)throw new Error('Editor is busy saving or opening another document.');
    return new Promise((resolve,reject)=>{
      const id=`nm-docx-${++count}`;
      const timer=setTimeout(()=>{if(current?.id===id)current=null;reject(new Error(`${type} timed out. Check editor connection.`));},TIMEOUT_MS);
      current={id,type,resolve,reject,timer};
      frame.contentWindow.postMessage({id,type,payload},EDITOR_ORIGIN);
    });
  }
  return {
    ready:()=>readyPromise,
    async open(bytes,{readonly:ro=readOnly}={}){assertDocxBytes(bytes);readOnly=ro;frame.classList.toggle('docx-readonly',ro);frame.setAttribute('aria-label',ro?'Historical Night Memo (read only)':'Night Memo DOCX editor');await request('document:open-buffer',{fileName:'Night-Memo.docx',buffer:zipBuffer(bytes),readonly:ro});},
    async export(format='DOCX') {
      if(!['DOCX','PDF'].includes(format))throw new Error('Unsupported document export format.');
      const {blob}=await request('document:save',{targetExt:format});
      const head=new Uint8Array(await blob.slice(0,5).arrayBuffer());
      if(format==='DOCX')return assertDocxBytes(new Uint8Array(await blob.arrayBuffer()));
      if(String.fromCharCode(...head)!=='%PDF-')throw new Error('Editor returned invalid PDF data.');
      return blob;
    },
    // A temporary interaction lock is used only while exporting/saving. Sending
    // document:set-readonly then would break document:save (the remote editor
    // intentionally rejects export in read-only mode). For History/conflicts we
    // instead use the editor's genuine read-only protocol, not a CSS disguise.
    setReadOnly(disabled,{temporary=false}={}) {
      if(temporary){frame.inert=Boolean(disabled);return;}
      frame.inert=false;
      readOnly=Boolean(disabled);
      frame.classList.toggle('docx-readonly',readOnly);
      readyPromise.then(()=>{
        if(destroyed)return;
        frame.contentWindow.postMessage({id:`nm-readonly-${++count}`,type:'document:set-readonly',payload:{readonly:readOnly}},EDITOR_ORIGIN);
      }).catch(()=>{});
    },
    async isDirty(){return Boolean((await request('document:get-state')).dirty);},
    destroy(){destroyed=true;clearTimeout(readyTimer);fail(new Error('Editor closed.'));window.removeEventListener('message',onMessage);frame.removeAttribute('src');},
  };
}
