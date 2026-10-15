import * as db from '../data/index.js';
import { effectiveItems, normalizeReportPayload, snapshotReportItems } from '../domain/report-model.js';
import { validateReportPayload } from '../domain/report-validation.js';
import { reportNightDate, requireMemoType } from '../domain/report-cycle.js';

function itemsForReport(allItems, date, report, includeInactiveHistorical = false) {
  return report?.report_item_snapshot?.length
    ? report.report_item_snapshot.map(i => ({ ...i, __historical: true }))
    : effectiveItems(allItems || [], date, { includeInactiveHistorical });
}

export async function loadWardReportContext(wardId, date, memoType = 'night') {
  requireMemoType(memoType);
  const [operational, capacity, allItems, staff, report, draft] = await Promise.all([
    db.isWardOperational(wardId, date), db.getWardCapacity(wardId, date),
    db.getReportItems(date, true), db.getWardStaff(wardId, false),
    db.getWardCycleReport(wardId, date, memoType), db.getWardCycleDraft(wardId, date, memoType),
  ]);
  const items = itemsForReport(allItems, date, draft || report, false);
  return { operational, capacity: capacity == null ? null : Number(capacity), items, allItems, staff: staff || [], report, draft };
}

export async function loadHistoricalReportContext(wardId, report) {
  const [allItems, capacity] = await Promise.all([
    db.getReportItems(report.report_date, true),
    report.bed_capacity_snapshot != null ? Promise.resolve(report.bed_capacity_snapshot) : db.getWardCapacity(wardId, report.report_date),
  ]);
  const items = itemsForReport(allItems, report.report_date, report, true)
    .map(i => ({ ...i, __historical: true }));
  return { report, capacity, items };
}

export async function loadManagerCurrent() {
  const date = reportNightDate();
  // A reporting cycle has two explicit, independently submitted source records.
  const [allItems, allWards, reports] = await Promise.all([
    db.getReportItems(date, true), db.getWardsForDate(date), db.getCycleReports(date),
  ]);
  const capacityByWard = await db.getCapacitiesForWards(allWards.map(w => w.id), date);
  const index = new Map(reports.map(report => [`${report.ward_id}:${report.report_type}`, report]));
  return {
    date, items: effectiveItems(allItems, date, { includeInactiveHistorical: false }), allWards,
    bundle: allWards.map(ward => {
      const pmReport = index.get(`${ward.id}:pm`) || null;
      const nightReport = index.get(`${ward.id}:night`) || null;
      return { ward, capacity: capacityByWard[ward.id] ?? null,
        pmReport, nightReport, report: nightReport || pmReport || null };
    }),
  };
}

function buildWardRow({ wardId, date, memoType = 'night', editedPayload, existingReport, existingDraft, capacity, items }) {
  requireMemoType(memoType);
  const validation = validateReportPayload(editedPayload, { capacity });
  if (!validation.valid) throw new Error(validation.errors.join(' '));
  return {
    row: {
      ward_id: wardId,
      report_date: date,
      report_type: memoType,
      payload: { ...normalizeReportPayload(validation.payload), savedAt: new Date().toISOString() },
      bed_capacity_snapshot: capacity,
      form_version: 1,
      report_item_snapshot: snapshotReportItems(items),
      // Both server-side revisions must match: drafts and submissions share a lock.
      expected_report_revision: Number(existingReport?.revision) || 0,
      expected_draft_revision: Number(existingDraft?.revision) || 0,
    },
    warnings: validation.warnings,
  };
}

export async function saveWardDraft({ wardId, date, memoType, editedPayload, existingReport, existingDraft, capacity, items }) {
  const { row, warnings } = buildWardRow({ wardId, date, memoType, editedPayload, existingReport, existingDraft, capacity, items });
  return { draft: await db.saveWardCycleDraft(row), warnings };
}

export async function submitWardReport({ wardId, date, memoType, editedPayload, existingReport, existingDraft, capacity, items }) {
  const { row, warnings } = buildWardRow({ wardId, date, memoType, editedPayload, existingReport, existingDraft, capacity, items });
  // Submission and draft deletion are one transaction inside the database RPC.
  const report = await db.submitWardCycleReport(row);
  return { report, warnings };
}

export async function loadWardSubmissionStatus(wardId, date, memoType = 'night') {
  const report = await db.getWardCycleReport(wardId, date, requireMemoType(memoType));
  return { last_submitted_at: report?.submitted_at || null,
    last_report_id: report?.id || null, submitted: !!report, memo_type: memoType, report_date: date };
}
