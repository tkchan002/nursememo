/**
 * Stage a source-built ranuts/document site under the Nurse Memo Pages site.
 * GitHub Pages ignores Cloudflare's _headers; publish plain x2t.wasm instead of
 * pre-Brotli bytes which require Content-Encoding: br.
 *
 * This is a release-time path adaptation for Github PROJECT pages. The vendor
 * remains in its own /office subtree. Do not alter the embedded editor API.
 */
import { existsSync, promises as fs } from 'node:fs';
import { join, extname, relative, resolve } from 'node:path';
import { brotliDecompressSync } from 'node:zlib';

const source = resolve(process.env.RANUTS_DIST || '.upstream/ranuts-document/dist');
const destination = resolve(process.env.RANUTS_DEPLOY_DIR || 'dist/office');
const repository = (process.env.GITHUB_REPOSITORY || '').split('/')[1] || '';
const explicitBase = process.env.PAGES_BASE_PATH?.trim();
const siteBase = explicitBase === '/' ? '/' : explicitBase ? `/${explicitBase.replace(/^\/+|\/+$/g, '')}/` : repository ? `/${repository}/` : '/';
if (!/^\/(?:[a-zA-Z0-9_.~-]+\/)*$/.test(siteBase)) throw new Error(`Unsafe Pages base path: ${siteBase}`);
const officeBase = `${siteBase}office/`;
if (!existsSync(join(source, 'editor.html'))) throw new Error(`Upstream build lacks editor.html: ${source}`);
if (destination === source || destination.startsWith(`${source}/`)) throw new Error('Source and destination cannot overlap.');

await fs.rm(destination, { recursive: true, force: true });
await fs.cp(source, destination, { recursive: true, force: true });

// Most upstream root URLs are to public/vendor trees. Rebase those to our
// dedicated subtree, preventing requests that escape the project Pages URL.
const absolutePrefixes = [
  'sdkjs', 'web-apps', 'fonts', 'ran-fonts', 'ranui-iife', 'assets',
  'img', 'icons', 'models', 'wasm', 'content', 'packages', 'plugins',
];
const exactRoots = ['sw.js', 'manifest.json', 'home.css', 'landing.css', 'lang-switch.js',
  'sw-register.js', 'open-local.js', 'landing-prefetch.js', 'theme-presentation.js',
  'onlyoffice-v7-iframe-patch.js', 'ran-tokens.css', 'editor.html', 'history.html',
  'index.html'];
const matcher = /(^|["'`(=\s])\/(sdkjs|web-apps|fonts|ran-fonts|ranui-iife|assets|img|icons|models|wasm|content|packages|plugins)(?=\/|["'`?#\s])/gm;
const exactMatcher = /(^|["'`(=\s])\/(sw\.js|manifest\.json|home\.css|landing\.css|lang-switch\.js|sw-register\.js|open-local\.js|landing-prefetch\.js|theme-presentation\.js|onlyoffice-v7-iframe-patch\.js|ran-tokens\.css|editor\.html|history\.html|index\.html)(?=["'`?#\s]|$)/gm;
const routeMatcher = /(^|["'`(=\s])\/(editor|history)(?=["'`?#\s]|$)/gm;
const textExt = new Set(['.js','.mjs','.html','.css','.json','.xml','.svg','.txt','.webmanifest','.map','.ts']);
let files = 0, changed = 0, bytes = 0;
async function walk(root) {
  for (const entry of await fs.readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) { await walk(path); continue; }
    if (!entry.isFile()) continue;
    bytes += (await fs.stat(path)).size;
    if (!textExt.has(extname(entry.name)) || entry.name === 'LICENSE' || entry.name === 'NOTICE') continue;
    const original = await fs.readFile(path, 'utf8');
    let body = original
      .replace(matcher, (_m, before, rootName) => `${before}${officeBase}${rootName}`)
      .replace(exactMatcher, (_m, before, name) => `${before}${officeBase}${name}`)
      .replace(routeMatcher, (_m, before, route) => `${before}${officeBase}${route}.html`);
    // Vite's generated content-hashed token stylesheet needs the same path base.
    body = body.replace(/(["'`(=\s])\/ran-tokens\.([a-f0-9]+)\.css/g,
      (_m, before, hash) => `${before}${officeBase}ran-tokens.${hash}.css`);
    // The source is pre-compressed Brotli bytes and GitHub Pages does NOT
    // serve its Cloudflare Content-Encoding declaration. We ship a raw .wasm.
    body = body.replaceAll('x2t.wasm.br', 'x2t.wasm');
    if (body !== original) { await fs.writeFile(path, body); changed++; }
    files++;
  }
}
await walk(destination);
const wasmDir = join(destination, 'sdkjs/common/wasm/x2t');
const encoded = join(wasmDir, 'x2t.wasm.br');
const decoded = join(wasmDir, 'x2t.wasm');
if (existsSync(encoded)) {
  const raw = brotliDecompressSync(await fs.readFile(encoded));
  if (raw[0] !== 0 || raw[1] !== 97 || raw[2] !== 115 || raw[3] !== 109) throw new Error('Decoded converter is not WebAssembly.');
  await fs.writeFile(decoded, raw);
  await fs.unlink(encoded);
} else if (!existsSync(decoded)) {
  throw new Error('Neither x2t.wasm.br nor x2t.wasm was present in the upstream build.');
}
// Make a deployment mistake obvious: don't claim a self-hosted editor is ready
// unless its page, SDK, WASM and notices exist.
for (const required of ['editor.html','sdkjs','web-apps','LICENSE','NOTICE','sdkjs/common/wasm/x2t/x2t.wasm']) {
  if (!existsSync(join(destination, required))) throw new Error(`Missing self-hosted editor asset: ${required}`);
}
// GitHub Pages' Jekyll step must not discard our _ prefixed vendor assets.
await fs.writeFile(join(destination, '../.nojekyll'), '');
const meta = {
  siteBase, officeBase,
  sourceRevision: process.env.RANUTS_REVISION || 'local-build',
  sourceUrl: 'https://github.com/ranuts/document',
  licence: 'AGPL-3.0',
  description: 'Nurse Memo test branch: source-built self-hosted ranuts/document, adjusted for GitHub Pages project path.',
};
await fs.writeFile(join(destination, 'nurse-memo-editor-build.json'), JSON.stringify(meta, null, 2)+'\n');
const statWasm = await fs.stat(decoded);
let finalBytes = 0;
async function measure(d){for(const e of await fs.readdir(d,{withFileTypes:true})){const p=join(d,e.name);if(e.isDirectory())await measure(p);else if(e.isFile())finalBytes+=(await fs.stat(p)).size;}}
await measure(destination);
// GitHub Pages published site must remain below 1 GB. Leave headroom for
// Nurse Memo assets and GitHub Pages packaging, which is separately limited.
if(finalBytes > 900*1024*1024) throw new Error(`Editor too large for GitHub Pages: ${Math.ceil(finalBytes/1024/1024)} MiB`);
console.log(`Prepared ${relative(process.cwd(),destination)} for base ${officeBase}; ${changed}/${files} text assets rewritten; converter ${(statWasm.size/1024/1024).toFixed(1)} MiB, editor ${(finalBytes/1024/1024).toFixed(1)} MiB.`);
