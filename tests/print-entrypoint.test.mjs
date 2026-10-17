import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (name) => readFile(path.join(root, name), 'utf8');

test('Ward, Patrol, and roster print actions import the real print service', async () => {
  for (const file of ['ward-print.js', 'pages/patrol-night-operations.js']) {
    const source = await read(file);
    assert.match(source, /import\s*\{\s*openPrintView\s*\}\s*from\s*['"][^'"]*print-job-service\.js['"]/);
  }
  const ward = await read('pages/ward-page.js');
  assert.match(ward, /mod\.printWardMemo\(/);
  assert.doesNotMatch(ward, /openPrintView\(/);
  const patrol=await read('pages/patrol-page.js');
  assert.match(patrol,/memoEditorInstance\.export\('PDF'\)/);
  assert.doesNotMatch(patrol,/openPrintView\(\{ html: renderPatrolMemoPrintHtml/);
  const service = await read('services/print-job-service.js');
  assert.match(service, /export function openPrintView\(/);
  assert.match(service, /locationObject\.assign\(target\.href\)/);
  assert.match(service, /storage\.setItem\(/);
  assert.doesNotMatch(service, /Promise\.resolve\(\{\s*html\s*,\s*title\s*,\s*kind\s*\}\)/);
});

test('print viewer and stylesheet are present and Vite emits print.html as a site entry', async () => {
  const config = await read('vite.config.js');
  assert.match(config, /print:\s*['"]print\.html['"]/);
  const viewer = await read('print.html');
  assert.match(viewer, /<script type="module" src="\.\/print\.js"><\/script>/);
  assert.match(viewer, /href="\.\/css\/print-view\.css"/);
  const viewerScript = await read('print.js');
  assert.match(viewerScript, /readPrintJob\(jobId\)/);
  assert.match(viewerScript, /window\.print\(\)/);
  assert.match(viewerScript, /deletePrintJob\(printJob\.id\)/);
  await stat(path.join(root, 'css/print-view.css'));
});
