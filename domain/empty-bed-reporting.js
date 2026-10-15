/** One ordered manual-entry list, independent of calculated vacant beds. */
export const EMPTY_BED_ENTRY_DESIGNATIONS = Object.freeze(['M', 'F', 'S', 'D', 'T', 'OTHER']);

export function availableEmptyBedDesignations(ward = {}, previouslySaved = '') {
  // S/D is a currently supported ward-level configuration, not a legacy format.
  const codes = ward.single_double_reporting_enabled === true
    ? [...EMPTY_BED_ENTRY_DESIGNATIONS]
    : EMPTY_BED_ENTRY_DESIGNATIONS.filter(code => code !== 'S' && code !== 'D');
  // Preserve a currently-saved S/D selection after the setting is disabled.
  const previous = String(previouslySaved).trim().toUpperCase();
  if (EMPTY_BED_ENTRY_DESIGNATIONS.includes(previous) && !codes.includes(previous)) codes.push(previous);
  return codes;
}

export function parseEmptyBedLabel(label) {
  const match = String(label ?? '').trim().toUpperCase().match(/^([1-9]\d*)([MFSDT])$/);
  if (!match || !Number.isSafeInteger(Number(match[1]))) return null;
  return { quantity: Number(match[1]), designation: match[2] };
}

export function normalizeEmptyBedEntries(entries) {
  if (!Array.isArray(entries)) return null;
  return entries.map(value => ({
    quantity: value?.quantity ?? null,
    designation: String(value?.designation ?? '').trim().toUpperCase(),
    customDesignation: String(value?.customDesignation ?? '').trim(),
    remark: String(value?.remark ?? '').trim(),
  }));
}

export function validateEmptyBedEntries(entries) {
  if (entries === undefined || entries === null) return [];
  if (!Array.isArray(entries)) return ['Empty Bed entries must be a list.'];
  const errors = [];
  entries.forEach((entry, index) => {
    const { quantity, designation, customDesignation, remark } = entry || {};
    if (quantity == null && !designation && !customDesignation && !remark) return;
    const n = typeof quantity === 'number' ? quantity : Number(String(quantity ?? '').trim());
    if (!Number.isSafeInteger(n) || n < 1) errors.push(`Empty Bed entry ${index + 1} requires a positive whole number.`);
    if (!EMPTY_BED_ENTRY_DESIGNATIONS.includes(String(designation ?? '').trim().toUpperCase())) {
      errors.push(`Empty Bed entry ${index + 1} requires a valid reporting designation.`);
    }
    if (String(designation).toUpperCase() === 'OTHER' && !String(customDesignation || '').trim()) errors.push(`Empty Bed entry ${index + 1} requires a custom designation.`);
  });
  return errors;
}

export function formatEmptyBedEntries(entries) {
  if (!Array.isArray(entries)) return '';
  return entries.filter(entry => entry && Number.isSafeInteger(Number(entry.quantity)) && Number(entry.quantity) > 0
    && EMPTY_BED_ENTRY_DESIGNATIONS.includes(String(entry.designation || '').toUpperCase()))
    .map(entry => `${Number(entry.quantity)}${String(entry.designation).toUpperCase() === 'OTHER' ? String(entry.customDesignation || '').trim() : String(entry.designation).toUpperCase()}${String(entry.remark || '').trim() ? ` (${String(entry.remark).trim()})` : ''}`)
    .join(', ');
}

