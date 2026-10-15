/**
 * Bed arithmetic is a reporting calculation, not an admission policy.
 * Negative results are valid (patients can exceed nominal bed capacity).
 * Unknown values must never be converted to zero.
 *
 * Keep this dependency-free so Ward, Manager, history, validation and printing
 * use exactly the same calculation.
 */
function wholeNumber(value, { allowNegative = false } = {}) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const numeric = Number(value);
  if (!Number.isSafeInteger(numeric) || (!allowNegative && numeric < 0)) return null;
  return numeric;
}

export function calculateEmptyBeds(capacity, totalPatients) {
  const beds = wholeNumber(capacity);
  const patients = wholeNumber(totalPatients);
  return beds === null || patients === null ? null : beds - patients;
}

/** Historical reports use their submitted capacity snapshot, not today's capacity. */
export function resolveReportEmptyBeds({ report = null, capacity = null, totalPatients = undefined } = {}) {
  const effectiveCapacity = report?.bed_capacity_snapshot ?? capacity;
  const effectivePatients = totalPatients === undefined ? report?.payload?.totalPatientM : totalPatients;
  return calculateEmptyBeds(effectiveCapacity, effectivePatients);
}

export function displayEmptyBeds(count) {
  return count === null || count === undefined ? '—' : String(count);
}
