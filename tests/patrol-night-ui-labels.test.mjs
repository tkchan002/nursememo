import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { roleAccountLabel, roleDisplayName } from '../core/role-labels.js';

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('visible roles use Patrol Night while authorization retains the patrol identifier', () => {
  assert.equal(roleDisplayName('patrol'), 'Patrol Night');
  assert.equal(roleDisplayName('ward'), 'Ward');
  assert.equal(roleDisplayName('maintenance'), 'Maintenance');
  assert.equal(roleDisplayName('custom-role'), 'custom-role');
  const maintenance = read('maintenance.html');
  const maintenancePage = read('pages/maintenance-page.js');
  assert.match(maintenance, /<option value="patrol">Patrol Night<\/option>/);
  assert.match(maintenancePage, /esc\(roleDisplayName\(a\.role\)\)/);
  assert.doesNotMatch(maintenancePage, /esc\(a\.role\)/);
  assert.match(read('services/auth-service.js'), /roles.includes\(access.role\)/);
  assert.match(read('pages/patrol-page.js'), /requireRole\('patrol'\)/);
});

test('Patrol Night workspace HTML has no visible Patrol label, including accessibility text', () => {
  const page = read('patrol.html');
  assert.match(page, /<title>Nurse Memo \| Patrol Night<\/title>/);
  assert.match(page, /<th>Patrol Night document<\/th>/);
  assert.match(page, /aria-label="Nurse Memo Patrol Night workspaces"/);
  assert.doesNotMatch(page, />\s*Patrol\s*</i);
  assert.doesNotMatch(page, /\b(?:aria-label|title|placeholder)="[^"]*\bpatrol"/i);
  // These are internal DOM identifiers, NOT user-facing labels.
  assert.match(page, /data-patrol-tab="submission"/);
});

test('dashboard, Night Memo history and recoverable errors all use Patrol Night', () => {
  const page = read('pages/patrol-page.js');
  for (const label of [
    'Loading Patrol Night workspace…',
    'No Patrol Night draft',
    'Reload Patrol Night before saving or printing.',
    'Unable to load Patrol Night History:',
    'No Night Memos have been created in Patrol Night yet.',
    'Patrol Night workspace could not initialise:',
  ]) assert.ok(page.includes(label), `Missing Patrol Night label: ${label}`);
  assert.doesNotMatch(page, /No Patrol draft|Loading Patrol workspace|Reload Patrol before|Patrol History:|No Patrol Night Memos|Patrol workspace could not initialise/);
  // The user badge uses a role display label, without changing a person's name.
  const shell = read('components/app-shell.js');
  assert.match(shell, /roleAccountLabel\(access\)/);
  assert.equal(roleAccountLabel({ role: 'patrol', display_name: 'patrol' }), 'Patrol Night');
  assert.equal(roleAccountLabel({ role: 'patrol', display_name: 'Nurse Lee' }), 'Nurse Lee');
  assert.match(page, /roleAccountLabel\(state\.access/);
});

test('Ward prompts, demo-data tools, Maintenance and surfaced repository errors show Patrol Night', () => {
  const ward = read('pages/ward-page.js');
  const demo = read('pages/maintenance-test-data.js');
  const maintenance = read('maintenance.html');
  const repository = read('data/repositories/patrol-memo-repository.js');
  assert.match(ward, /NOT been submitted to Patrol Night/);
  assert.match(ward, /to Patrol Night\? Saved drafts/);
  assert.match(demo, /Patrol Night, Ward History and printing/);
  assert.match(maintenance, /so Patrol Night, Ward History/);
  assert.match(repository, /Invalid Patrol Night memo revision type/);
  for (const source of [ward, demo, maintenance, repository]) {
    assert.doesNotMatch(source, /(?:\bto Patrol(?! Night)\b|\bPatrol, Ward History\b|Invalid Patrol memo revision type|<option value="patrol">Patrol<\/option>)/);
  }
});
