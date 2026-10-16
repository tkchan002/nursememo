import { deletePrintJob, purgeExpiredPrintJobs, readPrintJob } from './services/print-job-service.js';

const params = new URLSearchParams(location.search);
const jobId = params.get('job');
purgeExpiredPrintJobs();
const job = readPrintJob(jobId);

if (!job) {
  renderMissingJob();
} else {
  renderJob(job);
}

function renderJob(printJob) {
  const parsed = new DOMParser().parseFromString(printJob.html, 'text/html');
  document.title = printJob.title || parsed.title || 'Printable Document';

  for (const node of Array.from(parsed.head.children)) {
    const tag = node.tagName?.toLowerCase();
    if (tag === 'style' || tag === 'link') document.head.append(node.cloneNode(true));
  }

  const originalBodyClass = parsed.body.getAttribute('class') || '';
  document.body.className = `${originalBodyClass} print-view-body`.trim();
  document.body.innerHTML = `
    <header class="print-view-toolbar" aria-label="Print controls">
      <button type="button" class="print-view-button secondary" id="printBackBtn">Back</button>
      <div class="print-view-title-wrap">
        <strong>${escapeHtml(printJob.title || 'Printable Document')}</strong>
        <span>Review the document, then use Print / PDF.</span>
      </div>
      <button type="button" class="print-view-button primary" id="printActionBtn">Print / PDF</button>
    </header>
    <main class="print-view-viewport" id="printViewport">
      <div class="print-view-stage" id="printStage">
        <div class="print-document-host" id="printDocumentHost"></div>
      </div>
    </main>
  `;

  document.getElementById('printDocumentHost').append(...Array.from(parsed.body.childNodes).map(node => node.cloneNode(true)));

  document.getElementById('printActionBtn').addEventListener('click', () => {
    window.print();
  });
  document.getElementById('printBackBtn').addEventListener('click', () => {
    deletePrintJob(printJob.id);
    location.assign(printJob.returnUrl || './');
  });

  fitPreview();
  window.addEventListener('resize', fitPreview, { passive: true });
  window.addEventListener('orientationchange', fitPreview, { passive: true });
  window.addEventListener('beforeprint', resetPreviewScale);
  window.addEventListener('afterprint', fitPreview);
}

function fitPreview() {
  const viewport = document.getElementById('printViewport');
  const stage = document.getElementById('printStage');
  const host = document.getElementById('printDocumentHost');
  if (!viewport || !stage || !host) return;

  host.style.transform = 'none';
  stage.style.height = 'auto';
  const available = Math.max(240, viewport.clientWidth - 20);
  const naturalWidth = Math.max(host.scrollWidth, host.getBoundingClientRect().width);
  const scale = naturalWidth > available ? Math.max(0.35, available / naturalWidth) : 1;
  host.style.transformOrigin = 'top center';
  host.style.transform = scale < 0.999 ? `scale(${scale})` : 'none';
  stage.style.height = `${Math.ceil(host.scrollHeight * scale)}px`;
  stage.dataset.scale = String(scale);
}

function resetPreviewScale() {
  const stage = document.getElementById('printStage');
  const host = document.getElementById('printDocumentHost');
  if (!stage || !host) return;
  host.style.transform = 'none';
  stage.style.height = 'auto';
}

function renderMissingJob() {
  document.title = 'Printable document unavailable';
  document.body.className = 'print-view-body';
  document.body.innerHTML = `
    <main class="print-view-message error" role="alert">
      <strong>Printable document unavailable</strong>
      <span>The temporary print job is missing or has expired. Return to Nurse Memo and open Print again.</span>
      <button type="button" class="print-view-button primary" id="printFallbackBack">Back</button>
    </main>
  `;
  document.getElementById('printFallbackBack').addEventListener('click', () => {
    if (document.referrer && new URL(document.referrer).origin === location.origin) history.back();
    else location.assign('./');
  });
}


function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[char]));
}
