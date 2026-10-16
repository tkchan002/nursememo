import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const shared = read('css/paf-design-system.css');

for (const [page, stylesheet] of [
  ['ward.html', 'paf-ward.css'],
  ['manager.html', 'paf-manager.css'],
  ['maintenance.html', 'paf-maintenance.css'],
]) {
  test(`${page} includes shared PAF design after its existing styles`, () => {
    const html = read(page);
    const sharedLink = './css/paf-design-system.css';
    const localLink = `./css/${stylesheet}`;
    assert.equal(html.split(sharedLink).length, 2);
    assert.equal(html.split(localLink).length, 2);
    assert.ok(html.indexOf(sharedLink) < html.indexOf(localLink));
    assert.ok(html.indexOf(localLink) < html.indexOf('</head>'));
    assert.ok(read(`css/${stylesheet}`).length > 200);
  });
}

test('PAF tabs use one shared 24px, 11px dark-text component', () => {
  assert.match(shared, /height:\s*24px/);
  assert.match(shared, /font:\s*700 11px\/15px Tahoma/);
  assert.match(shared, /--paf-tab-on:\s*linear-gradient/);
  assert.match(shared, /\.manager-primary-tab/);
  assert.match(shared, /\.hd-tab/);
});

test('PAF clinical command buttons use rounded neutral CUI styling', () => {
  assert.match(shared, /border-radius:\s*15px/);
  assert.match(shared, /font:\s*700 14px\/18px Arial/);
  assert.match(shared, /#b8edfc/);
  assert.match(shared, /#submitBtn/);
  assert.doesNotMatch(read('css/ward-draft-submit.css'), /#submitBtn\s*\{/);
});

test('the real six Ward sections and reporting entrypoints are still present', () => {
  const html = read('ward.html');
  assert.equal((html.match(/data-main-tab="[0-5]"/g) ?? []).length, 6);
  assert.match(html, /id="admissionEC_M"/);
  assert.match(html, /id="admissionEC_F"/);
  assert.match(html, /id="emptyDetailRows"/);
  assert.match(html, /src="\.\/ward\.js"/);
  assert.match(html, /class="legacy-window-title no-print ward-window-title"/);
});

test('the real four Manager workspaces and document editor remain intact', () => {
  const html = read('manager.html');
  assert.equal((html.match(/data-manager-tab="(?:submission|ward-info|memo|staffing)"/g) ?? []).length, 4);
  assert.match(html, /id="memoEditor"/);
  assert.match(html, /id="saveMemoBtn"/);
  assert.match(html, /src="\.\/manager\.js"/);
  assert.match(read('css/paf-manager.css'), /\.memo-sheet \.official-table/);
});

test('PAF visual layers apply only to screen media, preserving print CSS', () => {
  for (const stylesheet of ['paf-design-system.css', 'paf-ward.css', 'paf-manager.css', 'paf-maintenance.css']) {
    assert.match(read(`css/${stylesheet}`), /^\s*(?:\/\*[\s\S]*?\*\/\s*)?@media screen\s*\{/);
  }
  assert.doesNotMatch(read('ward.html'), /prototype-tag|fake-user/);
});
