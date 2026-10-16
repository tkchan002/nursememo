import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const theme = read('css/theme.css');

for (const [page, cssFile] of [
  ['index.html', 'login.css'],
  ['ward.html', 'ward.css'],
  ['manager.html', 'manager.css'],
  ['maintenance.html', 'maintenance.css'],
]) {
  test(`${page} loads one page stylesheet and the shared UI theme`, () => {
    const html = read(page);
    const base = `./css/${cssFile}`;
    const common = './css/theme.css';
    assert.equal(html.split(base).length, 2);
    assert.equal(html.split(common).length, 2);
    assert.ok(html.indexOf(base) < html.indexOf(common));
    assert.ok(html.indexOf(common) < html.indexOf('</head>'));
    assert.ok(read(`css/${cssFile}`).length > 200);
    assert.match(read(`css/${cssFile}`), /Page-specific clinical interface styling/);
  });
}

test('one neutral shared stylesheet owns screen tabs and buttons', () => {
  assert.match(theme, /^\/\*[\s\S]*?\*\/\s*@media screen/);
  assert.match(theme, /height:\s*24px/);
  assert.match(theme, /font:\s*700 11px\/15px Tahoma/);
  assert.match(theme, /--ui-tab-on:\s*linear-gradient/);
  assert.match(theme, /\.manager-primary-tab/);
  assert.match(theme, /\.hd-tab/);
  assert.match(theme, /border-radius:\s*15px/);
  assert.match(theme, /font:\s*700 14px\/18px Arial/);
  assert.match(theme, /#b8edfc/);
  assert.match(theme, /#submitBtn/);
  assert.doesNotMatch(read('css/ward-draft-submit.css'), /#submitBtn\s*\{/);
});

test('style resources have neutral filenames and all references resolve', () => {
  const cssFiles = new Set(readdirSync(new URL('../css/', import.meta.url)));
  const required = ['theme.css', 'ward.css', 'manager.css', 'maintenance.css', 'login.css'];
  required.forEach(name => assert.ok(cssFiles.has(name), `Missing ${name}`));
  const expectedCss = [
    'empty-bed-reporting.css', 'legacy-shell.css', 'login.css',
    'maintenance.css', 'manager-document.css', 'manager-night-operations.css', 'manager.css',
    'print-view.css', 'print.css', 'theme.css',
    'ward-draft-submit.css', 'ward.css',
  ];
  assert.deepEqual([...cssFiles].sort(), expectedCss.sort());
  for (const page of ['index.html','ward.html','manager.html','maintenance.html','print.html']) {
    const html = read(page);
    for (const [, resource] of html.matchAll(/href="\.\/css\/([^"]+\.css)"/g)) {
      assert.ok(cssFiles.has(resource), `${page} references missing ${resource}`);
    }
  }
});

test('Ward sections and functional entrypoints remain intact', () => {
  const html = read('ward.html');
  assert.equal((html.match(/data-main-tab="[0-5]"/g) ?? []).length, 6);
  for (const id of ['admissionEC_M', 'admissionEC_F', 'emptyDetailRows']) {
    assert.ok(html.includes(`id="${id}"`));
  }
  assert.match(html, /src="\.\/ward\.js"/);
  assert.match(html, /class="legacy-window-title no-print ward-window-title"/);
});

test('Manager workspaces and document editor remain intact', () => {
  const html = read('manager.html');
  assert.equal((html.match(/data-manager-tab="(?:submission|ward-info|memo|staffing)"/g) ?? []).length, 4);
  for (const id of ['memoEditor', 'saveMemoBtn']) assert.ok(html.includes(`id="${id}"`));
  assert.match(html, /src="\.\/manager\.js"/);
  assert.match(read('css/manager.css'), /\.memo-sheet \.official-table/);
});

test('Shared theme and merged page additions remain screen-only', () => {
  assert.match(theme, /@media screen\s*\{/);
  for (const cssFile of ['ward.css','manager.css','maintenance.css','login.css']) {
    assert.match(read(`css/${cssFile}`), /\/\* Page-specific clinical interface styling\. \*\/\s*@media screen\s*\{/);
  }
  assert.doesNotMatch(read('ward.html'), /prototype-tag|fake-user/);
});
