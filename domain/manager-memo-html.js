/** Manager Night Memo's canonical editable document, independent of editor vendor. */
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
const MAIN = [
  'ward','admissionEC','admissionCC','transferIn','discharge','transferOut','death',
  'totalPatient','emptyBed','ventilator','bipap','hfnc','staff',
];
const INFECTION = [
  ['ward','Ward'], ['covid','COVID-19'], ['cre','CRE'], ['vre','VRE'], ['mdra','MDRA'],
  ['cd','CD'], ['influenza','Influenza'], ['hdCapd','No. of HD / CAPD case'], ['remarks','Remarks'],
];
function rows(list, keys) {
  return (list || []).map(row => `<tr>${keys.map(key => `<td>${escapeHtml(row[key] ?? '')}</td>`).join('')}</tr>`).join('');
}
function labelSection(title, body) {
  return `<section class="nm-document-section"><h2>${escapeHtml(title)}</h2><div>${body || '<p><br></p>'}</div></section>`;
}
export function renderEditableManagerMemoHtml(source = {}) {
  const h = source.header || {}, ct = source.ct || {}, s = source.signature || {};
  return `<h1 class="nm-document-title">${escapeHtml(source.title || 'Night Memo')}</h1>
<table class="nm-document-header"><tbody>
<tr><td><strong>From:</strong></td><td>N.O./APN, ${escapeHtml(h.fromName)}</td><td><strong>To:</strong></td><td>DOM/Medical (QEH)</td></tr>
<tr><td><strong>DECT Phone:</strong></td><td>${escapeHtml(h.dectPhone)}</td><td><strong>Date:</strong></td><td>${escapeHtml(h.date)}</td></tr>
<tr><td><strong>Call (Team):</strong></td><td>${escapeHtml(h.callTeam)}</td><td></td><td></td></tr>
</tbody></table>
<table class="nm-document-table nm-document-main"><thead>
<tr><th rowspan="2">Ward</th><th colspan="3">Admission</th><th colspan="3">Discharge</th><th rowspan="2">Total Patient</th><th rowspan="2">Empty Bed</th><th rowspan="2">Vent. Case</th><th rowspan="2">Bipap Case</th><th rowspan="2">HFNC Case</th><th rowspan="2">AM/PM Staff No.</th></tr>
<tr><th>E/C</th><th>C/C</th><th>T/I</th><th>Home</th><th>T/O</th><th>Death</th></tr>
</thead><tbody>${rows(source.mainTableRows, MAIN)}</tbody></table>
<h2>Infectious Case:</h2>
<table class="nm-document-table nm-document-infection"><thead><tr>${INFECTION.map(([,label])=>`<th>${escapeHtml(label)}</th>`).join('')}</tr></thead><tbody>${rows(source.infectionRows, INFECTION.map(([key])=>key))}</tbody></table>
${labelSection('Early bird:', source.earlyBirdHtml)}
${labelSection('Empty Bed:', source.emptyBedHtml)}
${labelSection('Additional Report:', source.additionalReportHtml)}
<p><strong>Total No. of CT scan done:</strong> ${escapeHtml(ct.total)}</p>
<p><strong>At 06:00</strong></p>
<table class="nm-document-table nm-document-ct"><thead><tr><th></th><th>General</th><th>Cohort</th></tr></thead><tbody>
<tr><th>Male</th><td>${escapeHtml(ct.maleGeneral)}</td><td>${escapeHtml(ct.maleCohort)}</td></tr>
<tr><th>Female</th><td>${escapeHtml(ct.femaleGeneral)}</td><td>${escapeHtml(ct.femaleCohort)}</td></tr>
</tbody></table>
<p class="nm-document-signature"><strong>${escapeHtml(s.label || 'Signature')}:</strong> _______________________</p>
<p><strong>N.O./APN:</strong> ${escapeHtml(s.name)}</p>
<p><strong>Designation:</strong> ${escapeHtml(s.designation || 'N.O./APN')}</p>`;
}
/**
 * Only retain elements/attributes used for word processing. Uses the browser's HTML
 * parser, never regex-based tag stripping. Fail closed outside a DOM environment.
 */
export function sanitizeManagerMemoHtml(html) {
  const input = String(html ?? '').slice(0, 750000);
  if (typeof document === 'undefined') return escapeHtml(input);
  const template = document.createElement('template');
  template.innerHTML = input;
  const allowed = new Set('H1 H2 H3 H4 P DIV SPAN B STRONG I EM U S SUB SUP BR HR UL OL LI BLOCKQUOTE TABLE THEAD TBODY TFOOT TR TH TD COLGROUP COL A FONT'.split(' '));
  const allowedStyle = new Set(['color','background-color','font-family','font-size','font-weight','font-style','text-decoration','text-align','vertical-align','line-height','margin-left','margin-right','padding-left','list-style-type','width']);
  const sanitizeNode = parent => {
    for (const node of [...parent.childNodes]) {
      if (node.nodeType === 8) { node.remove(); continue; }
      if (node.nodeType !== 1) { if (node.nodeType !== 3) node.remove(); continue; }
      if (!allowed.has(node.tagName)) {
        // Completely discard executable, external and embedded content.
        if (['SCRIPT','STYLE','SVG','IFRAME','OBJECT','EMBED','FORM','INPUT','BUTTON','TEXTAREA','VIDEO','AUDIO','MATH','LINK','META','IMG'].includes(node.tagName)) { node.remove(); continue; }
        sanitizeNode(node);
        node.replaceWith(...[...node.childNodes]);
        continue;
      }
      for (const attr of [...node.attributes]) {
        const name = attr.name.toLowerCase();
        if ((name === 'colspan' || name === 'rowspan') && ['TD','TH'].includes(node.tagName) && /^[1-9]\d?$/.test(attr.value)) continue;
        if (name === 'width' && ['COL','COLGROUP','TD','TH','TABLE'].includes(node.tagName) && /^(?:\d{1,3}%?|\d{1,4}px)$/.test(attr.value.trim())) continue;
        if (name === 'face' && node.tagName === 'FONT' && /^[\w\s,'"-]{1,80}$/.test(attr.value)) continue;
        if (name === 'color' && node.tagName === 'FONT' && /^(#[0-9a-f]{3,8}|[a-z]{3,20})$/i.test(attr.value)) continue;
        if (name === 'size' && node.tagName === 'FONT' && /^[1-7]$/.test(attr.value)) continue;
        if (name === 'href' && node.tagName === 'A' && /^(https?:|mailto:)/i.test(attr.value.trim())) continue;
        if (name === 'class' && /^nm-document-(?:title|table|header|main|infection|ct|section|signature)$/.test(attr.value)) continue;
        if (name === 'style') {
          const safe = attr.value.split(';').map(part => {
            const colon = part.indexOf(':');
            if (colon < 1) return '';
            const key = part.slice(0, colon).trim().toLowerCase();
            const val = part.slice(colon + 1).trim();
            if (!allowedStyle.has(key) || !val || /[<>\\]|url\s*\(|expression|var\s*\(|@import|!important/i.test(val)) return '';
            if (key === 'font-family' && !/^[\w\s,'"-]{1,80}$/.test(val)) return '';
            if (key !== 'font-family' && !/^[#\w\s().,%\-]{1,80}$/.test(val)) return '';
            return `${key}:${val}`;
          }).filter(Boolean).join(';');
          if (safe) node.setAttribute('style', safe); else node.removeAttribute(attr.name);
          continue;
        }
        node.removeAttribute(attr.name);
      }
      sanitizeNode(node);
    }
  };
  sanitizeNode(template.content);
  return template.innerHTML;
}
