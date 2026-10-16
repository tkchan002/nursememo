/**
 * Nurse Memo integration for the ranuts/document build pinned in deploy-pages.yml.
 *
 * In upstream lib/onlyoffice/save-stream.ts, a native File > Download As export
 * arrives as a File but is deliberately discarded in embed mode unless it was
 * initiated through document:save. Forward ONLY these unsolicited native exports
 * to the explicitly configured embedding origin. Programmatic document:save
 * continues through upstream's existing request/response protocol unchanged.
 *
 * Fail closed on upstream changes: NEVER silently ship a partially patched editor.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const root = resolve(process.env.RANUTS_SOURCE_DIR || '.upstream/ranuts-document');
const filename = join(root, 'lib/onlyoffice/save-stream.ts');
const source = await readFile(filename, 'utf8');
const original = /if \(isEmbedMode\(\)\) \{\s*console\.warn\('Local save is disabled in iframe embed mode\. Use document:save from the parent page\.'\);\s*return;\s*\}/g;
const matches = [...source.matchAll(original)];
if (matches.length !== 1) {
  throw new Error(`Expected exactly one pinned ranuts embedded native-export drop point, found ${matches.length}: ${filename}`);
}
const replacement = `if (isEmbedMode()) {
    // Nurse Memo: native File > Download As has no embed-API request id.
    // Explicit document:save requests were resolved and returned above.
    // Give this independently exported File to the authorized host instead
    // of silently dropping it. Never send bytes to a wildcard origin.
    const hostOrigin = new URLSearchParams(window.location.search).get('embedOrigin');
    if (hostOrigin && /^https?:\\/\\/[^/?#]+$/.test(hostOrigin)) {
      window.parent.postMessage(
        { type: 'document:exported', payload: { file, fileName: file.name } },
        hostOrigin,
      );
    } else {
      console.warn('Native document export requires an explicit embedOrigin.');
    }
    return;
  }`;
const patched = source.replace(original, replacement);
if (patched === source || !patched.includes("type: 'document:exported'")) throw new Error('Native-export patch did not apply.');
await writeFile(filename, patched);
console.log('Patched pinned ranuts native document exports for the Nurse Memo embed host.');
