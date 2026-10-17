// Whitelisted layout settings. The editable DOCX remains the authoritative report.
// Values are deliberately bounded so Maintenance cannot generate unusable pages.
export const DEFAULT_DOCX_LAYOUT = Object.freeze({
  marginMm: 12,
  bodyFontPt: 9,
  tableFontPt: 8,
  titleFontPt: 16,
  sectionFontPt: 10,
  cellPaddingMm: 1,
  headerLeftPercent: 60,
  signatureWidthPercent: 43,
});

const RULES = Object.freeze({
  marginMm: [8, 20, 1],
  bodyFontPt: [8, 12, .5],
  tableFontPt: [7, 11, .5],
  titleFontPt: [12, 22, .5],
  sectionFontPt: [9, 14, .5],
  cellPaddingMm: [.5, 2.5, .5],
  headerLeftPercent: [50, 75, 1],
  signatureWidthPercent: [35, 60, 1],
});
export const DOCX_LAYOUT_RULES = RULES;

export function normalizeDocxLayout(value = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const normalized = {};
  for (const [key, [min, max, step]] of Object.entries(RULES)) {
    const raw = Object.prototype.hasOwnProperty.call(source, key) ? source[key] : DEFAULT_DOCX_LAYOUT[key];
    const n = Number(raw);
    if (!Number.isFinite(n) || n < min || n > max || Math.abs((n - min) / step - Math.round((n - min) / step)) > 1e-5) {
      throw new Error(`Invalid DOCX layout setting: ${key}.`);
    }
    normalized[key] = n;
  }
  return normalized;
}
