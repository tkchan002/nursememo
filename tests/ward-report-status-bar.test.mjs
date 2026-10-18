import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const page = await readFile(new URL('../pages/ward-page.js', import.meta.url), 'utf8');
const markup = await readFile(new URL('../ward.html', import.meta.url), 'utf8');
const wardCss = await readFile(new URL('../css/ward.css', import.meta.url), 'utf8');
const statusCss = await readFile(new URL('../css/ward-draft-submit.css', import.meta.url), 'utf8');
const source = page.slice(page.indexOf('function formatWardStatusTime(value) {'), page.indexOf('async function handleMemoTypeChange() {'));
assert.match(source, /^function formatWardStatusTime/);

function statusScenario(overrides = {}, query = async () => ({ submitted: false })) {
  const nodes = new Map();
  const refs = ['#submissionBanner', '#memoDate', '#wardStatusReportType', '#wardStatusReportDate', '#wardStatusRecord', '#wardStatusLabel', '#wardStatusExplanation'];
  for (const key of refs) {
    const element = { dataset: {}, writes: 0, value: '' };
    let content = '';
    Object.defineProperty(element, 'textContent', {
      get() { return content; },
      set(value) { content = value; element.writes += 1; },
    });
    nodes.set(key, element);
  }
  nodes.get('#memoDate').value = '2026-10-18';
  const state = {
    loadedDate: '2026-10-18', memoType: 'pm', ward: { id: 'WARD-7B' },
    report: null, draft: null, submissionStatus: null,
    dirty: false, saving: false, submitting: false, operational: true,
    submissionStatusUnavailable: false,
    ...overrides,
  };
  const ctx = {
    state,
    $: selector => nodes.get(selector),
    MEMO_LABELS: { pm: 'PM Memo', night: 'Night Memo' },
    toDisplayDate: date => date.split('-').reverse().join('/'),
    REPORT_TIME_ZONE: 'Asia/Hong_Kong',
    loadWardSubmissionStatus: query,
    console: { error() {} },
  };
  const { renderSubmissionBanner, refreshSubmissionBanner } = vm.runInNewContext(`${source}\n({renderSubmissionBanner, refreshSubmissionBanner})`, ctx);
  const at = key => nodes.get(`#${key}`).textContent;
  return { state, nodes, at, renderSubmissionBanner, refreshSubmissionBanner };
}

test('new reports have a date and a truthful not-saved state', () => {
  const c = statusScenario();
  c.renderSubmissionBanner();
  assert.equal(c.at('wardStatusReportType'), 'PM Memo');
  assert.equal(c.at('wardStatusReportDate'), '18/10/2026');
  assert.equal(c.at('wardStatusLabel'), 'Not saved');
  assert.equal(c.at('wardStatusExplanation'), 'No saved draft or submission');
  assert.equal(c.nodes.get('#submissionBanner').dataset.state, 'new');
});

test('submitted records show a timestamp in Hong Kong time without seconds', () => {
  const c = statusScenario({ report: { submitted_at: '2026-10-18T09:36:11Z' } });
  c.renderSubmissionBanner();
  assert.equal(c.at('wardStatusLabel'), 'Submitted');
  assert.match(c.at('wardStatusRecord'), /18 Oct 2026, 17:36 HKT/);
  assert.doesNotMatch(c.at('wardStatusRecord'), /17:36:11/);
  assert.equal(c.nodes.get('#submissionBanner').dataset.state, 'submitted');
});

test('an unsubmitted draft explicitly states the last saved time and submission distinction', () => {
  const c = statusScenario({ draft: { updated_at: '2026-10-18T09:32:05Z' } });
  c.renderSubmissionBanner();
  assert.equal(c.at('wardStatusLabel'), 'Draft saved');
  assert.match(c.at('wardStatusRecord'), /Last draft saved: 18 Oct 2026, 17:32 HKT/);
  assert.match(c.at('wardStatusExplanation'), /Not submitted to Patrol Night/);
});

test('draft edits after submission remain clearly not re-submitted', () => {
  const c = statusScenario({
    report: { submitted_at: '2026-10-18T09:36:00Z' },
    draft: { updated_at: '2026-10-18T09:40:00Z' },
  });
  c.renderSubmissionBanner();
  assert.equal(c.at('wardStatusLabel'), 'Draft saved');
  assert.match(c.at('wardStatusExplanation'), /Not re-submitted/);
  assert.match(c.at('wardStatusRecord'), /Last submitted: 18 Oct 2026, 17:36 HKT/);
});

test('new unsaved changes take precedence over an older submission or saved draft', () => {
  const c = statusScenario({
    report: { submitted_at: '2026-10-18T09:36:00Z' },
    draft: { updated_at: '2026-10-18T09:40:00Z' },
    dirty: true,
  });
  c.renderSubmissionBanner();
  assert.equal(c.at('wardStatusLabel'), 'Unsaved changes');
  assert.match(c.at('wardStatusExplanation'), /Earlier draft saved/);
  assert.equal(c.nodes.get('#submissionBanner').dataset.state, 'unsaved');
  c.state.draft = null;
  c.renderSubmissionBanner();
  assert.equal(c.at('wardStatusLabel'), 'Unsaved changes');
  assert.match(c.at('wardStatusExplanation'), /not saved or submitted/);
});

test('save and submission progress are confirmed by actual operation flags', () => {
  const c = statusScenario({ dirty: true, saving: true });
  c.renderSubmissionBanner();
  assert.equal(c.at('wardStatusLabel'), 'Saving draft…');
  c.state.saving = false;
  c.state.submitting = true;
  c.renderSubmissionBanner();
  assert.equal(c.at('wardStatusLabel'), 'Submitting…');
  assert.match(c.at('wardStatusExplanation'), /Waiting for submission confirmation/);
});

test('failed submission-status query never fabricates a successful or absent submission', async () => {
  const c = statusScenario({}, async () => { throw new Error('Network unavailable'); });
  await c.refreshSubmissionBanner();
  assert.equal(c.at('wardStatusLabel'), 'Status unavailable');
  assert.match(c.at('wardStatusRecord'), /Unable to verify latest submission/);
  assert.equal(c.nodes.get('#submissionBanner').dataset.state, 'unknown');
});

test('verified status can recover from an earlier lookup error', async () => {
  const c = statusScenario({ submissionStatusUnavailable: true }, async () => ({ submitted: true, last_submitted_at: '2026-10-18T09:36:00Z' }));
  await c.refreshSubmissionBanner();
  assert.equal(c.state.submissionStatusUnavailable, false);
  assert.equal(c.at('wardStatusLabel'), 'Submitted');
  assert.match(c.at('wardStatusRecord'), /17:36 HKT/);
});

test('status text is not replaced on every keystroke', () => {
  const c = statusScenario({ dirty: true });
  c.renderSubmissionBanner();
  const initialWrites = c.nodes.get('#wardStatusLabel').writes;
  c.renderSubmissionBanner();
  c.renderSubmissionBanner();
  assert.equal(c.nodes.get('#wardStatusLabel').writes, initialWrites);
});

test('stable accessible markup and readable font sizes have one stylesheet owner', () => {
  assert.match(markup, /id="submissionBanner"[^>]*data-state="loading"/);
  assert.match(markup, /id="wardStatusLabel" role="status" aria-live="polite" aria-atomic="true"/);
  assert.match(statusCss, /\.ward-page #wardStatusLabel\s*\{[^}]*font-size: 16px/s);
  assert.match(statusCss, /\.ward-page #wardStatusExplanation\s*\{[^}]*font-size: 14px/s);
  assert.match(statusCss, /\.ward-page \.ward-report-heading strong\s*\{font-size: 17px/);
  assert.match(statusCss, /@media \(max-width: 760px\)/);
  assert.doesNotMatch(wardCss, /\.ward-page #submissionBanner/);
  assert.doesNotMatch(statusCss, /#submissionBanner span\s*\{/);
  assert.doesNotMatch(source, /banner\.innerHTML/);
});
