import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { brotliCompressSync } from 'node:zlib';
const source=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');

test('Patrol Night remains the visible Manager name and starts the actual self-hosted editor',()=>{
  const html=source('manager.html');
  const adapter=source('editor/manager-ranuts.js');
  assert.match(html,/<title>[^<]*Patrol Night/i);
  assert.match(adapter,/new URL\('\.\.\/office\/editor\.html', import\.meta\.url\)/);
  assert.doesNotMatch(adapter,/edit\.chaxus\.com/);
  assert.match(adapter,/event\.origin!==EDITOR_ORIGIN/);
  assert.match(adapter,/event\.source!==frame\.contentWindow/);
});

test('Background preloading is after Manager authentication and reuses the same editor instance',()=>{
  const page=source('pages/manager-page.js');
  const afterAccess=page.indexOf('state.access = await requireRole(\'manager\')');
  const prewarm=page.indexOf('scheduleMemoEditorPreload();');
  assert.ok(afterAccess>0 && prewarm>afterAccess);
  assert.match(page,/function scheduleMemoEditorPreload\(\)[\s\S]*ensureMemoEditor\(\)/);
  assert.match(page,/if \(memoEditorInstance\) return memoEditorInstance/);
  assert.match(page,/if \(!memoEditorLoading\)/);
  assert.match(page,/Promise\.all\(\[/);
  assert.doesNotMatch(page,/Document editor ready/);
});

test('Night Memo shows a genuine loading overlay and retry action',()=>{
  const html=source('manager.html');
  const js=source('pages/manager-page.js');
  const css=source('css/manager-document.css');
  assert.match(html,/id="memoEditorLoading"/);
  assert.match(html,/id="memoEditorLoadingText"/);
  assert.match(html,/id="retryMemoEditorBtn"/);
  assert.match(js,/setMemoOpeningState\('Preparing document editor/);
  assert.match(js,/setMemoOpeningState\('Opening Night Memo/);
  assert.match(js,/clearMemoOpeningState\(\)/);
  assert.match(css,/memo-editor-loading\[hidden\]/);
  assert.match(css,/prefers-reduced-motion/);
});

test('Pages deployment builds upstream and rejects missing self-hosted assets',()=>{
  const workflow=source('.github/workflows/deploy-pages.yml');
  assert.match(workflow,/repository: ranuts\/document/);
  assert.match(workflow,/pnpm install --frozen-lockfile/);
  assert.match(workflow,/node scripts\/prepare-editor-site\.mjs/);
  assert.match(workflow,/node scripts\/verify-pages-editor\.mjs/);
  assert.match(workflow,/path: \.\/dist/);
  assert.doesNotMatch(workflow,/run: npm run verify \|\| true/);
});

test('GitHub Pages preparation rebases the upstream paths and decodes converter safely',()=>{
  const tmp=mkdtempSync(join(tmpdir(),'nurse-selfhost-'));
  const sourceDist=join(tmp,'vendor','dist');
  const published=join(tmp,'release','office');
  mkdirSync(join(sourceDist,'sdkjs','common','wasm','x2t'),{recursive:true});
  for (const sub of ['web-apps','assets']) mkdirSync(join(sourceDist,sub),{recursive:true});
  writeFileSync(join(sourceDist,'editor.html'),'<link href="/ran-fonts/fonts.css"><script src="/sdkjs/common.js"></script><a href="/editor">Edit</a><script src="./assets/editor-aa.js"></script>');
  writeFileSync(join(sourceDist,'assets/editor-aa.js'),`const sdk='/web-apps/apps/documenteditor';const other='/sw.js';`);
  writeFileSync(join(sourceDist,'LICENSE'),'AGPL test fixture');
  writeFileSync(join(sourceDist,'NOTICE'),'upstream notices test fixture');
  const raw=Buffer.from([0,97,115,109,1,0,0,0]);
  writeFileSync(join(sourceDist,'sdkjs/common/wasm/x2t/x2t.wasm.br'),brotliCompressSync(raw));
  writeFileSync(join(sourceDist,'sdkjs/common/wasm/x2t/x2t_helper.js'),`const wasm='/sdkjs/common/wasm/x2t/x2t.wasm.br';`);
  try{
    const result=spawnSync(process.execPath,['scripts/prepare-editor-site.mjs'],{
      cwd:new URL('..',import.meta.url),encoding:'utf8',env:{...process.env,RANUTS_DIST:sourceDist,RANUTS_DEPLOY_DIR:published,GITHUB_REPOSITORY:'owner/nurse-memo-demo',RANUTS_REVISION:'test-rev'},timeout:120000
    });
    assert.equal(result.status,0,result.stderr+' '+result.stdout);
    const html=readFileSync(join(published,'editor.html'),'utf8');
    assert.match(html,/\/nurse-memo-demo\/office\/sdkjs\/common\.js/);
    assert.match(html,/\/nurse-memo-demo\/office\/editor\.html/);
    assert.match(html,/\/nurse-memo-demo\/office\/ran-fonts\/fonts\.css/);
    const js=readFileSync(join(published,'assets/editor-aa.js'),'utf8');
    assert.match(js,/\/nurse-memo-demo\/office\/web-apps\/apps/);
    assert.match(js,/\/nurse-memo-demo\/office\/sw\.js/);
    const helper=readFileSync(join(published,'sdkjs/common/wasm/x2t/x2t_helper.js'),'utf8');
    assert.match(helper,/x2t\.wasm/);
    assert.doesNotMatch(helper,/x2t\.wasm\.br/);
    assert.deepEqual(readFileSync(join(published,'sdkjs/common/wasm/x2t/x2t.wasm')),raw);
    assert.ok(existsSync(join(published,'..','.nojekyll')));
    const meta=JSON.parse(readFileSync(join(published,'nurse-memo-editor-build.json'),'utf8'));
    assert.equal(meta.officeBase,'/nurse-memo-demo/office/');
  }finally{rmSync(tmp,{force:true,recursive:true});}
});
