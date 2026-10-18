import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { fullReportPayloadDefaults } from '../domain/report-model.js';

const page = await readFile(new URL('../pages/ward-page.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../ward.html', import.meta.url), 'utf8');

function makeResetScenario({ confirmed = true, overrides = {} } = {}) {
  const state = {
    loadedDate: '2026-10-18', memoType: 'night', operational: true,
    loading: false, saving: false, submitting: false, historyMode: false, staffMode: false,
    editVersion: 3, dirty: false, draft: { id: 'stored-draft' }, report: { id: 'stored-report' },
    ...overrides,
  };
  const dateInput = { value: '2026-10-18' };
  const events = [];
  const source = page.slice(page.indexOf('function resetForm()'), page.indexOf('function collectTableRows(tbody, count)'));
  assert.ok(source.startsWith('function resetForm()'));
  const reset = vm.runInNewContext(`${source}\nresetForm`, {
    state,
    $: selector => selector === '#memoDate' ? dateInput : null,
    showStatus: (type, message) => events.push(['status', type, message]),
    confirm: message => { events.push(['confirm', message]); return confirmed; },
    fillPayload: payload => { events.push(['fill', payload]); state.dirty = false; },
    markDirty: () => { events.push(['dirty']); state.dirty = true; state.editVersion += 1; },
    fullReportPayloadDefaults,
    MEMO_LABELS: { night: 'Night Memo', pm: 'PM Memo' },
    toDisplayDate: date => date,
  });
  return { reset, state, events, dateInput };
}

test('Reset Form action replaces reload, leaving PDF settings reset separate', () => {
  assert.match(html, /data-ward-action="resetForm">Reset Form<\/button>/);
  assert.doesNotMatch(html, /data-ward-action="reload"/);
  assert.match(page, /toggleHistory, toggleStaffList, histReprint, histDeleteCurrent, resumeHistoryDraft,\s*resetForm,/);
  assert.doesNotMatch(page, /reload:\s*\(\)\s*=>\s*location\.reload/);
  assert.match(html, /data-ward-action="resetPdfSettings"/);
});

test('Confirmed reset starts a clean unsaved form but preserves the reporting cycle and stored metadata', () => {
  const { reset, state, events, dateInput } = makeResetScenario();
  reset();
  assert.deepEqual(events.map(e => e[0]), ['confirm', 'fill', 'dirty', 'status']);
  const defaults = events.find(e => e[0] === 'fill')[1];
  assert.equal(defaults.nilSpecial, false);
  assert.equal(defaults.nilConsultation, false);
  assert.equal(defaults.nilIntubation, false);
  assert.deepEqual(defaults.nurses, []);
  assert.deepEqual(defaults.earlyBirds, []);
  assert.deepEqual(defaults.patients, []);
  assert.deepEqual(defaults.infBeds, {});
  assert.deepEqual(defaults.devBeds, {});
  assert.equal(defaults.totalPatientM, '0');
  assert.equal(state.dirty, true);
  assert.equal(state.editVersion, 4);
  assert.equal(state.memoType, 'night');
  assert.equal(state.loadedDate, '2026-10-18');
  assert.equal(dateInput.value, '2026-10-18');
  assert.equal(state.draft.id, 'stored-draft');
  assert.equal(state.report.id, 'stored-report');
  assert.match(events.at(-1)[2], /not saved/i);
});

test('Cancel keeps all existing form fields and status untouched', () => {
  const { reset, events, state } = makeResetScenario({ confirmed: false });
  reset();
  assert.deepEqual(events.map(e => e[0]), ['confirm']);
  assert.equal(state.dirty, false);
  assert.equal(state.editVersion, 3);
});

test('Reset cannot run during save, submit, loading or outside a loaded operational form', () => {
  for (const patch of [{ saving: true }, { submitting: true }, { loading: true }, { historyMode: true }, { staffMode: true }, { operational: false }, { loadedDate: null }]) {
    const { reset, events } = makeResetScenario({ overrides: patch });
    reset();
    assert.deepEqual(events.map(e => e[0]), ['status'], JSON.stringify(patch));
  }
});

test('Resetting device values does not retain hidden previous bed or count selections', () => {
  assert.match(page, /function setDeviceValue\(key, value\)[^\n]+\[data-dev-count\][^\n]+device\.mode === 'count' \? device\.count : 0/);
  assert.match(page, /function setDeviceValue\(key, value\)[^\n]+setBeds\(`\$\{key\}__beds`, device\.mode === 'beds' \? device\.beds : \[\]\)/);
  assert.match(page, /fillPayload\(fullReportPayloadDefaults\(\)\);\s*markDirty\(\)/);
});

test('Default payload application explicitly unchecks Nil checkboxes and clears dynamic, bed and device selections', async () => {
  const { normalizeReportPayload, DIRECT_REPORT_KEYS } = await import('../domain/report-model.js');
  const formSource = page.slice(page.indexOf('function fillPayload(raw) {'), page.indexOf('// Reset only the current on-screen report;'));
  const inputs = new Map();
  const controls = id => {
    if (!inputs.has(id)) inputs.set(id, { value: 'old', checked: true, innerHTML: 'old' });
    return inputs.get(id);
  };
  const beds = [];
  const devices = [];
  const dynamic = [];
  let defaultRows = 0;
  const state = { dirty: true, items: [{ builtin: false, key: 'specialFlag', input_type: 'checkbox' }] };
  const fill = vm.runInNewContext(`${formSource}\nfillPayload`, {
    state, normalizeReportPayload, DIRECT_REPORT_KEYS,
    INF_MAP: { iCRE: 'i_CRE' }, DEV_MAP: { dMV: 'd_MV' },
    $: controls,
    setBeds: (key, val) => beds.push([key, val]),
    setDeviceValue: (key, val) => devices.push([key, val]),
    setDynamicValue: (item, val) => dynamic.push([item.key, val]),
    addEmptyDetail: () => assert.fail('Default entries should be empty'),
    addEB: () => { defaultRows += 1; },
    addPt: () => { defaultRows += 1; },
    addCs: () => { defaultRows += 1; },
    addIt: () => { defaultRows += 1; },
    addNR: () => { defaultRows += 1; },
    toggleNil: () => {}, toggleNilConsult: () => {}, toggleNilIntub: () => {},
    calcEmpty: () => {},
  });
  fill(fullReportPayloadDefaults());
  for (const checkbox of ['#nilCb', '#nilConsultCb', '#nilIntubCb']) {
    assert.equal(controls(checkbox).checked, false, checkbox);
  }
  assert.equal(controls('#totalPatientM').value, '0');
  assert.equal(controls('#sigName').value, '');
  assert.equal(controls('#staffAM').value, '');
  assert.equal(controls('#staffPM').value, '');
  assert.equal(state.dirty, false, 'The Reset action must call markDirty AFTER this fill.');
  assert.deepEqual(beds.map(([key]) => key), ['iCRE']);
  assert.deepEqual(Array.from(beds[0][1]), []);
  assert.equal(devices.length, 1);
  assert.deepEqual(dynamic, [['specialFlag', undefined]]);
  assert.equal(defaultRows, 5);
});
