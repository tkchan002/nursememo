import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderWardMemoHtml } from '../ward-print.js';
import { positionWardMemoCrosses } from '../services/ward-memo-crosses.js';
import { fullReportPayloadDefaults, normalizeReportPayload } from '../domain/report-model.js';

function htmlFor(nilConsultation, nilIntubation, reportType = 'night') {
  return renderWardMemoHtml({
    ward: { name: 'Ward C5', empty_bed_gender_mode: 'male' },
    capacity: 38,
    report: { report_type: reportType, report_date: '2026-10-18', payload: {
      nilConsultation, nilIntubation,
      consultations: [['12', 'Test Patient', 'Cardiology']],
      intubations: [['14', 'Test Patient', 'Diagnosis', 'Reason', 'Elective', 'Staff', 'Ward', 'ICU']],
      emptyBeds: { count: 0, entries: [] },
    } },
  });
}

test('printable PM and Night Memo HTML mark exactly the selected NIL tables for crossing', () => {
  for (const reportType of ['night', 'pm']) {
    for (const consultation of [false, true]) {
      for (const intubation of [false, true]) {
        const html = htmlFor(consultation, intubation, reportType);
        assert.match(html, new RegExp(`class="memo-table-box consult-box ${consultation ? 'crossed' : ''}"`));
        assert.match(html, new RegExp(`class="memo-table-box intub-box ${intubation ? 'crossed' : ''}"`));
        assert.equal((html.match(/class="memo-cross-body"/g) || []).length, 2);
        assert.equal(html.includes('Test Patient'), !(consultation && intubation));
      }
    }
  }
});

test('fresh Ward memo defaults leave NIL Consultation and NIL Intubation unchecked in print', async () => {
  const defaults = fullReportPayloadDefaults();
  assert.equal(defaults.nilConsultation, false);
  assert.equal(defaults.nilIntubation, false);
  assert.equal(normalizeReportPayload({}).nilConsultation, false);
  assert.equal(normalizeReportPayload({}).nilIntubation, false);

  // Both PM and Night Memo use the same new-report defaults.
  for (const type of ['pm', 'night']) {
    const html = renderWardMemoHtml({
      ward: { name: 'Ward C5', empty_bed_gender_mode: 'male' },
      capacity: 38,
      report: { report_type: type, report_date: '2026-10-18', payload: normalizeReportPayload(defaults) },
    });
    assert.match(html, /class="memo-table-box consult-box "/);
    assert.match(html, /class="memo-table-box intub-box "/);
    assert.doesNotMatch(html, /class="memo-table-box (?:consult|intub)-box crossed"/);
  }

  const form = await readFile(new URL('../ward.html', import.meta.url), 'utf8');
  assert.match(form, /<input type="checkbox" id="nilConsultCb"(?![^>]*checked)/);
  assert.match(form, /<input type="checkbox" id="nilIntubCb"(?![^>]*checked)/);
});

test('saved NIL choices override defaults independently and survive payload normalization', () => {
  for (const consultation of [false, true]) {
    for (const intubation of [false, true]) {
      const restored = normalizeReportPayload({
        nilConsultation: consultation,
        nilIntubation: intubation,
        consultations: [['10', 'Patient A', 'Cardiology']],
        intubations: [['11', 'Patient B', 'Diagnosis', '', '', '', '', '']],
      });
      assert.equal(restored.nilConsultation, consultation);
      assert.equal(restored.nilIntubation, intubation);
      assert.equal(restored.consultations.length, 1);
      assert.equal(restored.intubations.length, 1);
    }
  }
});

function tableBox({ header = 22, body = 90, marginTop = '5px', rows = 1 } = {}) {
  const cross = { style: {} };
  const tbody = { offsetHeight: body, rows: { length: rows } };
  const table = { tHead: { offsetHeight: header }, tBodies: [tbody] };
  const box = { querySelector(selector) { return selector === 'table' ? table : selector === '.memo-cross-body' ? cross : null; } };
  return { box, table, cross, marginTop };
}

test('shared cross-positioner sizes each selected table body, excluding header and allowing reflow', () => {
  const consultation = tableBox({ header: 26, body: 100, marginTop: '0px' });
  const intubation = tableBox({ header: 57, body: 63, marginTop: '6px' });
  const view = { getComputedStyle: table => ({ marginTop: table === consultation.table ? consultation.marginTop : intubation.marginTop }) };
  const doc = { defaultView: view, querySelectorAll: selector => selector === '.memo-table-box.crossed' ? [consultation.box, intubation.box] : [] };
  assert.equal(positionWardMemoCrosses(doc), true);
  assert.deepEqual(consultation.cross.style, { top: '26px', height: '100px', display: 'block' });
  assert.deepEqual(intubation.cross.style, { top: '63px', height: '63px', display: 'block' });
  consultation.table.tBodies[0].offsetHeight = 152;
  assert.equal(positionWardMemoCrosses(doc), true);
  assert.equal(consultation.cross.style.height, '152px');
});

test('shared cross-positioner stays safe for missing DOM and temporarily empty table bodies', () => {
  assert.equal(positionWardMemoCrosses(null), false);
  const noRows = tableBox({ rows: 0 });
  const root = { querySelectorAll: () => [noRows.box] };
  assert.equal(positionWardMemoCrosses(root), true);
  assert.equal(noRows.cross.style.display, 'none');
  noRows.table.tBodies[0].rows.length = 1;
  assert.equal(positionWardMemoCrosses(root), true);
  assert.equal(noRows.cross.style.display, 'block');
});

test('standalone print page invokes shared cross positioning on screen sizing and before printing', async () => {
  const js = await readFile(new URL('../print.js', import.meta.url), 'utf8');
  assert.match(js, /import \{ positionWardMemoCrosses \} from '\.\/services\/ward-memo-crosses\.js'/);
  assert.match(js, /function fitPreview\(\) \{[\s\S]*?positionWardMemoCrosses\(document\)/);
  assert.match(js, /addEventListener\('beforeprint',[\s\S]*?positionWardMemoCrosses\(document\)/);
  assert.match(js, /addEventListener\('click',[\s\S]*?positionWardMemoCrosses\(document\);\s*window\.print\(\)/);
});
