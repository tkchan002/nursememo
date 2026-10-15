import { readdir, readFile, access } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const ignored = new Set(['node_modules', '.git', 'dist']);
const files = [];
async function walk(directory) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    if (ignored.has(item.name)) continue;
    const full = path.join(directory, item.name);
    if (item.isDirectory()) await walk(full);
    else if (/\.(js|mjs|html)$/.test(item.name)) files.push(full);
  }
}
function relativeTargets(source) {
  const results = [];
  // Module imports may be static, side-effect-only, or dynamic string literals.
  const imports = /\b(?:import|export)\s*(?:\([^)]*\)|(?:[^;]*?\bfrom\s*)?['\"][^'\"]+['\"])/gs;
  for (const match of source.matchAll(imports)) {
    const literal = /['\"]([^'\"]+)['\"]\s*\)?\s*$/.exec(match[0]);
    if (literal?.[1].startsWith('.')) results.push(literal[1]);
  }
  for (const match of source.matchAll(/<script\b[^>]*\bsrc=['\"]([^'\"]+)['\"]/gi)) {
    if (match[1].startsWith('./')) results.push(match[1]);
  }
  return results;
}
await walk(root);
const errors = [];
for (const file of files) {
  if (path.relative(root, file).startsWith('tests' + path.sep)) continue; // Tests embed intentionally missing import paths as string fixtures.
  const source = await readFile(file, 'utf8');
  for (const target of relativeTargets(source)) {
    const dest = path.resolve(path.dirname(file), target.split(/[?#]/)[0]);
    try { await access(dest); }
    catch { errors.push(`${path.relative(root, file)} -> ${target}`); }
  }
}
if (errors.length) {
  console.error('Unresolved relative modules:\n' + errors.join('\n'));
  process.exit(1);
}
console.log(`Relative import check passed (${files.length} JS/MJS/HTML files).`);
