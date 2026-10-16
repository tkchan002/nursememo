/** Fail CI when the actual published self-hosted editor is missing or malformed. */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
const root = process.env.RANUTS_DEPLOY_DIR || 'dist/office';
const files = ['editor.html', 'LICENSE', 'NOTICE', 'sdkjs/common/wasm/x2t/x2t.wasm', 'nurse-memo-editor-build.json'];
for(const file of files) {
  const path=join(root,file);
  if(!existsSync(path) || !statSync(path).isFile()) throw new Error(`Published site is missing ${path}`);
}
for(const folder of ['sdkjs', 'web-apps', 'assets']) {
  const path=join(root,folder);
  if(!existsSync(path)||!statSync(path).isDirectory()) throw new Error(`Published editor missing ${path}`);
}
const meta=JSON.parse(readFileSync(join(root,'nurse-memo-editor-build.json'),'utf8'));
const wasm=readFileSync(join(root,'sdkjs/common/wasm/x2t/x2t.wasm'));
if(wasm.toString('hex',0,4)!=='0061736d')throw new Error('Published WebAssembly converter is invalid.');
const html=readFileSync(join(root,'editor.html'),'utf8');
if(!html.includes('assets/') && !html.includes('index-')) throw new Error('No script assets found in editor HTML.');
if(html.includes('https://edit.chaxus.com/editor')) throw new Error('Editor still points to upstream hosting.');
const ownEditor=readFileSync('editor/manager-ranuts.js','utf8');
if(ownEditor.includes("export const EDITOR_URL='https://edit.chaxus.com")) throw new Error('Host adapter still points to external editor.');
console.log(`Verified project-site editor at ${meta.officeBase} (${meta.sourceRevision}), WASM ${(wasm.byteLength/1024/1024).toFixed(1)} MiB`);
