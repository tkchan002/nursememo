import { renderManagerPrintDocument } from './manager-print-theme.js';
import { sanitizeManagerMemoHtml } from './domain/manager-memo-html.js';

// The saved editor HTML is the sole document rendered for both preview and print.
export function renderManagerMemoPrintHtml(memo = {}, { printedAt = new Date() } = {}) {
  const html = sanitizeManagerMemoHtml(memo.html || '');
  return renderManagerPrintDocument({
    title: 'Night Memo',
    hideTitle: true,
    body: `<div class="manager-memo-document">${html}</div>`,
    footerLabel: 'Patrol Night · Night Memo',
    printedAt,
  });
}
