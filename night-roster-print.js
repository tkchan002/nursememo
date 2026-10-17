import {
  displayPrintDate,
  escapePrintHtml as esc,
  renderPatrolPrintDocument,
} from './patrol-print-theme.js';

export function renderNightStaffPrintHtml({ reportingDate, wardRosters = [], printedAt = new Date(), logoUrl = '', fontSize = 10 } = {}) {
  const content = wardRosters.map(row => {
    const nurses = row.nurses || [];
    const wardName = row.ward?.name || '';
    return `<section class="patrol-print-ward-block">
      <div class="patrol-print-ward-head"><span>${esc(wardName)}</span><span>${nurses.length} staff</span></div>
      ${nurses.length
        ? `<table class="patrol-print-table compact"><thead><tr><th style="width:20%">Rank</th><th>Name</th><th style="width:29%">Appointment Date</th></tr></thead><tbody>${nurses.map(nurse => `<tr><td>${esc(nurse.role)}</td><td>${esc(nurse.name)}</td><td>${esc(nurse.appointmentDate)}</td></tr>`).join('')}</tbody></table>`
        : '<div class="patrol-print-empty" style="border:0">No night staff saved for this shift.</div>'}
    </section>`;
  }).join('') || '<div class="patrol-print-empty">No ward roster data available.</div>';

  return renderPatrolPrintDocument({
    title: 'Night Staff List',
    subtitle: `Reporting Night: ${displayPrintDate(reportingDate)}`,
    body: content,
    footerLabel: 'Patrol Night · Night Staff List',
    printedAt,
    logoUrl, rosterFontSize: fontSize,
  });
}

export function renderNightRunnerPrintHtml({ reportingDate, runners = [], printedAt = new Date(), logoUrl = '', fontSize = 10 } = {}) {
  const content = runners.length
    ? `<table class="patrol-print-table compact"><thead><tr><th style="width:16%">Ward</th><th style="width:20%">Rank</th><th>Name</th><th style="width:29%">Appointment Date</th></tr></thead><tbody>${runners.map(nurse => `<tr><td><strong>${esc(nurse.ward?.name || '')}</strong></td><td>${esc(nurse.role)}</td><td>${esc(nurse.name)}</td><td>${esc(nurse.appointmentDate)}</td></tr>`).join('')}</tbody></table>`
    : '<div class="patrol-print-empty">No Night Runner recorded for this reporting night.</div>';

  return renderPatrolPrintDocument({
    title: 'Night Runner List',
    subtitle: `Reporting Night: ${displayPrintDate(reportingDate)}`,
    body: content,
    footerLabel: 'Patrol Night · Night Runner List',
    printedAt,
    logoUrl, rosterFontSize: fontSize,
  });
}
