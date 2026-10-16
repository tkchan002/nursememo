import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('Get Data dialog uses shared clinical frame while retaining working Ward action IDs', () => {
  const html = read('ward.html');
  for (const [id, klass] of [
    ['gdOverlay', 'ui-dialog-overlay'],
    ['gdModal', 'ui-dialog'],
    ['gdTitleBar', 'ui-dialog__titlebar'],
    ['gdBody', 'ui-dialog__body'],
    ['gdFooter', 'ui-dialog__footer'],
    ['gdCloseBtn', 'ui-dialog__close'],
  ]) {
    assert.match(html, new RegExp(`id="${id}"[^>]*class="${klass}"|class="${klass}"[^>]*id="${id}"`));
  }
  for (const id of ['gdSectionHdr', 'gdNoHistory', 'gdTable', 'gdTbody', 'gdFooterMsg', 'gdConfirmBtn']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /id="gdModal"[^>]*aria-modal="true"/);
  assert.match(html, /data-ward-action="gdClose"/);
  assert.match(html, /data-ward-action="gdConfirm"/);
  const js = read('pages/ward-page.js');
  assert.match(js, /function gdConfirm\(\)/);
  assert.match(js, /function gdClose\(\)/);
  assert.match(js, /state\.gdTab = tab/);
});

test('Get Data uses the shared dialog shell and page-specific content styling', () => {
  const shared = read('css/theme.css');
  const ward = read('css/ward.css');
  assert.match(shared, /\.ui-dialog-overlay\.show\s*\{display:\s*flex\}/);
  assert.match(shared, /\.ui-dialog__titlebar\s*\{/);
  assert.match(shared, /\.ui-dialog__footer\s*\{/);
  assert.match(shared, /\.ui-dialog__close/);
  assert.match(ward, /\.ward-page \.gd-section-hdr\s*\{/);
  assert.match(ward, /\.ward-page #gdNoHistory\.show\s*\{display:\s*block\}/);
  assert.match(ward, /\.ward-page #gdTable tbody td\.gd-nil/);
});

test('Login ID no longer shows an example such as C10 without altering demo defaults', () => {
  const html = read('index.html');
  const js = read('pages/login-page.js');
  assert.doesNotMatch(html, /id="loginId"[^>]*placeholder=/);
  assert.doesNotMatch(js, /loginId'\)\.placeholder\s*=/);
  assert.doesNotMatch(js, /e\.g\. C10/i);
  assert.match(js, /ward:\s*'C10'/); // Demo autofill is separate from input hint text.
});
