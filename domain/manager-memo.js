import { addDaysISO, todayISO, toDisplayDate } from '../core/dates.js';
import { deviceCount, normalizeDevice, normalizeReportPayload } from './report-model.js';
import { reportSubmittedAt } from './report-session.js';
import { reportNightDate, combinedMovementValue, missingMemoTypes } from './report-cycle.js';
import { formatEmptyBedEntries } from './empty-bed-reporting.js';
import { resolveReportEmptyBeds, displayEmptyBeds } from './bed-occupancy.js';

export function reportingNightDate(now = new Date()) { return reportNightDate(now); }

export { managerSubmissionStatus } from './submission-status.js';

export function formatManagerEmptyBeds(ward, report, capacity = null) {
  if (!report) return '—';
  const empty = normalizeReportPayload(report.payload).emptyBeds;
  const count = resolveReportEmptyBeds({ report, capacity });
  const details = formatEmptyBedEntries(empty.entries);
  return displayEmptyBeds(count) + (details ? ` (${details})` : '');
}

function bedList(value) {
  const rows = Array.isArray(value) ? value.filter(Boolean).map(String) : [];
  if (!rows.length) return '0';
  return `${rows.length} (bed ${rows.join(',')})`;
}

function deviceSummary(value) {
  const device = normalizeDevice(value);
  const count = deviceCount(device);
  if (!count) return '0';
  if (device.mode === 'count') return String(count);
  return `${count} (bed ${device.beds.join(',')})`;
}

export function sourceSnapshotFromBundle(bundle = []) {
  return bundle.flatMap(entry => [['pm', entry.pmReport], ['night', entry.nightReport]]
    .filter(([, report]) => !!report)
    .map(([memo_type, report]) => ({
      ward_id: entry.ward?.id || report.ward_id,
      ward_name: entry.ward?.name || '', memo_type,
      report_id: report.id, submitted_at: reportSubmittedAt(report) || '',
    })))
    .sort((a, b) => `${a.ward_id}:${a.memo_type}`.localeCompare(`${b.ward_id}:${b.memo_type}`));
}

export function isReportNewerThanSource(report, source) {
  if (!report) return false;
  if (!source) return true;
  const currentStamp = new Date(reportSubmittedAt(report) || 0).getTime();
  const sourceStamp = new Date(source.submitted_at || 0).getTime();
  if (!Number.isFinite(currentStamp)) return false;
  if (!Number.isFinite(sourceStamp)) return true;
  return currentStamp > sourceStamp || (currentStamp === sourceStamp && report.id !== source.report_id);
}

export function sourceSnapshotSignature(snapshot = []) {
  return [...(snapshot || [])]
    .sort((a, b) => `${a.ward_id}:${a.memo_type}`.localeCompare(`${b.ward_id}:${b.memo_type}`))
    .map(row => `${row.ward_id}:${row.memo_type}:${row.report_id}:${row.submitted_at}`)
    .join('|');
}

function mainRow(entry) {
  const { ward, report, capacity, pmReport, nightReport } = entry;
  const primary = pmReport;
  const secondary = nightReport;
  const D = report ? normalizeReportPayload(report.payload) : {};
  return {
    ward: ward?.name || '',
    admissionEC: combinedMovementValue(primary, secondary, 'admissionEC'),
    admissionCC: combinedMovementValue(primary, secondary, 'admissionCC'),
    transferIn: combinedMovementValue(primary, secondary, 'transferIn'),
    discharge: combinedMovementValue(primary, secondary, 'discharge'),
    transferOut: combinedMovementValue(primary, secondary, 'transferOut'),
    death: combinedMovementValue(primary, secondary, 'death'),
    totalPatient: report ? String(D.totalPatientM ?? '') : '',
    emptyBed: report ? formatManagerEmptyBeds(ward, report, capacity) : '',
    ventilator: report ? String(deviceCount(D.devBeds?.dMV) || 0) : '',
    bipap: report ? String(deviceCount(D.devBeds?.dNIV) || 0) : '',
    hfnc: report ? String(deviceCount(D.devBeds?.dHF) || 0) : '',
    staff: report ? [D.staffAM, D.staffPM].filter(v => v !== '' && v != null).join('/') : '',
  };
}

function infectionRow(entry) {
  const { ward, report } = entry;
  const D = report ? normalizeReportPayload(report.payload) : {};
  return {
    ward: ward?.name || '',
    covid: report ? bedList(D.infBeds?.iCOV) : '',
    cre: report ? bedList(D.infBeds?.iCRE) : '',
    vre: report ? bedList(D.infBeds?.iVRE) : '',
    mdra: report ? bedList(D.infBeds?.iMDR) : '',
    cd: report ? bedList(D.infBeds?.iCD) : '',
    influenza: report ? bedList(D.infBeds?.iInf) : '',
    hdCapd: report ? `HD: ${deviceCount(D.devBeds?.dHD) || 0}  CAPD: ${deviceCount(D.devBeds?.dCA) || 0}` : '',
    remarks: '',
  };
}

function earlyBirdLines(bundle = []) {
  const lines = [];
  for (const { ward, report } of bundle) {
    if (!report) continue;
    const D = normalizeReportPayload(report.payload);
    const rows = (D.earlyBirds || []).filter(row => row?.bed || row?.dest);
    if (rows.length) lines.push(`${ward?.name || 'Ward'}: ${rows.map(row => `${row.bed || '?'} → ${row.dest || '?'}`).join('; ')}`);
  }
  return lines;
}

function emptyBedLines(bundle = []) {
  return bundle
    .filter(entry => entry.report)
    .map(entry => `${entry.ward?.name || 'Ward'}: ${formatManagerEmptyBeds(entry.ward, entry.report, entry.capacity)}`);
}

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const linesToHtml = lines => lines.length ? lines.map(line => `<div>${escapeHtml(line)}</div>`).join('') : '<div><br></div>';

export const MANAGER_MEMO_FROM_PREFIX = 'N.O./APN,';
export const MANAGER_MEMO_TO = 'DOM/Medical (QEH)';

export function buildManagerMemoData({ bundle = [], items = [], reportingDate = reportingNightDate() } = {}) {
  const template = {
    version: 3,
    title: 'Night Memo',
    header: {
      fromName: '',
      dectPhone: '',
      callTeam: '',
      date: toDisplayDate(reportingDate),
    },
    mainTableRows: bundle.map(mainRow),
    infectionRows: bundle.map(infectionRow),
    earlyBirdHtml: linesToHtml(earlyBirdLines(bundle)),
    emptyBedHtml: linesToHtml(emptyBedLines(bundle)),
    additionalReportHtml: '<div><br></div>',
    ct: {
      total: '',
      maleGeneral: '',
      maleCohort: '',
      femaleGeneral: '',
      femaleCohort: '',
    },
    signature: {
      label: 'Signature',
      name: '',
      designation: 'N.O./APN',
    },
  };
  return template;
}

