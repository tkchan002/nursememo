export const PATROL_PRINT_CSS = `
@page{size:A4 portrait;margin:10mm 10mm 11mm}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{font-family:Arial,Helvetica,sans-serif;color:#111;background:#d8d8d8;font-size:10pt;line-height:1.28}
.patrol-print-page{width:210mm;min-height:297mm;margin:10px auto;background:#fff;padding:10mm 10mm 9mm;box-shadow:0 2px 10px rgba(0,0,0,.22)}
.patrol-print-logo{display:block;object-fit:contain;width:19mm;height:19mm;margin:0 auto 2mm}
.patrol-print-title{text-align:center;font-size:17pt;font-weight:700;line-height:1.15;margin:0 0 2mm}
.roster-print-document{font-size:var(--roster-font-size,10pt)}
.roster-print-document .patrol-print-table{font-size:inherit}
.roster-print-document .patrol-print-ward-head{font-size:1.05em}
.patrol-print-subtitle{text-align:center;font-size:9pt;margin:0 0 5mm;color:#333}
.patrol-print-meta{display:grid;grid-template-columns:1fr 1fr;gap:1.5mm 9mm;margin:0 0 4mm}
.patrol-print-meta-row{display:grid;grid-template-columns:27mm 1fr;gap:1.5mm;align-items:baseline}
.patrol-print-label{font-weight:700}
.patrol-print-section{margin:4mm 0;break-inside:auto}
.patrol-print-section-title{font-size:10.5pt;font-weight:700;margin:0 0 1.5mm;padding-bottom:1mm;border-bottom:1.4px solid #222}
.patrol-print-table{width:100%;border-collapse:collapse;table-layout:fixed}
.patrol-print-table th,.patrol-print-table td{border:1px solid #333;padding:1.55mm 1.8mm;text-align:left;vertical-align:top;overflow-wrap:anywhere}
.patrol-print-table th{font-weight:700;background:#ececec}
.patrol-print-table.center th,.patrol-print-table.center td{text-align:center;vertical-align:middle}
.patrol-print-table.compact th,.patrol-print-table.compact td{padding:1.15mm 1.35mm}
.patrol-print-table.dense{font-size:8.1pt}.patrol-print-table.dense th,.patrol-print-table.dense td{padding:.85mm 1mm}
.patrol-print-ward-block{border:2px solid #222;margin:0 0 3.5mm;break-inside:avoid}
.patrol-print-ward-head{display:flex;align-items:center;justify-content:space-between;gap:5mm;padding:1.8mm 2.4mm;border-bottom:2px solid #222;background:#e6e6e6;font-size:10.5pt;font-weight:700}
.patrol-print-empty{padding:3mm;border:1px solid #aaa;background:#fafafa;color:#555;font-style:italic}
.patrol-print-rich{min-height:5mm;overflow-wrap:anywhere}
.patrol-print-rich ul,.patrol-print-rich ol{margin:1mm 0;padding-left:6mm}
.patrol-print-two-col{display:grid;grid-template-columns:1fr .85fr;gap:12mm;align-items:end;margin-top:5mm}
.patrol-print-signature{justify-self:end;min-width:62mm}
.patrol-print-signature-line{display:inline-block;width:40mm;height:4mm;border-bottom:1px solid #111;vertical-align:bottom}
.patrol-print-footer{margin-top:6mm;padding-top:2mm;border-top:1px solid #777;font-size:8pt;color:#444;display:flex;justify-content:space-between;gap:8mm}
.patrol-print-footer span:last-child{text-align:right}
/* Fit the on-screen iframe on phones; physical A4 printing remains unchanged. */
@media screen and (max-width:820px){
  .patrol-print-page.roster-print-document{width:100%;min-height:0;margin:0;padding:4mm 2.5mm;box-shadow:none}
  .roster-print-document .patrol-print-table{table-layout:auto}
  .roster-print-document .patrol-print-table th,.roster-print-document .patrol-print-table td{overflow-wrap:anywhere}
  .roster-print-document .patrol-print-table td:last-child{white-space:nowrap;font-size:.85em}
  .roster-print-document .patrol-print-logo{width:15mm;height:15mm}
  .roster-print-document .patrol-print-title{font-size:15pt}
}
@media print{
  body{background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .patrol-print-page{width:auto;min-height:0;margin:0;padding:0;box-shadow:none}
}
`;

export function escapePrintHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;',
  }[ch]));
}

export function displayPrintDate(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  return match ? `${match[3]}/${match[2]}/${match[1]}` : String(iso || '');
}

export function printedStamp(value = new Date()) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone:'Asia/Hong_Kong', day:'2-digit', month:'2-digit', year:'numeric',
    hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false,
  }).format(value);
}

export function renderPatrolPrintFooter({ label, printedAt = new Date() } = {}) {
  const safeLabel = escapePrintHtml(label || 'Patrol Night');
  return `<footer class="patrol-print-footer"><span>${safeLabel}</span><span>Printed ${escapePrintHtml(printedStamp(printedAt))} HKT</span></footer>`;
}

export function renderPatrolPrintDocument({ title, subtitle = '', body = '', footerLabel = title, printedAt = new Date(), logoUrl = '', rosterFontSize = null, hideTitle = false } = {}) {
  const safeTitle = escapePrintHtml(title || 'Patrol Night');
  const fontSize = rosterFontSize === null ? null : Math.max(8, Math.min(14, Number(rosterFontSize) || 10));
  const rosterClass = fontSize === null ? '' : ' roster-print-document';
  const rosterStyle = fontSize === null ? '' : ` style="--roster-font-size:${fontSize}pt"`;
  const logo = logoUrl ? `<img class="patrol-print-logo" src="${escapePrintHtml(logoUrl)}" alt="Nurse Memo heart logo">` : '';
  // Last @page declaration applies to this standalone print document only.
  // Ward and Night Runner roster documents keep their established portrait format.
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeTitle}</title><style>${PATROL_PRINT_CSS}</style></head><body data-print-system="patrol-v2"><article class="patrol-print-page${rosterClass}"${rosterStyle}>${logo}${hideTitle ? '' : `<h1 class="patrol-print-title">${safeTitle}</h1>`}${subtitle ? `<div class="patrol-print-subtitle">${escapePrintHtml(subtitle)}</div>` : ''}${body}${renderPatrolPrintFooter({ label: footerLabel, printedAt })}</article></body></html>`;
}
