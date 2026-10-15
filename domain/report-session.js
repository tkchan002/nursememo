/** Report submission timestamp in the canonical PM/Night schema. */
export function reportSubmittedAt(report) {
  return report?.submitted_at ?? null;
}
