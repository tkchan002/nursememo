/** Public ranuts/document embed protocol. This branch uses ONLY fictional demo data. */
import { assertDocxBytes } from '../documents/docx-bytes.js';
export const EDITOR_URL='https://edit.chaxus.com/editor';
export const EDITOR_ORIGIN=new URL(EDITOR_URL).origin;
const TIMEOUT_MS=120000;
const zipBuffer=bytes=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
export function createManagerDocumentEditor(selector,onChange=()=>{}, {readonly=false}={}) {
  const frame=document.querySelector(selector);
  if(!frame || frame.tagName!=='IFRAME')throw new Error('DOCX editor requires an iframe.');
  let ready=false, destroyed=false, current=null, count=0, readOnly=readonly;
  let readyResolve,readyReject;
  const readyPromise=new Promise((res,rej)=>{readyResolve=res;readyReject=rej;});
  const readyTimer=setTimeout(()=>readyReject(new Error('Word processor did not signal ready. Check edit.chaxus.com availability.')),45000);
  function fail(error) {
    if(current){const request=current;current=null;clearTimeout(request.timer);request.reject(error instanceof Error?error:new Error(String(error)));}
  }
  function onMessage(event) {
    if(destroyed||event.origin!==EDITOR_ORIGIN||event.source!==frame.contentWindow||!event.data?.type?.startsWith('document:'))return;
    const {type,id,payload={}}=event.data;
    if(type==='document:ready'){ready=true;clearTimeout(readyTimer);readyResolve();return;}
    if(type==='document:dirty-changed'){if(payload.dirty && !readOnly)onChange();return;}
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

  frame.addEventListener('load',()=>{if(ready){ready=false;fail(new Error('Document editor reloaded during an operation.'));}});
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
    setReadOnly(disabled){readOnly=Boolean(disabled);frame.inert=readOnly;frame.classList.toggle('docx-readonly',readOnly);},
    async isDirty(){return Boolean((await request('document:get-state')).dirty);},
    destroy(){destroyed=true;clearTimeout(readyTimer);fail(new Error('Editor closed.'));window.removeEventListener('message',onMessage);frame.removeAttribute('src');},
  };
}
