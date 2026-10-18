/** History is an inspection view, not a source of reports for Patrol Night/Get Data. */
export function wardHistoryKey(entry) {
  return `${entry.kind}:${entry.report_date}:${entry.report_type}`;
}

/** Keep submitted snapshots and later unsubmitted drafts as separate inspectable versions. */
export function mergeWardHistory(submitted = [], drafts = [], limit = 30) {
  const submittedKeys = new Set(submitted.map(r => `${r.report_date}:${r.report_type}`));
  const entries = [
    ...submitted.map(row => ({ ...row, kind: 'submitted', activity_at: row.submitted_at || row.updated_at })),
    ...drafts.map(row => ({ ...row, kind: 'draft', activity_at: row.updated_at,
      hasSubmittedVersion: submittedKeys.has(`${row.report_date}:${row.report_type}`) })),
  ];
  return entries.sort((a, b) => String(b.activity_at || '').localeCompare(String(a.activity_at || ''))
    || String(b.report_date).localeCompare(String(a.report_date))
    || a.report_type.localeCompare(b.report_type)
    || a.kind.localeCompare(b.kind)).slice(0, limit);
}
