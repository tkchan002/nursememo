/** Fail CI if the combined Nurse Memo + editor Pages artifact is malformed. */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.env.RANUTS_DEPLOY_DIR || 'dist/office';
const files = [
  'index.html', 'editor.html', 'history.html', 'LICENSE', 'NOTICE',
  'sdkjs/common/wasm/x2t/x2t.wasm',
  'web-apps/apps/documenteditor/main/index.html',
  'editor/index.html', 'history/index.html',
  'nurse-memo-editor-build.json',
];
for (const file of files) {
  const path = join(root,file);
  if (!existsSync(path) || !statSync(path).isFile()) throw new Error(`Published site missing ${path}`);
}
for (const dir of ['sdkjs','web-apps','assets']) {
  const path = join(root,dir);
  if (!existsSync(path) || !statSync(path).isDirectory()) throw new Error(`Published editor missing ${path}`);
}
const meta = JSON.parse(readFileSync(join(root,'nurse-memo-editor-build.json'),'utf8'));
if (meta.packagingFix !== 'onlyoffice-nested-index-path-v2') {
  throw new Error('Editor lacks the validated ONLYOFFICE nested-index routing correction.');
}
if (!/^\/(?:[A-Za-z0-9_.~-]+\/)*office\/$/.test(meta.officeBase)) {
  throw new Error(`Invalid bundled Office base URL: ${meta.officeBase}`);
}
const wasm = readFileSync(join(root,'sdkjs/common/wasm/x2t/x2t.wasm'));
if (wasm.toString('hex',0,4) !== '0061736d') throw new Error('Published WASM converter invalid.');
const html = readFileSync(join(root,'editor.html'),'utf8');
if (!html.includes('assets/') && !html.includes('index-')) throw new Error('Editor HTML does not reference application scripts.');
const sdkApi = join(root,'web-apps/apps/api/documents/api.js');
if (existsSync(sdkApi)) {
  const text = readFileSync(sdkApi,'utf8');
  if (text.includes(`"${meta.officeBase}index.html"`) || text.includes(`'${meta.officeBase}index.html'`)) {
    throw new Error('ONLYOFFICE nested main/index.html suffix has been incorrectly rebased.');
  }
}
const adapter = readFileSync('editor/manager-ranuts.js','utf8');
if (!adapter.includes("new URL('../office/editor.html', import.meta.url)")) {
  throw new Error('Nurse Memo is not connected to its own bundled office/editor.html.');
}
if (adapter.includes('https://edit.chaxus.com/editor') || adapter.includes('nursememo-office/editor.html')) {
  throw new Error('Nurse Memo editor adapter must not depend on an external editor site.');
}
console.log(`Verified self-hosted Office at ${meta.officeBase}, fix ${meta.packagingFix}, converter ${(wasm.length/1024/1024).toFixed(1)} MiB`);
