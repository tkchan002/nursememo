import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { MEMO_LABELS, wardMemoPrintHeading } from '../domain/report-cycle.js';
import { renderWardMemoHtml, printWardMemo, writeWardMemoToIframe } from '../ward-print.js';
import { readPrintJob } from '../services/print-job-service.js';

function context(reportType) {
  return {
    ward: { id: 'ward-1', name: 'Ward C5', empty_bed_gender_mode: 'male' },
    capacity: 40,
    items: [],
    report: {
      report_type: reportType,
      report_date: '2026-10-17',
      payload: {
        admissionEC: '1', admissionCC: '2', discharge: '0',
        totalPatientM: '38', emptyBeds: { count: 2, entries: [] },
      },
    },
  };
}

function memoryStorage() {
  const values = new Map();
  return {
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] ?? null; },
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
}

test('printed HTML uses the selected reporting-cycle label in both browser and paper headings', () => {
  for (const [type, label] of Object.entries(MEMO_LABELS)) {
    assert.equal(wardMemoPrintHeading(context(type).report), label);
    const html = renderWardMemoHtml(context(type));
    assert.match(html, new RegExp(`<title>${label}</title>`));
    assert.match(html, new RegExp(`<div class="title">${label}</div>`));
    assert.doesNotMatch(html, new RegExp(`<div class="title">${type === 'pm' ? 'Night Memo' : 'PM Memo'}</div>`));
  }
});

test('missing type in an old report keeps the Night Memo heading', () => {
  assert.equal(wardMemoPrintHeading({}), MEMO_LABELS.night);
});

test('shared print job stores matching PM/Night title and document HTML for current and historical reprints', async () => {
  const originalStorage = globalThis.sessionStorage;
  const originalLocation = globalThis.location;
  const storage = memoryStorage();
  const assigned = [];
  globalThis.sessionStorage = storage;
  globalThis.location = { href: 'https://example.test/ward.html', assign(url) { assigned.push(url); } };
  try {
    // The renderer must use the report's stored type, not the current clock or login role.
    for (const type of ['pm', 'night', 'pm']) {
      const id = await printWardMemo(context(type));
      const job = readPrintJob(id, { storage });
      const label = MEMO_LABELS[type];
      assert.equal(job?.title, label);
      assert.equal(job?.kind, 'ward-memo');
      assert.match(job.html, new RegExp(`<title>${label}</title>`));
      assert.match(job.html, new RegExp(`<div class="title">${label}</div>`));
      assert.match(assigned.at(-1), /\/print\.html\?job=/);
    }
  } finally {
    if (originalStorage === undefined) delete globalThis.sessionStorage;
    else globalThis.sessionStorage = originalStorage;
    if (originalLocation === undefined) delete globalThis.location;
    else globalThis.location = originalLocation;
  }
});

test('iframe preview receives the same heading as the printed version', async () => {
  const frame = { onload: null, srcdoc: '', contentDocument: null };
  const loading = writeWardMemoToIframe(frame, context('pm'));
  assert.match(frame.srcdoc, /<div class="title">PM Memo<\/div>/);
  assert.match(frame.srcdoc, /<title>PM Memo<\/title>/);
  frame.onload();
  await loading;
});

test('Ward print actions use the shared print path and Patrol preview uses saved report type', async () => {
  const wardPage = await readFile(new URL('../pages/ward-page.js', import.meta.url), 'utf8');
  const patrolPage = await readFile(new URL('../pages/patrol-page.js', import.meta.url), 'utf8');
  assert.match(wardPage, /async function printPdf\(\)[^\n]*mod\.printWardMemo\(/);
  assert.match(wardPage, /async function printCurrent\([^\n]*report_type: state\.memoType/);
  assert.match(wardPage, /async function histReprint\(\)[^\n]*printReportObject\(state\.currentHist\)/);
  assert.match(patrolPage, /wardMemoPreviewTitle'\)\.textContent = `\$\{entry\.ward\.name\} \$\{wardMemoPrintHeading\(report\)\}`/);
});
