import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

const read = (file) => readFile(path.join(root, file), 'utf8');

const patrolHtml = await read('patrol.html');
const patrolPage = await read('pages/patrol-page.js');
const wardInfoDomain = await read('domain/patrol-ward-information.js');

test('Patrol Ward Information uses separate source sections', () => {
  assert.match(patrolPage, /renderWardInfoSection\('Patient List'/);
  assert.match(patrolPage, /renderWardInfoSection\('Consultation'/);
  assert.match(patrolPage, /renderWardInfoSection\('Intubation'/);
  assert.match(patrolPage, /renderWardInfoSection\('Additional Report Items'/);

  assert.doesNotMatch(patrolHtml, /Clinical \/ General Information/);
});

test('Patrol Ward Information is backed by a dedicated domain model', () => {
  assert.match(patrolPage, /patrol-ward-information/);

  assert.match(wardInfoDomain, /patientList/);
  assert.match(wardInfoDomain, /consultations/);
  assert.match(wardInfoDomain, /intubations/);
  assert.match(wardInfoDomain, /additionalItems/);

  assert.doesNotMatch(wardInfoDomain, /clinicalInformation/);
  assert.doesNotMatch(wardInfoDomain, /generalInformation/);
});

test('Patrol page does not recreate Ward data as a combined narrative', () => {
  assert.doesNotMatch(patrolPage, /Clinical \/ General Information/);
  assert.doesNotMatch(patrolPage, /renderWardInfoSection\('Clinical \/ General Information'/);
  assert.doesNotMatch(patrolPage, /_legacyAdditional/);
  assert.match(patrolPage, /renderWardInfoSection\('Additional Report Items'/);
});

test('Ward Information remains read-only source data', () => {
  assert.doesNotMatch(patrolPage, /saveWardInformation/);
  assert.doesNotMatch(patrolPage, /updateWardInformation/);
});

test('Additional Report Items use report-time definitions', () => {
  assert.match(wardInfoDomain, /report_item_snapshot/);
});

test('only items in the additional section appear in Additional Report Items', async () => {
  const { buildPatrolWardInformation } = await import('../domain/patrol-ward-information.js');
  const ward = { id: 'ward-a', name: 'A' };
  const definitions = [
    { key: 'infection', label: 'Infection', section: 'infection', builtin: false },
    { key: 'devices', label: 'Device', section: 'devices', builtin: false },
    { key: 'notes', label: 'Custom notes', section: 'additional', builtin: false },
    { key: 'builtin', label: 'Built in', section: 'additional', builtin: true },
  ];
  const report = { payload: { dynamicItems: { infection: 'CRE', devices: 'MV', notes: 'Required', builtin: 'N/A' } }, report_item_snapshot: definitions };
  const [row] = buildPatrolWardInformation({ wards: [ward], bundle: [{ ward, report }] });
  assert.deepEqual(row.additionalItems.map(item => item.key), ['notes']);
});
