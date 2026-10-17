import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { brotliCompressSync, gunzipSync } from 'node:zlib';
import { runInNewContext } from 'node:vm';
const source=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');

test('Patrol Night remains the visible Patrol name and starts the actual self-hosted editor',()=>{
  const html=source('patrol.html');
  const adapter=source('editor/patrol-ranuts.js');
  assert.match(html,/<title>[^<]*Patrol Night/i);
  assert.match(adapter,/new URL\('\.\.\/office\/editor\.html', import\.meta\.url\)/);
  assert.doesNotMatch(adapter,/edit\.chaxus\.com/);
  assert.match(adapter,/event\.origin!==EDITOR_ORIGIN/);
  assert.match(adapter,/event\.source!==frame\.contentWindow/);
});

test('Background preloading is after Patrol authentication and reuses the same editor instance',()=>{
  const page=source('pages/patrol-page.js');
  const afterAccess=page.indexOf('state.access = await requireRole(\'patrol\')');
  const prewarm=page.indexOf('scheduleMemoEditorPreload();');
  assert.ok(afterAccess>0 && prewarm>afterAccess);
  assert.match(page,/function scheduleMemoEditorPreload\(\)[\s\S]*ensureMemoEditor\(\)/);
  assert.match(page,/if \(memoEditorInstance\) return memoEditorInstance/);
  assert.match(page,/if \(!memoEditorLoading\)/);
  assert.match(page,/Promise\.all\(\[/);
  assert.doesNotMatch(page,/Document editor ready/);
});

test('Night Memo shows a genuine loading overlay and retry action',()=>{
  const html=source('patrol.html');
  const js=source('pages/patrol-page.js');
  const css=source('css/patrol-document.css');
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

test('Pages preparation preserves the ONLYOFFICE nested-index suffix and rewrites only site roots',async()=>{
  const tmp=mkdtempSync(join(tmpdir(),'nurse-selfhost-'));
  const sourceDist=join(tmp,'vendor','dist');
  const published=join(tmp,'release','office');
  mkdirSync(join(sourceDist,'sdkjs/common/wasm/x2t'),{recursive:true});
  mkdirSync(join(sourceDist,'web-apps/apps/api/documents'),{recursive:true});
  mkdirSync(join(sourceDist,'web-apps/apps/documenteditor/main'),{recursive:true});
  mkdirSync(join(sourceDist,'assets'),{recursive:true});
  for(const name of ['index.html','editor.html','history.html']) {
    writeFileSync(join(sourceDist,name),
      '<link href="/ran-fonts/fonts.css"><script src="/sdkjs/common.js"></script>'+ 
      '<a href="/editor">Edit</a><a href="/index.html">Home</a><script src="./assets/editor-aa.js"></script>');
  }
  writeFileSync(join(sourceDist,'web-apps/apps/documenteditor/main/index.html'),'<title>ONLYOFFICE editing frame</title>');
  writeFileSync(join(sourceDist,'web-apps/apps/api/documents/api.js'),
    'function editorFrame(path){ var suffix="/index.html"; return path+suffix; }');
  writeFileSync(join(sourceDist,'assets/editor-aa.js'),
    `const sdk='/web-apps/apps/documenteditor';const other='/sw.js';`);
  writeFileSync(join(sourceDist,'LICENSE'),'AGPL test fixture');
  writeFileSync(join(sourceDist,'NOTICE'),'upstream notices test fixture');
  const raw=Buffer.from([0,97,115,109,1,0,0,0]);
  writeFileSync(join(sourceDist,'sdkjs/common/wasm/x2t/x2t.wasm.br'),brotliCompressSync(raw));
  writeFileSync(join(sourceDist,'sdkjs/common/wasm/x2t/x2t_helper.js'),
    `function X2TConverter(){this.WASM_PATH = '../../../../sdkjs/common/wasm/x2t/x2t.wasm.br';}
X2TConverter.prototype.fetchWasmResponse=function(){var wasmPath = this.WASM_PATH;return fetch(wasmPath).then(function(response){if (response.ok) return response;throw new Error('bad status');});};`);
  try {
    for (const [siteBase, baseVar] of [['/nursememo/',''], ['/','/']]) {
      const result=spawnSync(process.execPath,['scripts/prepare-editor-site.mjs'],{
        cwd:new URL('..',import.meta.url),encoding:'utf8',
        env:{...process.env,RANUTS_DIST:sourceDist,RANUTS_DEPLOY_DIR:published,
          GITHUB_REPOSITORY:'tkchan002/nursememo',PAGES_BASE_PATH:baseVar,RANUTS_REVISION:'beb7-test'},
        timeout:120000
      });
      assert.equal(result.status,0, result.stderr+' '+result.stdout);
      const officeBase=siteBase+'office/';
      const html=readFileSync(join(published,'editor.html'),'utf8');
      assert.match(html,new RegExp(officeBase.replaceAll('/','\\/')+'sdkjs\\/common\\.js'));
      assert.ok(html.includes(`${officeBase}editor.html`));
      assert.ok(html.includes(`${officeBase}index.html`), 'top-level home link rebased');
      assert.ok(html.includes(`${officeBase}ran-fonts/fonts.css`));
      const js=readFileSync(join(published,'assets/editor-aa.js'),'utf8');
      assert.ok(js.includes(`${officeBase}web-apps/apps`));
      assert.ok(js.includes(`${officeBase}sw.js`));
      const api=readFileSync(join(published,'web-apps/apps/api/documents/api.js'),'utf8');
      assert.ok(api.includes('suffix="/index.html"'), 'ONLYOFFICE nested filename suffix is not rebased');
      assert.ok(!api.includes(`${officeBase}index.html`), 'regression: nested editor frame URL must not be corrupted');
      assert.ok(existsSync(join(published,'web-apps/apps/documenteditor/main/index.html')));
      assert.ok(existsSync(join(published,'editor/index.html')));
      assert.ok(existsSync(join(published,'history/index.html')));
      const alias=readFileSync(join(published,'editor/index.html'),'utf8');
      assert.match(alias,/location\.search\+location\.hash/);
      const helper=readFileSync(join(published,'sdkjs/common/wasm/x2t/x2t_helper.js'),'utf8');
      assert.ok(helper.includes('x2t.wasm'));
      assert.ok(!helper.includes('x2t.wasm.br'));
      assert.deepEqual(readFileSync(join(published,'sdkjs/common/wasm/x2t/x2t.wasm')),raw);
      assert.deepEqual(gunzipSync(readFileSync(join(published,'sdkjs/common/wasm/x2t/x2t.wasm.gz'))),raw);
      assert.match(helper,/new DecompressionStream\('gzip'\)/);
      assert.match(helper,/WASM_GZIP_PATH/);
      assert.match(helper,/pipeThrough/);
      // Exercise the actual patched fetch path: the browser must receive the
      // ORIGINAL WASM bytes after native streaming decompression, and old
      // browsers must still fetch the unchanged raw file.
      for (const supportsGzip of [true, false]) {
        const requested = [];
        const X2TConverter = runInNewContext(`${helper}\nX2TConverter;`, {
          Response,
          DecompressionStream: supportsGzip ? DecompressionStream : undefined,
          fetch: async url => {
            requested.push(url);
            return new Response(url.endsWith('.gz') ?
              readFileSync(join(published,'sdkjs/common/wasm/x2t/x2t.wasm.gz')) : raw,
              { status: 200 });
          },
        });
        const response = await new X2TConverter().fetchWasmResponse();
        assert.deepEqual(Buffer.from(await response.arrayBuffer()),raw);
        assert.equal(requested.length,1);
        assert.ok(requested[0].endsWith(supportsGzip ? '.wasm.gz' : '.wasm'));
      }
      assert.ok(existsSync(join(published,'..','.nojekyll')));
      const meta=JSON.parse(readFileSync(join(published,'nurse-memo-editor-build.json'),'utf8'));
      assert.equal(meta.officeBase,officeBase);
      assert.equal(meta.packagingFix,'onlyoffice-nested-index-path-v2');
      const check=spawnSync(process.execPath,['scripts/verify-pages-editor.mjs'],{
        cwd:new URL('..',import.meta.url),encoding:'utf8',
        env:{...process.env,RANUTS_DEPLOY_DIR:published},timeout:120000
      });
      assert.equal(check.status,0,check.stderr+' '+check.stdout);
    }
  } finally { rmSync(tmp,{force:true,recursive:true}); }
});

test('CI pins the successfully tested upstream build and retains one combined site',()=>{
  const workflow=source('.github/workflows/deploy-pages.yml');
  assert.match(workflow,/beb7e2fd6c2eada4c4ff21e94ac37d5c39a79fc0/);
  assert.match(workflow,/path: \.\/dist/);
  assert.match(workflow,/node scripts\/verify-pages-editor\.mjs/);
  const adapter=source('editor/patrol-ranuts.js');
  assert.doesNotMatch(adapter,/nursememo-office/);
});


test('Background conversion keeps a single real-size editor and does not race foreground open', () => {
  const page=source('pages/patrol-page.js');
  const css=source('css/patrol-document.css');
  assert.match(page,/document\.body\.appendChild\(area\)/);
  assert.ok(page.indexOf('setMemoEditorWorkspaceVisible(false);') < page.indexOf('scheduleMemoEditorPreload();'), 'move the iframe container BEFORE setting its source');
  assert.match(page,/area\.inert = true/);
  assert.match(page,/memoPrewarmPromise = \(async \(\) =>/);
  assert.match(page,/memoPrewarmed = \{ key, editor, bytes \}/);
  assert.match(page,/if \(memoPrewarmPromise\) await memoPrewarmPromise/);
  assert.match(page,/memoPrewarmed\?\.editor !== editor \|\| memoPrewarmed\.key !== desiredKey/);
  assert.match(page,/memoPrewarmed = null/);
  assert.match(css,/\.memo-editor-background\s*\{\s*opacity:0;\s*pointer-events:none;/);
  assert.doesNotMatch(page,/new Worker\(/);
});
