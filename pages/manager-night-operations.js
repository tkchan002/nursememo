import { openPrintView } from '../services/print-job-service.js';
import { qs, esc } from '../core/dom.js';
import { formatDateTime } from '../core/dates.js';
import { getWardsForDate } from '../data/repositories/ward-repository.js';
import { getCurrentNightRosterSnapshots } from '../data/repositories/night-roster-repository.js';
import { reportingNightDate } from '../domain/manager-memo.js';
import { buildNightOperationsModel } from '../domain/night-roster.js';
import { renderNightStaffPrintHtml, renderNightRunnerPrintHtml } from '../night-roster-print.js';
const rosterLogoUrl = new URL('../assets/heart-logo.png', import.meta.url).href;

const $ = qs;
const state = {
  reportingDate: reportingNightDate(),
  model: buildNightOperationsModel(),
  refreshing: false,
  loaded: false,
  printKind: null,
  previousFocus: null,
};

bindControls();
refreshNightOperations().catch(showError);
setInterval(() => refreshNightOperations({ quiet: true }).catch(() => {}), 60_000);

function bindControls() {
  $('#refreshNightOperationsBtn')?.addEventListener('click', () => refreshNightOperations());
  $('#refreshStatusBtn')?.addEventListener('click', () => refreshNightOperations({ quiet: true }).catch(() => {}));
  $('#printNightStaffBtn')?.addEventListener('click', printNightStaff);
  $('#printNightRunnerBtn')?.addEventListener('click', printNightRunners);
  $('#rosterPreviewCloseBtn')?.addEventListener('click', closeRosterPreview);
  $('#rosterPreviewPrintBtn')?.addEventListener('click', printRosterPreview);
  $('#rosterPreviewResetBtn')?.addEventListener('click', () => {
    $('#rosterPreviewFontSize').value = '10';
    updateRosterPreview();
  });
  $('#rosterPreviewFontSize')?.addEventListener('input', updateRosterPreview);
  $('#rosterPreviewModal')?.addEventListener('click', event => {
    if (event.target === $('#rosterPreviewModal')) closeRosterPreview();
  });
  document.addEventListener('keydown', event => {
    if ($('#rosterPreviewModal')?.hidden === false && event.key === 'Escape') {
      event.preventDefault();
      closeRosterPreview();
    }
  });
  document.addEventListener('manager-primary-tab-change', event => {
    if (event.detail?.tab === 'staffing') refreshNightOperations({ quiet: state.loaded }).catch(showError);
  });
}

async function refreshNightOperations({ quiet = false } = {}) {
  if (state.refreshing) return;
  state.refreshing = true;
  const button = $('#refreshNightOperationsBtn');
  if (button) button.disabled = true;
  if (!quiet) setLoading();

  try {
    const currentDate = reportingNightDate();
    if (currentDate !== state.reportingDate) state.reportingDate = currentDate;
    const [wards, snapshots] = await Promise.all([
      getWardsForDate(state.reportingDate),
      getCurrentNightRosterSnapshots(state.reportingDate),
    ]);
    state.model = buildNightOperationsModel({ wards, snapshots });
    state.loaded = true;
    render();
  } finally {
    state.refreshing = false;
    if (button) button.disabled = false;
  }
}

function setLoading() {
  if ($('#nightWardListSummary')) $('#nightWardListSummary').textContent = 'Refreshing…';
  if ($('#nightRunnerListSummary')) $('#nightRunnerListSummary').textContent = 'Refreshing…';
  if ($('#nightWardStaffRows')) $('#nightWardStaffRows').innerHTML = '<tr><td colspan="6">Refreshing night staff…</td></tr>';
  if ($('#nightRunnerRows')) $('#nightRunnerRows').innerHTML = '<tr><td colspan="4">Refreshing Night Runners…</td></tr>';
}

function render() {
  const model = state.model;
  $('#nightNurseCount').textContent = String(model.nurseCount);
  $('#nightRunnerCount').textContent = String(model.runnerCount);
  $('#nightRosterWardCount').textContent = `${model.wardsWithRoster} / ${model.wardCount}`;
  $('#nightOperationsDate').textContent = `Reporting night: ${displayReportingDate(state.reportingDate)}`;
  $('#nightWardListSummary').textContent = `${model.wardsWithRoster} of ${model.wardCount} wards · ${model.nurseCount} nurses`;
  $('#nightRunnerListSummary').textContent = `${model.runnerCount} runner${model.runnerCount === 1 ? '' : 's'}`;
  $('#printNightStaffBtn').disabled = model.wardCount === 0;
  $('#printNightRunnerBtn').disabled = false;

  const wardRows = [];
  for (const row of model.wardRosters) {
    const wardName = row.ward?.name || '';
    const updated = row.updatedAt ? formatDateTime(row.updatedAt, 'en-GB') : '—';
    if (!row.nurses?.length) {
      wardRows.push(`<tr class="night-staffing-empty-ward"><td><b>${esc(wardName)}</b></td><td colspan="4">No night staff saved for this shift.</td><td>${esc(updated)}</td></tr>`);
      continue;
    }
    row.nurses.forEach((nurse, index) => {
      wardRows.push(`<tr><td>${index === 0 ? `<b>${esc(wardName)}</b>` : ''}</td><td>${esc(nurse.role)}</td><td>${esc(nurse.name)}</td><td>${esc(nurse.appointmentDate)}</td><td>${nurse.runner ? '<span class="runner-yes">Yes</span>' : '—'}</td><td>${index === 0 ? esc(updated) : ''}</td></tr>`);
    });
  }
  $('#nightWardStaffRows').innerHTML = wardRows.join('') || '<tr><td colspan="6">No active wards found.</td></tr>';

  $('#nightRunnerRows').innerHTML = model.runners.length
    ? model.runners.map(nurse => `<tr><td><b>${esc(nurse.ward?.name || '')}</b></td><td>${esc(nurse.role)}</td><td>${esc(nurse.name)}</td><td>${esc(nurse.appointmentDate)}</td></tr>`).join('')
    : '<tr><td colspan="4">No Night Runner recorded for this reporting night.</td></tr>';
}

function displayReportingDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  return match ? `${match[3]}/${match[2]}/${match[1]}` : String(value || '');
}

function printNightStaff() {
  showRosterPreview('staff');
}

function printNightRunners() {
  showRosterPreview('runner');
}

function rosterFontSize() {
  return Math.max(8, Math.min(14, Number($('#rosterPreviewFontSize').value) || 10));
}

function createRosterPrintDocument() {
  const options = { reportingDate: state.reportingDate, logoUrl: rosterLogoUrl, fontSize: rosterFontSize() };
  return state.printKind === 'staff'
    ? renderNightStaffPrintHtml({ ...options, wardRosters: state.model.wardRosters })
    : renderNightRunnerPrintHtml({ ...options, runners: state.model.runners });
}

function showRosterPreview(kind) {
  if (!state.loaded) return;
  state.printKind = kind;
  state.previousFocus = document.activeElement;
  $('#rosterPreviewTitle').textContent = kind === 'staff' ? 'Night Staff List Preview' : 'Night Runner List Preview';
  $('#rosterPreviewFontSize').value = '10';
  $('#rosterPreviewModal').hidden = false;
  updateRosterPreview();
  $('#rosterPreviewCloseBtn').focus();
}

function updateRosterPreview() {
  if ($('#rosterPreviewModal').hidden || !state.printKind) return;
  const frame = $('#rosterPreviewFrame');
  frame.srcdoc = createRosterPrintDocument();
}

function closeRosterPreview() {
  $('#rosterPreviewModal').hidden = true;
  $('#rosterPreviewFrame').removeAttribute('srcdoc');
  state.printKind = null;
  state.previousFocus?.focus?.();
  state.previousFocus = null;
}

function printRosterPreview() {
  if (!state.printKind) return;
  const title = state.printKind === 'staff' ? 'Night Staff List' : 'Night Runner List';
  const html = createRosterPrintDocument();
  // Existing print-view service handles same-origin print jobs and Print / PDF.
  openPrintView({ html, title, kind: 'night-roster' });
}

function showError(error) {
  console.error('Night Staffing failed:', error);
  const message = esc(error?.message || error || 'Unable to load Night Staffing.');
  if ($('#nightWardListSummary')) $('#nightWardListSummary').textContent = 'Unavailable';
  if ($('#nightRunnerListSummary')) $('#nightRunnerListSummary').textContent = 'Unavailable';
  if ($('#nightWardStaffRows')) $('#nightWardStaffRows').innerHTML = `<tr><td colspan="6">${message}</td></tr>`;
  if ($('#nightRunnerRows')) $('#nightRunnerRows').innerHTML = `<tr><td colspan="4">${message}</td></tr>`;
}
