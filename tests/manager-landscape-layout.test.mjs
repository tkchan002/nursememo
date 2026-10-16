import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderManagerMemoPrintHtml } from '../manager-memo-print.js';
import { renderNightRunnerPrintHtml } from '../night-roster-print.js';
const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('memo alone prints landscape; roster remains portrait', () => {
  const memo = renderManagerMemoPrintHtml({version:4, html:'<p>Test</p>'});
  const runner = renderNightRunnerPrintHtml({runners:[]});
  assert.match(memo, /@page\{size:A4 landscape/);
  assert.match(memo, /@media screen\{\.manager-print-page\{width:297mm/);
  assert.doesNotMatch(runner, /@page\{size:A4 landscape/);
  assert.match(runner, /@page\{size:A4 portrait/);
});

test('editor is auto-height with compact icon-based toolbar, not fixed-height split scrolling', () => {
  const js = read('editor/manager-jodit.js');
  const css = read('css/manager-document.css');
  const manager = read('manager.html');
  assert.match(js, /height: 'auto'/);
  assert.match(js, /textIcons: false/);
  assert.match(js, /extraIcons:/);
  assert.doesNotMatch(js, /'outdent'|'indent'|'hr'|'find'|'fullsize'/);
  assert.doesNotMatch(js, /height: 770|\\n.*['"]paragraph/);
  assert.match(css, /width:297mm!important/);
  assert.match(css, /min-height:210mm!important/);
  assert.match(css, /max-height:none/);
  assert.match(manager, /A4 landscape/);
  assert.doesNotMatch(manager, /Edit the entire document, including headings/);
});

test('table headers can wrap only at word boundaries and use landscape print styles', () => {
  const css = read('css/manager-document.css');
  const print = read('manager-document-print-css.js');
  assert.match(css, /font-size:9pt;table-layout:auto/);
  assert.match(css, /hyphens:none/);
  assert.match(print, /font-size:9pt;table-layout:auto/);
});
