import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = relativePath => readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');

for (const page of ['index.html', 'ward.html', 'manager.html', 'maintenance.html', 'print.html']) {
  test(`${page} contains no inline presentation or event attributes`, () => {
    const html = read(page);
    assert.doesNotMatch(html, /\sstyle\s*=/i);
    assert.doesNotMatch(html, /\son(?:click|input|change|submit|load|keydown)\s*=/i);
  });
}

test('Ward commands are declarative and bound once through the page module', () => {
  const html = read('ward.html');
  const js = read('pages/ward-page.js');
  for (const action of ['saveEntry', 'submitEntry', 'toggleHistory', 'toggleStaffList', 'gdConfirm', 'gdClose', 'addEmptyDetail', 'addEB', 'addNR', 'getDataForTab', 'openPdfSettings', 'resetPdfSettings']) {
    assert.ok(html.includes(`data-ward-action="${action}"`), `Missing Ward command ${action}`);
    assert.ok(js.includes(action), `Unbound Ward action ${action}`);
  }
  assert.equal((html.match(/data-ward-tab-index="[1-5]"/g) || []).length, 5);
  assert.equal((html.match(/data-ward-change="updatePdfPreviewDebounced"/g) || []).length, 17);
  assert.match(js, /function bindWardActions\(\)/);
  assert.doesNotMatch(js, /Object\.assign\(window,|\.on(?:click|change|input)\s*=|style="/);
  assert.doesNotMatch(js, /\.style\.display\s*=/);
});

test('Other screens use registered event listeners instead of overwriting event properties', () => {
  for (const file of ['pages/login-page.js', 'pages/manager-page.js', 'pages/maintenance-page.js', 'pages/maintenance-test-data.js']) {
    assert.doesNotMatch(read(file), /\.on(?:click|change|input|submit)\s*=/, `${file} contains an event-property assignment`);
    assert.match(read(file), /\.addEventListener\(/);
  }
});

test('Dynamic Ward rows and maintenance accounts use named presentation classes', () => {
  const ward = read('pages/ward-page.js');
  const maintenance = read('pages/maintenance-page.js');
  const wardStyles = read('css/paf-ward.css');
  assert.match(ward, /row\.className = 'fr early-bird-row'/);
  assert.match(ward, /class="ward-history-nurse-row"/);
  assert.match(ward, /data-dev-count-wrap hidden/);
  assert.match(ward, /data-dev-count-wrap.*hidden/s);
  assert.match(maintenance, /class="muted account-auth-email"/);
  for (const variant of ['.dev-tog-btn.active', '.btn-x', '.ro-tbl', '#gdTable', '.ward-history-heading']) {
    assert.ok(wardStyles.includes(variant), `${variant} needs shared PAF ownership`);
  }
});

test('PAF design controls login and print chrome without modifying report formatting', () => {
  assert.match(read('index.html'), /css\/paf-login\.css/);
  assert.match(read('css/paf-login.css'), /login-role-card/);
  assert.match(read('css/print-view.css'), /\.print-view-toolbar \.print-view-button:hover/);
  assert.doesNotMatch(read('print.js'), /installShellOverrides|style\.textContent/);
  assert.match(read('css/paf-manager.css'), /\.formatting-tools button:active/);
  assert.match(read('css/paf-design-system.css'), /font:\s*700 11px\/15px Tahoma/);
});
