import { requireRole, signOut } from '../services/auth-service.js';
import { qs, qsa, esc } from '../core/dom.js';
import { formatDateTime, toDisplayDate } from '../core/dates.js';
import { setAppHeader } from '../components/app-shell.js';
import { CONFIG } from '../config.js';
import { initManagerTabs } from '../components/manager-tabs.js';
import {
  DB_MODE,
  getManagerMemo,
  getManagerDocxBytes,
  saveManagerDocxRecovery,
  saveManagerDocxRevision,
  listManagerMemoRevisions,
  getManagerMemoRevision,
  listManagerMemoArchive,
  createManagerMemoCheckpoint,
  listManagerMemoCheckpoints,
  getManagerMemoCheckpoint,
} from '../data/index.js';
import { reportSubmittedAt } from '../domain/report-session.js';
import { MEMO_LABELS } from '../domain/report-cycle.js';
import { wardSubmissionStates } from '../domain/submission-status.js';
import {
  buildManagerMemoData,
  isReportNewerThanSource,
  reportingNightDate,
  sourceSnapshotFromBundle,
} from '../domain/manager-memo.js';
import { loadManagerCurrent } from '../services/report-service.js';
import { createManagerDocumentEditor } from '../editor/manager-ranuts.js';
import { buildManagerWardInformation } from '../domain/manager-ward-information.js';

const $ = qs;
const $$ = qsa;

const state = {
  access: null,
  bundle: [],
  items: [],
  allWards: [],
  refreshedAt: null,
  reportingDate: null,
  memo: null,
  history: [],
  archive: [],
  archiveSelectedDate: null,
  archiveMemo: null,
  archiveRevisions: [],
  archiveRequestId: 0,
  archiveCheckpoints: [],
  archiveSelectedKind: null,
  archiveSelectedId: null,
  historyMode: false,
  historyReturnMode: 'workspace',
  editorOpen: false,
  dirty: false,
  recoverySaving: false,
  officialSaving: false,
  saveTimer: null,
  recoveryTask: null,
  rendering: false,
  conflicted: false,
  boundaryExpired: false,
  lastOfficialType: null,
  editGeneration: 0,
  savedGeneration: 0,
  activeTab: 'submission',
  historyReturnTab: 'submission',
  wardPreviewContext: null,
  pendingDocxBytes: null,
  currentPdfUrl: null,
  archiveLoadSequence: 0,
};

let persistenceTail = Promise.resolve();
let managerTabs = null;
let wardPrintModulePromise = null;
let memoEditorInstance = null;
let memoEditorLoading = null;
let memoPrewarmPromise = null;
let memoPrewarmKey = null;
let memoPrewarmed = null;
let archiveEditorInstance = null;

bootstrap().catch(showFatal);

async function bootstrap() {
  managerTabs = initManagerTabs({
    initialTab: 'submission',
    onChange: tab => { state.activeTab = tab; },
  });
  bindStaticControls();
  setStatus('Loading Manager workspace…', 'info');
  state.access = await requireRole('manager');
  if (!state.access) return;

  setAppHeader({
    title: CONFIG.APP_NAME,
    subtitle: 'Patrol Night · Night operations and memo workspace',
    access: state.access,
    mode: DB_MODE,
  });

  // Relocate the still-empty iframe container BEFORE loading its source.
  // Moving a live iframe can reset its browsing context and discard its editor.
  setMemoEditorWorkspaceVisible(false);
  // Editor resources can warm while ward data and workspace requests are pending.
  // Never start before authorization is confirmed.
  scheduleMemoEditorPreload();
  state.reportingDate = reportingNightDate();
  await refreshWardStatus({ initial: true });
  await loadWorkspace();
  renderSubmissionMonitor();
  renderWardInformation();
  renderWorkspace();
  clearStatus();
  // When possible, also open the actual document invisibly in the SAME
  // editor iframe. This moves conversion/WASM startup ahead of the user's click.
  scheduleMemoDocumentPreopen();
}

function bindStaticControls() {
  $('#logoutBtn').addEventListener('click', signOut);
  $('#managerGlobalHistoryBtn').addEventListener('click', enterHistoryMode);
  $('#refreshStatusBtn').addEventListener('click', () => refreshWardStatus());
  $('#refreshWardInformationBtn').addEventListener('click', () => refreshWardStatus());
  $('#regenerateBtn').addEventListener('click', regenerateFromWardData);

  $('#continueDraftBtn').addEventListener('click', () => { void openExistingDraft().catch(() => {}); });
  $('#startNewBtn').addEventListener('click', () => { void startNewDraft().catch(() => {}); });
  $('#workspaceHistoryBtn').addEventListener('click', enterHistoryMode);
  $('#backWorkspaceBtn').addEventListener('click', backToWorkspace);
  $('#retryMemoEditorBtn').addEventListener('click', () => { void renderEditor({keepDirty:true}).catch(() => {}); });

  $('#saveMemoBtn').addEventListener('click', saveDraftVersion);
  $('#historyBtn').addEventListener('click', enterHistoryMode);
  $('#previewMemoBtn').addEventListener('click', previewCurrentMemo);
  $('#printMemoBtn').addEventListener('click', printFinalVersion);

  $('#closeManagerHistoryBtn').addEventListener('click', exitHistoryMode);
  $('#archiveUseAsDraftBtn').addEventListener('click', restoreSelectedArchiveAsDraft);
  $('#printWardMemoBtn').addEventListener('click', printOpenWardMemo);

  $('#managerHistoryNightList').addEventListener('click', async event => {
    const button = event.target.closest('[data-archive-date]');
    if (!button) return;
    await selectArchiveNight(button.dataset.archiveDate);
  });

  $('#archiveRevisionList').addEventListener('click', async event => {
    const button = event.target.closest('[data-archive-revision-id], [data-archive-recovery]');
    if (!button) return;
    if (button.dataset.archiveRecovery != null) await selectArchiveRecovery();
    else await selectArchiveRevision(button.dataset.archiveRevisionId);
  });

  $('#archiveCheckpointList').addEventListener('click', async event => {
    const button = event.target.closest('[data-checkpoint-action]');
    if (!button) return;
    const checkpointId = button.dataset.checkpointId;
    if (button.dataset.checkpointAction === 'view') await selectArchiveCheckpoint(checkpointId);
    if (button.dataset.checkpointAction === 'restore') await useCheckpointAsDraft(checkpointId);
  });

  $$('[data-close-modal]').forEach(button => {
    button.addEventListener('click', () => {
      const el = document.getElementById(button.dataset.closeModal);
      if (el) el.hidden = true;
    });
  });

  window.addEventListener('beforeunload', event => {
    if (!state.dirty && !state.recoverySaving && !state.officialSaving) return;
    event.preventDefault();
    event.returnValue = '';
  });
}
async function loadWorkspace() {
  state.memo = await getManagerMemo(state.reportingDate);
  state.history = await listManagerMemoRevisions(state.reportingDate);
  state.lastOfficialType = state.history[0]?.revision_type || null;
}

async function refreshHistory() {
  state.history = await listManagerMemoRevisions(state.reportingDate);
  renderWorkspace();
}

async function refreshWardStatus({ initial = false } = {}) {
  if (!initial) setStatus('Refreshing ward submission status…', 'info');
  try {
    const current = await loadManagerCurrent();
    state.bundle = current.bundle || [];
    state.items = current.items || [];
    state.allWards = current.allWards || state.bundle.map(entry => entry.ward);
    state.refreshedAt = new Date();
    renderSubmissionMonitor();
    renderWardInformation();
    if (!initial) clearStatus();
  } catch (error) {
    setStatus(`Unable to refresh ward status: ${error.message || error}`, 'error');
    throw error;
  }
}

function submissionWindowLabel() {
  return `Reporting night ${toDisplayDate(state.reportingDate)} · PM 21:00 and Night 04:00 (HKT) · no 120-minute expiry`;
}

function memoSourceForWard(wardId, type) {
  return (state.memo?.source_snapshot || []).find(row => row.ward_id === wardId && row.memo_type === type) || null;
}

function currentReportForWard(wardId, type) {
  const entry = state.bundle.find(item => item.ward?.id === wardId);
  return type === 'pm' ? entry?.pmReport : entry?.nightReport;
}

function isNewerThanDocument(wardId) {
  if (!state.memo) return false;
  return ['pm', 'night'].some(type => isReportNewerThanSource(currentReportForWard(wardId, type), memoSourceForWard(wardId, type)));
}

function hasNewerWardData() {
  if (!state.memo) return false;
  return state.allWards.some(ward => isNewerThanDocument(ward.id));
}

function renderSubmissionMonitor() {
  const label = $('#submissionWindowLabel');
  if (label) label.textContent = submissionWindowLabel();
  const submittedCount = state.bundle.reduce((n, entry) => n + Number(!!entry.pmReport) + Number(!!entry.nightReport), 0);
  const total = (state.allWards.length || state.bundle.length) * 2;
  if ($('#submissionCount')) $('#submissionCount').textContent = `${submittedCount} / ${total} submissions`;
  if ($('#sourceChangeNotice')) $('#sourceChangeNotice').hidden = !hasNewerWardData();

  const body = $('#submissionRows');
  if (!body) return;
  const statusCell = (status, label) => `<span class="memo-status memo-status--${status.state}" aria-label="${esc(label)} Memo: ${esc(status.label)}">${esc(label)}: ${esc(status.label)}</span>`;
  body.innerHTML = state.allWards.map(ward => {
    const entry = state.bundle.find(item => item.ward?.id === ward.id) || {};
    const status = wardSubmissionStates(entry);
    const missing = status.missingTypes;
    const newer = isNewerThanDocument(ward.id);
    const sourceLabel = newer ? 'Newer submission available' :
      !state.memo ? 'No Manager draft' : missing.length ? 'Incomplete source' : 'No new source';
    return `<tr>
      <td><b>${esc(ward.name)}</b></td>
      <td>${statusCell(status.pm, 'PM')}</td>
      <td>${statusCell(status.night, 'Night')}</td>
      <td>${missing.length ? esc(`Missing ${missing.map(x => MEMO_LABELS[x]).join(' and ')}`) : 'Complete'}</td>
      <td>${esc(sourceLabel)}</td>
      <td>${['pm','night'].filter(type => entry[type === 'pm' ? 'pmReport' : 'nightReport'])
        .map(type => `<button type="button" class="pill ward-memo-view-btn" data-ward-id="${esc(ward.id)}" data-memo-type="${type}">View ${type === 'pm' ? 'PM' : 'Night'}</button>`).join(' ')}</td>
    </tr>`;
  }).join('') || '<tr><td colspan="6">No active wards found.</td></tr>';
  $$('.ward-memo-view-btn', body).forEach(button => {
    button.addEventListener('click', () => openWardMemoPreview(button.dataset.wardId, button.dataset.memoType));
  });
}

function actorLabel() {
  const access = state.access || {};
  return String(access.display_name || access.name || access.login_id || access.username || access.email || 'Manager');
}

function latestRevision(type) {
  return state.history.find(row => row.revision_type === type) || null;
}

function formatRevisionStamp(row) {
  return row?.created_at ? formatDateTime(row.created_at, 'en-GB') : '—';
}

function renderWorkspace() {
  const panel = $('#memoWorkspacePanel');
  if (!panel) return;
  $('#workspaceDate').textContent = `Reporting night: ${state.reportingDate || ''}`;

  const draft = latestRevision('draft');
  const final = latestRevision('final');
  const recovery = state.memo;
  const summary = $('#workspaceSummary');

  if (!recovery && !state.history.length) {
    summary.innerHTML = '<div class="workspace-state">No Night Memo has been created for this reporting night.</div><div class="workspace-empty">Start a Night Memo to generate a working document from the current ward submissions.</div>';
    $('#continueDraftBtn').hidden = true;
    $('#startNewBtn').textContent = 'Start Night Memo';
    return;
  }

  const parts = [];
  if (recovery) {
    parts.push('<div class="workspace-state">Working draft available</div>');
    parts.push(`<div class="workspace-meta">Recovery copy: ${esc(recovery.updated_at ? formatDateTime(recovery.updated_at, 'en-GB') : 'available')}</div>`);
  }
  if (draft) parts.push(`<div class="workspace-meta">Latest Save: Draft #${esc(draft.revision_number)} · ${esc(formatRevisionStamp(draft))}${draft.created_by_label ? ` · ${esc(draft.created_by_label)}` : ''}</div>`);
  if (final) parts.push(`<div class="workspace-meta">Latest Print: Final #${esc(final.revision_number)} · ${esc(formatRevisionStamp(final))}${final.created_by_label ? ` · ${esc(final.created_by_label)}` : ''}</div>`);
  if (!draft && !final) parts.push('<div class="workspace-meta">No saved Draft or Final history yet. The working copy is recovery data only.</div>');
  summary.innerHTML = parts.join('');

  $('#continueDraftBtn').hidden = !recovery;
  $('#startNewBtn').textContent = recovery ? 'Start New' : 'Start Night Memo';
}

// DOCX editing is a dedicated full-viewport workspace. The surrounding Manager
// tabs remain available once the Manager leaves the document editor.
function setMemoEditorWorkspaceVisible(visible) {
  const area = $('#editorArea');
  // A fixed editor nested inside a hidden Manager tab has zero layout size.
  // Keep the sole iframe directly under body for full-size background import.
  if (area.parentElement !== document.body) document.body.appendChild(area);
  area.hidden = !visible;
  area.classList.remove('memo-editor-background');
  area.inert = !visible;
  if (visible) area.removeAttribute('aria-hidden');
  else area.setAttribute('aria-hidden', 'true');
  document.body.classList.toggle('docx-editor-active', Boolean(visible));
  const inlineStatus = $('#memoEditorStatus');
  const globalStatus = $('#managerStatus');
  if (inlineStatus) {
    inlineStatus.hidden = !visible || !globalStatus || globalStatus.hidden;
    if (!inlineStatus.hidden) {
      inlineStatus.textContent = globalStatus.textContent;
      inlineStatus.className = `memo-editor-status ${globalStatus.classList.contains('error') ? 'error' : globalStatus.classList.contains('warning') ? 'warning' : 'info'}`;
    }
  }
}

async function openExistingDraft() {
  if (!state.memo) return;
  state.editorOpen = true;
  $('#memoWorkspacePanel').hidden = true;
  setMemoEditorWorkspaceVisible(true);
  await renderEditor();
  renderMemoState();
}

async function startNewDraft() {
  if (!ensureReportingNightCurrent()) return;
  if (state.memo) {
    const ok = confirm('Start a new working draft? Existing Draft/Final history will remain. A safety checkpoint of the current working copy will be kept before it is replaced.');
    if (!ok) return;
    try {
      await flushRecovery();
      await checkpointCurrentWorkingCopy('before_start_new');
    } catch (_) { return; }
  }

  const docxBytes = await generateNewDocx(buildManagerMemoData({
    bundle: state.bundle,
    items: state.items,
    reportingDate: state.reportingDate,
  }));
  state.pendingDocxBytes = docxBytes;
  const document = { version:5, format:'docx', document_id:null };
  const sourceSnapshot = sourceSnapshotFromBundle(state.bundle);

  state.memo = {
    ...(state.memo || {}),
    reporting_date: state.reportingDate,
    document,
    source_snapshot: sourceSnapshot,
    status: 'draft',
    revision: state.memo?.revision || 0,
  };
  state.conflicted = false;
  state.lastOfficialType = null;
  state.editorOpen = true;
  state.dirty = false;
  state.editGeneration = state.savedGeneration;
  markDirty({ schedule: false });

  $('#memoWorkspacePanel').hidden = true;
  setMemoEditorWorkspaceVisible(true);
  await renderEditor({ keepDirty: true });
  await saveRecoveryNow({ force: true });
  renderSubmissionMonitor();
  renderMemoState();
}

async function backToWorkspace() {
  if (!state.conflicted && !state.boundaryExpired) {
    try { await flushRecovery(); } catch (_) { return; }
  }
  state.editorOpen = false;
  setMemoEditorWorkspaceVisible(false);
  $('#memoWorkspacePanel').hidden = false;
  await refreshHistory();
  renderWorkspace();
}
// Load the DOCX generator only when Start New/Regenerate is requested.
// Failure to load the optional editor generator cannot block Submission Status or Night Staffing.
async function generateNewDocx(model) {
  const { buildManagerDocxBytes } = await import('../documents/manager-docx.js');
  return buildManagerDocxBytes(model);
}

// document:ready only means the UI is loaded. Cold document:opened must also
// load and instantiate the x2t converter, which is the expensive second stage.
function scheduleMemoEditorPreload() {
  const start = () => {
    void ensureMemoEditor().catch(() => {});
    // A browser HTTP cache entry for the small gzip file is useful even if a
    // document cannot be opened until after workspace data finishes loading.
    if (typeof window.DecompressionStream === 'function' && !navigator.connection?.saveData) {
      const wasmUrl = new URL('../office/sdkjs/common/wasm/x2t/x2t.wasm.gz', import.meta.url);
      void fetch(wasmUrl, { cache: 'force-cache', credentials: 'same-origin' })
        .then(response => { if (!response.ok) throw new Error(`WASM prefetch: ${response.status}`); return response.blob(); })
        .catch(() => {}); // Speed-up only; never block a real document open.
    }
  };
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(start, { timeout: 1200 });
  } else {
    window.setTimeout(start, 80);
  }
}

function memoDocumentWarmKey() {
  if (state.pendingDocxBytes) return `generated:${JSON.stringify(buildManagerMemoData({
    bundle: state.bundle, items: state.items, reportingDate: state.reportingDate,
  }))}`;
  if (state.memo?.document?.document_id) return `saved:${state.memo.document.document_id}`;
  if (state.memo && state.memo.document) return null; // Unknown saved document identity: do not guess.
  return `generated:${JSON.stringify(buildManagerMemoData({
    bundle: state.bundle, items: state.items, reportingDate: state.reportingDate,
  }))}`;
}

function scheduleMemoDocumentPreopen() {
  const start = () => { void preopenMemoInBackground().catch(() => {}); };
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(start, { timeout: 1500 });
  else window.setTimeout(start, 100);
}

async function preopenMemoInBackground() {
  if (memoPrewarmPromise || state.editorOpen) return memoPrewarmPromise;
  // Skip speculative 280+ MiB conversion on constrained devices. The normal
  // foreground open still works without any background work.
  if (navigator.connection?.saveData || (navigator.deviceMemory && navigator.deviceMemory < 4)) return;
  const key = memoDocumentWarmKey();
  if (!key) return;
  const docRef = state.memo?.document?.document_id ? state.memo.document : null;
  // Preserve correct viewport dimensions without showing an editor or
  // allowing keyboard/pointer input before the Manager opens Night Memo.
  const area = $('#editorArea');
  if (area.parentElement !== document.body) document.body.appendChild(area);
  area.classList.add('memo-editor-background');
  area.inert = true;
  area.setAttribute('aria-hidden', 'true');
  area.hidden = false;
  const startedAt = performance.now();
  memoPrewarmKey = key;
  memoPrewarmPromise = (async () => {
    const [editor, bytes] = await Promise.all([
      ensureMemoEditor(),
      docRef ? getManagerDocxBytes(docRef) : generateNewDocx(buildManagerMemoData({
        bundle: state.bundle, items: state.items, reportingDate: state.reportingDate,
      })),
    ]);
    if (memoDocumentWarmKey() !== key) return;
    await editor.open(bytes, { readonly: Boolean(state.conflicted || state.boundaryExpired) });
    if (memoDocumentWarmKey() === key) {
      memoPrewarmed = { key, editor, bytes };
      console.info(`[Nurse Memo performance] Background document opened in ${Math.round(performance.now() - startedAt)} ms`);
    }
  })().catch(error => {
    // The foreground path handles and displays errors with a Retry button.
    console.info('[Nurse Memo performance] Background document preparation deferred:', error.message || error);
  }).finally(() => {
    // If no one has entered the editor, keep its real dimensions and its
    // already-loaded document, but make it visually and interactively absent.
    if (!state.editorOpen) area.classList.add('memo-editor-background');
  });
  return memoPrewarmPromise;
}

function setMemoOpeningState(stage, { error = false } = {}) {
  const overlay = $('#memoEditorLoading');
  if (!overlay) return;
  overlay.hidden = false;
  overlay.classList.toggle('memo-editor-load-error', error);
  const text = $('#memoEditorLoadingText');
  if (text) text.textContent = stage;
  const retry = $('#retryMemoEditorBtn');
  if (retry) retry.hidden = !error;
}

function clearMemoOpeningState() {
  const overlay = $('#memoEditorLoading');
  if (overlay) overlay.hidden = true;
}

async function ensureMemoEditor() {
  if (memoEditorInstance) return memoEditorInstance;
  if (!memoEditorLoading) {
    const candidate = createManagerDocumentEditor('#memoEditor', () => {
      if (!state.rendering && state.editorOpen) markDirty();
    }, { onNativeExport: file => handleNativeEditorExport(file).catch(error =>
      setStatus(`Unable to download Night Memo: ${error.message || error}`, 'error')) });
    memoEditorLoading = candidate.ready().then(() => {
      memoEditorInstance = candidate;
      return candidate;
    }).catch(error => {
      // A failed editor initialisation must not leave behind a cached,
      // permanently unusable iframe for subsequent open attempts.
      candidate.destroy();
      throw error;
    });
  }
  try { return await memoEditorLoading; }
  catch (error) { memoEditorLoading = null; memoEditorInstance = null; throw error; }
}

async function renderEditor({keepDirty=false}={}) {
  if(!state.memo)return;
  state.rendering=true;
  const previousDirty=state.dirty;
  setMemoOpeningState('Preparing document editor…');
  const userOpenStart = performance.now();
  try{
    // Reuse the background document AND its source bytes, avoiding a second
    // Supabase read while the conversion finishes. A stale or unsuccessful
    // background job falls back to the original source read/open path.
    const desiredKey = memoDocumentWarmKey();
    const bytesPromise = state.pendingDocxBytes ? Promise.resolve(state.pendingDocxBytes) :
      (memoPrewarmPromise && memoPrewarmKey === desiredKey) ?
        memoPrewarmPromise.then(() => memoPrewarmed?.key === desiredKey ?
          memoPrewarmed.bytes : getManagerDocxBytes(state.memo.document)) :
        getManagerDocxBytes(state.memo.document);
    const [editor, bytes] = await Promise.all([ensureMemoEditor(), bytesPromise]);
    setMemoOpeningState('Opening Night Memo…');
    // Join an in-flight background import instead of racing it or converting
    // the same DOCX a second time. A stale/failed import falls back to open().
    if (memoPrewarmPromise) await memoPrewarmPromise;
    if (memoPrewarmed?.editor !== editor || memoPrewarmed.key !== desiredKey) {
      await editor.open(bytes,{readonly:state.conflicted||state.boundaryExpired||state.officialSaving||state.historyMode});
    }
    memoPrewarmed = null;
    setEditingEnabled(!state.conflicted&&!state.boundaryExpired&&!state.officialSaving&&!state.historyMode);
    state.dirty=keepDirty?previousDirty:false;
    if(!keepDirty){state.editGeneration=0;state.savedGeneration=0;}
    updateSaveState();
    clearMemoOpeningState();
    console.info(`[Nurse Memo performance] Night Memo visible after ${Math.round(performance.now()-userOpenStart)} ms`);
  }catch(error){
    setMemoOpeningState(`Unable to open Night Memo: ${error.message||error}`,{error:true});
    setStatus(`Unable to open Night Memo DOCX: ${error.message||error}`,'error');
    $('#saveMemoBtn').disabled=true;
    $('#printMemoBtn').disabled=true;
    // Abort Start New/recovery when document opening did not succeed.
    throw error;
  }finally{state.rendering=false;}
}

async function serializeDocument() {
  const editor=await ensureMemoEditor();
  return editor.export('DOCX');
}

function ensureReportingNightCurrent() {
  const current = reportingNightDate();
  if (current === state.reportingDate) return true;
  state.boundaryExpired = true;
  clearTimeout(state.saveTimer);
  setEditingEnabled(false);
  setStatus(`A new reporting night (${current}) has started. This page is still attached to ${state.reportingDate}. Reload Manager before saving or printing.`, 'error');
  renderMemoState();
  updateSaveState();
  return false;
}

function enqueuePersistence(task) {
  const run = persistenceTail.then(task, task);
  persistenceTail = run.catch(() => {});
  return run;
}

function markDirty({ schedule = true } = {}) {
  if (!state.memo || state.conflicted || state.boundaryExpired || state.historyMode) return;
  state.editGeneration += 1;
  state.dirty = true;
  state.lastOfficialType = null;
  renderMemoState();
  updateSaveState();
  clearTimeout(state.saveTimer);
  if (schedule) state.saveTimer = setTimeout(() => saveRecoveryNow().catch(() => {}), 9000);
}

function updateSaveState(message = '') {
  const el = $('#saveState');
  if (!el) return;
  if (message) { el.textContent = message; return; }
  if (state.boundaryExpired) el.textContent = 'New reporting night — reload required';
  else if (state.conflicted) el.textContent = 'Save conflict — reload required';
  else if (state.officialSaving) el.textContent = 'Saving version…';
  else if (state.recoverySaving) el.textContent = 'Recovery saving…';
  else if (state.dirty) el.textContent = 'Unsaved changes';
  else if (state.memo?.updated_at) el.textContent = `Recovery saved ${formatDateTime(state.memo.updated_at, 'en-GB')}`;
  else el.textContent = 'Ready';
}

async function saveRecoveryNow({ force = false } = {}) {
  if (!state.memo) return state.memo;
  if (state.conflicted) throw new Error('MANAGER_MEMO_CONFLICT');
  if (state.boundaryExpired) throw new Error('REPORTING_NIGHT_CHANGED');
  if (!ensureReportingNightCurrent()) throw new Error('REPORTING_NIGHT_CHANGED');
  if (!state.dirty && !force) return state.memo;
  if (state.recoveryTask) return state.recoveryTask;

  clearTimeout(state.saveTimer);
  const task = enqueuePersistence(async () => {
    if (!state.memo || state.conflicted || state.boundaryExpired) return state.memo;
    if (!state.dirty && !force) return state.memo;
    if (!ensureReportingNightCurrent()) throw new Error('REPORTING_NIGHT_CHANGED');

    const generation = state.editGeneration;
    const bytes = state.editorOpen ? await serializeDocument() : state.pendingDocxBytes || await getManagerDocxBytes(state.memo.document);
    state.recoverySaving = true;
    updateSaveState();
    try {
      const saved = await saveManagerDocxRecovery({
        reportingDate: state.reportingDate,
        bytes,
        sourceSnapshot: state.memo.source_snapshot || [],
        expectedRevision: state.memo.revision || 0,
      });
      state.memo = saved;
      state.pendingDocxBytes = bytes;
      state.savedGeneration = Math.max(state.savedGeneration, generation);
      state.dirty = state.editGeneration > state.savedGeneration;
      renderWorkspace();
      renderMemoState();
      return saved;
    } catch (error) {
      handleSaveError(error, 'recovery');
      throw error;
    } finally {
      state.recoverySaving = false;
      updateSaveState();
    }
  });

  state.recoveryTask = task;
  try {
    return await task;
  } finally {
    if (state.recoveryTask === task) state.recoveryTask = null;
    if (state.dirty && !state.officialSaving && !state.conflicted && !state.boundaryExpired) {
      clearTimeout(state.saveTimer);
      state.saveTimer = setTimeout(() => saveRecoveryNow().catch(() => {}), 150);
    }
  }
}

async function flushRecovery() {
  clearTimeout(state.saveTimer);
  while (true) {
    if (state.conflicted) throw new Error('MANAGER_MEMO_CONFLICT');
    if (state.boundaryExpired || !ensureReportingNightCurrent()) throw new Error('REPORTING_NIGHT_CHANGED');
    if (state.recoveryTask) await state.recoveryTask;
    if (!state.dirty) return state.memo;
    await saveRecoveryNow({ force: true });
  }
}

async function checkpointCurrentWorkingCopy(reason) {
  if (!state.memo?.id) return null;
  return createManagerMemoCheckpoint({
    reportingDate: state.reportingDate,
    reason,
    actorLabel: actorLabel(),
  });
}

async function saveOfficialRevision(revisionType, reason) {
  if (!state.memo || state.conflicted || state.boundaryExpired || state.officialSaving) return null;
  if (!ensureReportingNightCurrent()) return null;

  clearTimeout(state.saveTimer);
  state.officialSaving = true;
  setEditingEnabled(false);
  updateSaveState();
  renderMemoState();
  try {
    await flushRecovery();
    const generation = state.editGeneration;
    const bytes = await serializeDocument();
    // A failed PDF export must never create a misleading Final revision.
    const finalPdf = revisionType==='final' ? await memoEditorInstance.export('PDF') : null;
    const result = await enqueuePersistence(() => saveManagerDocxRevision({
      reportingDate: state.reportingDate,
      bytes,
      sourceSnapshot: state.memo.source_snapshot || [],
      expectedRevision: state.memo.revision || 0,
      revisionType,
      reason,
      actorLabel: actorLabel(),
    }));
    state.memo = result.memo;
    state.pendingDocxBytes = bytes;
    state.savedGeneration = Math.max(state.savedGeneration, generation);
    state.dirty = state.editGeneration > state.savedGeneration;
    state.lastOfficialType = revisionType;
    state.history = [result.revision, ...state.history.filter(row => row.id !== result.revision.id)];
    renderMemoState();
    renderWorkspace();
    updateSaveState();
    return {...result,finalPdf};
  } catch (error) {
    handleSaveError(error, revisionType);
    throw error;
  } finally {
    state.officialSaving = false;
    if (state.editorOpen && !state.historyMode && !state.conflicted && !state.boundaryExpired) setEditingEnabled(true);
    renderMemoState();
    updateSaveState();
  }
}

function handleSaveError(error, kind) {
  const text = `${error?.message || error}`;
  if (/MANAGER_MEMO_CONFLICT|changed in another window|revision/i.test(text)) {
    state.conflicted = true;
    clearTimeout(state.saveTimer);
    setStatus('This Night Memo was changed in another window. Your current screen has not been overwritten. Reload the page before saving or printing.', 'error');
    renderMemoState();
  } else {
    setStatus(`Unable to save Night Memo ${kind}: ${text}`, 'error');
  }
  updateSaveState('Save failed');
}

async function saveDraftVersion() {
  const result = await saveOfficialRevision('draft', 'save');
  if (!result) return;
  setStatus(`Draft #${result.revision.revision_number} saved.`, 'info');
  setTimeout(clearStatus, 2200);
}

async function printFinalVersion() {
  const result=await saveOfficialRevision('final','print');
  if(!result)return;
  setStatus(`Final #${result.revision.revision_number} saved. Open the PDF preview to print or download.`, 'info');
  showPdfPreview(result.finalPdf,`Final #${result.revision.revision_number} · Night Memo`);
}
async function previewCurrentMemo() {
  if(!state.memo)return;
  try{
    setStatus('Creating PDF preview…','info');
    const editor=await ensureMemoEditor();
    const blob=await editor.export('PDF');
    showPdfPreview(blob,'Night Memo Preview');clearStatus();
  }catch(error){setStatus(`PDF preview failed: ${error.message||error}`,'error');}
}
/** Receive a completed native ONLYOFFICE File > Download As export.
 * The converter has already run inside the editor: do not trigger a second
 * export or create an official Final revision. Keep the PDF preview as a
 * fallback when a browser blocks an asynchronous automatic download.
 */
async function handleNativeEditorExport(file, { history = false } = {}) {
  if (!(file instanceof Blob)) throw new Error('The document editor returned no file.');
  const originalName = String(file.name || '');
  const ext = originalName.split('.').pop()?.toLowerCase();
  const supported = new Set(['pdf', 'docx', 'rtf', 'txt', 'odt', 'html']);
  if (!supported.has(ext)) {
    setStatus(`Editor exported an unsupported file type: ${ext || 'unknown'}.`, 'error');
    return;
  }
  const date = history ? (state.archiveSelectedDate || state.reportingDate) : state.reportingDate;
  const outputName = `Night-Memo-${date}.${ext}`;
  if (ext === 'pdf') {
    const magic = new Uint8Array(await file.slice(0, 5).arrayBuffer());
    if (String.fromCharCode(...magic) !== '%PDF-') {
      setStatus('The editor returned an invalid PDF. Download cancelled.', 'error');
      return;
    }
    showPdfPreview(file, history ? 'Historical Night Memo PDF' : 'Night Memo PDF');
    const link = $('#downloadMemoPdfBtn');
    link.download = outputName;
    link.click();
    return;
  }
  if (ext === 'docx') {
    const header = new Uint8Array(await file.slice(0, 2).arrayBuffer());
    if (header[0] !== 0x50 || header[1] !== 0x4b) {
      setStatus('The editor returned an invalid DOCX. Download cancelled.', 'error');
      return;
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = outputName;
    anchor.hidden = true;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    // Do not revoke immediately: Firefox/Safari may consume the URL later.
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
}
function showPdfPreview(blob,title) {
  if(!(blob instanceof Blob))throw new Error('PDF export was not returned.');
  if(state.currentPdfUrl)URL.revokeObjectURL(state.currentPdfUrl);
  const url=URL.createObjectURL(blob);state.currentPdfUrl=url;
  $('#printPreviewTitle').textContent=title;
  $('#printPreviewModal').hidden=false;
  $('#printPreviewFrame').src=url;
  const link=$('#downloadMemoPdfBtn');link.href=url;link.download=`Night-Memo-${state.reportingDate}.pdf`;
}

async function regenerateFromWardData() {
  if (!state.memo || !state.editorOpen || state.conflicted || state.boundaryExpired || state.historyMode) return;
  if (!ensureReportingNightCurrent()) return;
  const ok = confirm('Regenerate this Night Memo from Ward submissions? This replaces ALL currently edited document content, including manual changes to headings, tables, and notes. A safety checkpoint will be saved first. Continue?');
  if (!ok) return;
  try {
    await flushRecovery();
    await checkpointCurrentWorkingCopy('before_regenerate_ward_sections');
  } catch (_) { return; }

  state.pendingDocxBytes=await generateNewDocx(buildManagerMemoData({
    bundle:state.bundle,items:state.items,reportingDate:state.reportingDate,
  }));
  state.memo.document={version:5,format:'docx',document_id:null};
  state.memo.source_snapshot = sourceSnapshotFromBundle(state.bundle);
  markDirty({ schedule: false });
  await renderEditor({ keepDirty: true });
  await saveRecoveryNow({ force: true });
  renderSubmissionMonitor();
  setStatus('Document regenerated from Ward data. The previous edited copy is stored as a safety checkpoint. Press Save or Print to create official History.', 'info');
  setTimeout(clearStatus, 3600);
}
function renderMemoState() {
  const badge = $('#memoStateBadge');
  if (!badge) return;
  if (state.lastOfficialType === 'final' && !state.dirty) {
    badge.textContent = 'Final saved';
    badge.className = 'memo-state-badge final';
  } else {
    badge.textContent = 'Draft';
    badge.className = 'memo-state-badge draft';
  }
  const disabled = state.conflicted || state.boundaryExpired || state.officialSaving || state.historyMode;
  $('#saveMemoBtn').disabled = disabled;
  $('#printMemoBtn').disabled = disabled;
}

function setEditingEnabled(enabled) {
  // During Save/Print the iframe must be temporarily locked against input,
  // but must remain in editable mode for ranuts' DOCX/PDF export API.
  // History, conflict and reporting-night expiry use genuine remote read-only.
  if (memoEditorInstance) memoEditorInstance.setReadOnly(!enabled, { temporary: !enabled && state.officialSaving });
  $('#memoEditor').setAttribute('aria-disabled', enabled ? 'false' : 'true');
}

function cloneJson(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function archiveReasonLabel(reason) {
  const labels = {
    before_start_new: 'Before Start New',
    before_regenerate_ward_sections: 'Before Regenerate Ward Sections',
    before_restore_history: 'Before restoring History',
    before_restore_checkpoint: 'Before restoring recovery',
  };
  return labels[reason] || String(reason || 'Safety checkpoint').replaceAll('_', ' ');
}

async function enterHistoryMode() {
  if (state.historyMode) return;
  if (state.editorOpen && (state.dirty || state.recoverySaving)) {
    try { await flushRecovery(); } catch (_) { return; }
  }

  state.historyReturnMode = state.editorOpen ? 'editor' : 'workspace';
  state.historyReturnTab = state.activeTab;
  state.historyMode = true;
  setMemoEditorWorkspaceVisible(false);
  setEditingEnabled(false);
  managerTabs?.setEnabled(false);
  $('#managerHistorySidebar').hidden = false;
  $('#managerArchiveViewer').hidden = false;
  $('#managerTabsShell').hidden = true;
  renderMemoState();

  try {
    state.archive = await listManagerMemoArchive();
    renderArchiveSidebar();
    const currentExists = state.archive.some(row => row.reporting_date === state.reportingDate);
    const initialDate = currentExists ? state.reportingDate : state.archive[0]?.reporting_date;
    if (initialDate) await selectArchiveNight(initialDate);
    else renderEmptyArchive();
    $('#closeManagerHistoryBtn').focus();
  } catch (error) {
    setStatus(`Unable to load Manager History: ${error.message || error}`, 'error');
  }
}

function exitHistoryMode() {
  if (!state.historyMode) return;
  state.historyMode = false;
  $('#managerHistorySidebar').hidden = true;
  $('#managerArchiveViewer').hidden = true;
  $('#managerTabsShell').hidden = false;
  managerTabs?.setEnabled(true);
  managerTabs?.select(state.historyReturnTab || 'submission', { emit: true });

  if (state.historyReturnMode === 'editor' && state.memo) {
    state.editorOpen = true;
    $('#memoWorkspacePanel').hidden = true;
    setMemoEditorWorkspaceVisible(true);
    if (!state.conflicted && !state.boundaryExpired && !state.officialSaving) setEditingEnabled(true);
  } else if (state.activeTab === 'memo') {
    state.editorOpen = false;
    setMemoEditorWorkspaceVisible(false);
    $('#memoWorkspacePanel').hidden = false;
  } else {
    setMemoEditorWorkspaceVisible(false);
  }
  document.querySelector(`[data-manager-tab="${state.activeTab}"]`)?.focus();
  renderMemoState();
}

function renderArchiveSidebar() {
  const host = $('#managerHistoryNightList');
  if (!state.archive.length) {
    host.innerHTML = '<div class="manager-history-empty">No Manager Night Memos have been created yet.</div>';
    return;
  }

  host.innerHTML = state.archive.map(row => {
    const current = row.reporting_date === state.reportingDate;
    const selected = row.reporting_date === state.archiveSelectedDate;
    let status = 'Recovery only';
    if (row.preferred_revision_type === 'final') status = `Final #${row.preferred_revision_number}`;
    else if (row.preferred_revision_type === 'draft') status = `Draft #${row.preferred_revision_number}`;
    const count = Number(row.revision_count || 0);
    return `<button type="button" class="manager-history-night${selected ? ' active' : ''}" data-archive-date="${esc(row.reporting_date)}">
      <span class="manager-history-night-date">${esc(toDisplayDate(row.reporting_date))}${current ? '<span class="manager-history-current-tag">Current</span>' : ''}</span>
      <span class="manager-history-night-meta">${esc(status)} · ${count} saved version${count === 1 ? '' : 's'}</span>
    </button>`;
  }).join('');
}

function renderEmptyArchive() {
  state.archiveSelectedDate = null;
  state.archiveMemo = null;
  state.archiveRevisions = [];
  state.archiveCheckpoints = [];
  $('#archiveMemoTitle').textContent = 'Night Memo History';
  $('#archiveMemoMeta').textContent = 'No historical memo selected.';
  $('#archiveRevisionList').innerHTML = '<span class="manager-history-empty">No saved Night Memos.</span>';
  $('#archiveMemoMeta').textContent='No historical Night Memo is available.';
  $('#archiveUseAsDraftBtn').hidden = true;
  $('#archiveRecoveryDetails').hidden = true;
}

async function selectArchiveNight(reportingDate) {
  const requestId = ++state.archiveRequestId;
  state.archiveSelectedDate = reportingDate;
  renderArchiveSidebar();
  $('#archiveMemoTitle').textContent = `Night Memo · ${toDisplayDate(reportingDate)}`;
  $('#archiveMemoMeta').textContent = 'Loading saved versions…';
  $('#archiveRevisionList').innerHTML = '<span class="manager-history-empty">Loading…</span>';
  $('#archiveUseAsDraftBtn').hidden = true;

  const [memo, revisions, checkpoints] = await Promise.all([
    getManagerMemo(reportingDate),
    listManagerMemoRevisions(reportingDate),
    listManagerMemoCheckpoints(reportingDate),
  ]);
  if (requestId !== state.archiveRequestId) return;

  state.archiveMemo = memo;
  state.archiveRevisions = revisions;
  state.archiveCheckpoints = checkpoints;
  renderArchiveSidebar();
  renderArchiveRevisionList();
  renderArchiveCheckpoints();

  const preferred = revisions.find(row => row.revision_type === 'final') || revisions[0] || null;
  if (preferred) await selectArchiveRevision(preferred.id);
  else if (memo) await selectArchiveRecovery();
  else renderEmptyArchive();
}

function renderArchiveRevisionList() {
  const host = $('#archiveRevisionList');
  const buttons = state.archiveRevisions.map(row => {
    const active = state.archiveSelectedKind === 'revision' && state.archiveSelectedId === row.id;
    const type = row.revision_type === 'final' ? 'Final' : 'Draft';
    return `<button type="button" class="manager-archive-revision ${row.revision_type === 'final' ? 'final' : ''}${active ? ' active' : ''}" data-archive-revision-id="${esc(row.id)}">${type} #${esc(row.revision_number)} · ${esc(formatRevisionStamp(row))}</button>`;
  });
  if (state.archiveMemo) {
    const active = state.archiveSelectedKind === 'recovery';
    buttons.push(`<button type="button" class="manager-archive-revision${active ? ' active' : ''}" data-archive-recovery="1">Recovery copy</button>`);
  }
  host.innerHTML = buttons.join('') || '<span class="manager-history-empty">No saved versions for this night.</span>';
}

async function renderArchiveDocument(document,meta) {
  const seq=++state.archiveLoadSequence;
  $('#archiveMemoMeta').textContent=`${meta} · Opening DOCX…`;
  try{
    if(!archiveEditorInstance)archiveEditorInstance=createManagerDocumentEditor('#archiveMemoFrame',()=>{},{
      readonly:true,
      onNativeExport: file => handleNativeEditorExport(file, { history: true }).catch(error =>
        setStatus(`Unable to download historical Night Memo: ${error.message || error}`, 'error')),
    });
    const bytes=await getManagerDocxBytes(document);
    if(seq!==state.archiveLoadSequence)return;
    await archiveEditorInstance.open(bytes,{readonly:true});
    if(seq===state.archiveLoadSequence)$('#archiveMemoMeta').textContent=meta;
  }catch(error){if(seq===state.archiveLoadSequence)$('#archiveMemoMeta').textContent=`Cannot open historical DOCX: ${error.message||error}`;}
}

async function selectArchiveRevision(revisionId) {
  let revision = state.archiveRevisions.find(row => row.id === revisionId) || null;
  if (!revision) revision = await getManagerMemoRevision(revisionId);
  if (!revision) return;
  state.archiveSelectedKind = 'revision';
  state.archiveSelectedId = revision.id;
  renderArchiveRevisionList();
  const type = revision.revision_type === 'final' ? 'Final' : 'Draft';
  const user = revision.created_by_label ? ` · ${revision.created_by_label}` : '';
  await renderArchiveDocument(revision.document, `${type} #${revision.revision_number} · ${formatRevisionStamp(revision)}${user}`);
  const mayRestore = state.archiveSelectedDate === state.reportingDate;
  $('#archiveUseAsDraftBtn').hidden = !mayRestore;
  $('#archiveUseAsDraftBtn').textContent = `Use ${type} #${revision.revision_number} as Current Draft`;
}

async function selectArchiveRecovery() {
  if (!state.archiveMemo) return;
  state.archiveSelectedKind = 'recovery';
  state.archiveSelectedId = state.archiveMemo.id;
  renderArchiveRevisionList();
  const stamp = state.archiveMemo.updated_at ? formatDateTime(state.archiveMemo.updated_at, 'en-GB') : '—';
  await renderArchiveDocument(state.archiveMemo.document, `Recovery working copy · ${stamp}`);
  $('#archiveUseAsDraftBtn').hidden = true;
}

function renderArchiveCheckpoints() {
  const details = $('#archiveRecoveryDetails');
  const host = $('#archiveCheckpointList');
  if (!state.archiveCheckpoints.length) {
    details.hidden = true;
    host.innerHTML = '';
    return;
  }
  details.hidden = false;
  host.innerHTML = state.archiveCheckpoints.map(row => {
    const canRestore = state.archiveSelectedDate === state.reportingDate;
    return `<div class="manager-checkpoint">
      <div class="manager-checkpoint-meta"><strong>${esc(archiveReasonLabel(row.reason))}</strong><small>${esc(row.created_at ? formatDateTime(row.created_at, 'en-GB') : '—')}${row.created_by_label ? ` · ${esc(row.created_by_label)}` : ''}</small></div>
      <div class="history-actions"><button type="button" class="pill" data-checkpoint-action="view" data-checkpoint-id="${esc(row.id)}">View</button>${canRestore ? `<button type="button" class="pill" data-checkpoint-action="restore" data-checkpoint-id="${esc(row.id)}">Restore</button>` : ''}</div>
    </div>`;
  }).join('');
}

async function selectArchiveCheckpoint(checkpointId) {
  let checkpoint = state.archiveCheckpoints.find(row => row.id === checkpointId) || null;
  if (!checkpoint) checkpoint = await getManagerMemoCheckpoint(checkpointId);
  if (!checkpoint) return;
  state.archiveSelectedKind = 'checkpoint';
  state.archiveSelectedId = checkpoint.id;
  renderArchiveRevisionList();
  await renderArchiveDocument(checkpoint.document, `Safety recovery · ${archiveReasonLabel(checkpoint.reason)} · ${checkpoint.created_at ? formatDateTime(checkpoint.created_at, 'en-GB') : '—'}`);
  const mayRestore = state.archiveSelectedDate === state.reportingDate;
  $('#archiveUseAsDraftBtn').hidden = !mayRestore;
  $('#archiveUseAsDraftBtn').textContent = 'Restore this Safety Recovery';
}

async function restoreSelectedArchiveAsDraft() {
  if (state.archiveSelectedDate !== state.reportingDate) return;
  if (state.archiveSelectedKind === 'revision') {
    const revision = state.archiveRevisions.find(row => row.id === state.archiveSelectedId) || await getManagerMemoRevision(state.archiveSelectedId);
    if (revision) await replaceCurrentDraftFromHistory(revision.document, revision.source_snapshot || [], `${revision.revision_type === 'final' ? 'Final' : 'Draft'} #${revision.revision_number}`, 'before_restore_history');
  } else if (state.archiveSelectedKind === 'checkpoint') {
    const checkpoint = state.archiveCheckpoints.find(row => row.id === state.archiveSelectedId) || await getManagerMemoCheckpoint(state.archiveSelectedId);
    if (checkpoint) await replaceCurrentDraftFromHistory(checkpoint.document, checkpoint.source_snapshot || [], 'safety recovery', 'before_restore_checkpoint');
  }
}

async function useCheckpointAsDraft(checkpointId) {
  if (state.archiveSelectedDate !== state.reportingDate) return;
  const checkpoint = state.archiveCheckpoints.find(row => row.id === checkpointId) || await getManagerMemoCheckpoint(checkpointId);
  if (!checkpoint) return;
  await replaceCurrentDraftFromHistory(checkpoint.document, checkpoint.source_snapshot || [], 'safety recovery', 'before_restore_checkpoint');
}

async function replaceCurrentDraftFromHistory(document, sourceSnapshot, label, checkpointReason) {
  if (!ensureReportingNightCurrent()) return;
  const ok = confirm(`Use this ${label} as the current working draft? Official Draft/Final history will remain unchanged, and the current working copy will be kept as a safety checkpoint.`);
  if (!ok) return;

  try {
    await flushRecovery();
    await checkpointCurrentWorkingCopy(checkpointReason);
  } catch (_) { return; }

  if (!state.memo) {
    state.memo = { reporting_date: state.reportingDate, revision: 0, status: 'draft' };
  }
  const restoredBytes=await getManagerDocxBytes(document);
  state.pendingDocxBytes=restoredBytes;
  state.memo.document={version:5,format:'docx',document_id:null};
  state.memo.source_snapshot = cloneJson(sourceSnapshot) || [];
  state.conflicted = false;
  state.lastOfficialType = null;
  state.editorOpen = true;
  state.dirty = false;
  state.editGeneration = state.savedGeneration;
  markDirty({ schedule: false });

  state.historyReturnMode = 'editor';
  exitHistoryMode();
  $('#memoWorkspacePanel').hidden = true;
  setMemoEditorWorkspaceVisible(true);
  await renderEditor({ keepDirty: true });
  await saveRecoveryNow({ force: true });
  renderSubmissionMonitor();
  setStatus(`Historical ${label} loaded into the working draft. Press Save to create a new Draft version.`, 'info');
}
function renderWardInfoTable(columns, rows, { className = '' } = {}) {
  if (!rows?.length) return '';
  return `<div class="ward-info-table-wrap ${esc(className)}"><table class="ward-source-table"><thead><tr>${columns.map(column => `<th>${esc(column.label)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${columns.map(column => `<td>${esc(row[column.key] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function renderWardInfoSection(title, content, { wide = false } = {}) {
  return `<section class="ward-source-section${wide ? ' ward-info-wide' : ''}"><h2>${esc(title)}</h2>${content}</section>`;
}

function renderWardInformation() {
  const host = $('#wardInformationList');
  if (!host) return;
  const rows = buildManagerWardInformation({ wards: state.allWards, bundle: state.bundle, items: state.items });
  if (!rows.length) {
    host.innerHTML = '<div class="manager-empty-state">No active wards found.</div>';
    return;
  }

  host.innerHTML = rows.map(row => {
    const wardName = row.ward?.name || 'Ward';
    const submitted = row.submittedAt ? formatDateTime(row.submittedAt, 'en-GB') : 'Not submitted in current cycle';
    const noSubmission = !row.report;
    const unavailable = '<div class="ward-info-nil">No current Ward submission.</div>';

    const patientList = noSubmission
      ? unavailable
      : row.patientList.nil
        ? '<div class="ward-info-nil">Nil Special</div>'
        : renderWardInfoTable([
          { key: 'bed', label: 'Bed' },
          { key: 'name', label: 'Name' },
          { key: 'diagnosisConditionProgress', label: 'Diagnosis / Condition / Progress' },
        ], row.patientList.rows) || '<div class="ward-info-nil">No patient rows recorded.</div>';

    const consultation = noSubmission
      ? unavailable
      : row.consultation.nil
        ? '<div class="ward-info-nil">Nil Consultation</div>'
        : renderWardInfoTable([
          { key: 'bed', label: 'Bed' },
          { key: 'name', label: 'Name' },
          { key: 'pendingConsultation', label: 'Pending which subspecialty consultation' },
        ], row.consultation.rows) || '<div class="ward-info-nil">No consultation rows recorded.</div>';

    const intubation = noSubmission
      ? unavailable
      : row.intubation.nil
        ? '<div class="ward-info-nil">Nil Intubation</div>'
        : renderWardInfoTable([
          { key: 'bed', label: 'Bed' },
          { key: 'nameHospitalNumber', label: 'Name / Hospital No.' },
          { key: 'diagnosis', label: 'Diagnosis' },
          { key: 'reason', label: 'Reason' },
          { key: 'urgency', label: 'Elective / Emergency' },
          { key: 'byWhom', label: 'By Whom' },
          { key: 'location', label: 'Location' },
          { key: 'outcome', label: 'Patient Outcome' },
        ], row.intubation.rows, { className: 'intubation-table-wrap' }) || '<div class="ward-info-nil">No intubation rows recorded.</div>';

    const additional = !noSubmission && row.additionalItems.length
      ? `<table class="ward-additional-table"><tbody>${row.additionalItems.map(item => `<tr><th>${esc(item.label)}</th><td>${esc(item.value || '—')}</td></tr>`).join('')}</tbody></table>`
      : '';

    return `<article class="ward-information-card${row.report ? '' : ' missing'}">
      <header class="ward-information-card-head">
        <div><strong>${esc(wardName)}</strong><span>${esc(submitted)}</span></div>
        ${row.report ? `<button type="button" class="pill ward-info-view-memo" data-ward-id="${esc(row.ward.id)}">View Ward Memo</button>` : ''}
      </header>
      <div class="ward-information-sections">
        ${renderWardInfoSection('Patient List', patientList)}
        ${renderWardInfoSection('Consultation', consultation)}
        ${renderWardInfoSection('Intubation', intubation, { wide: true })}
        ${additional ? renderWardInfoSection('Additional Report Items', additional, { wide: true }) : ''}
      </div>
    </article>`;
  }).join('');

  $$('.ward-info-view-memo', host).forEach(button => {
    button.addEventListener('click', () => openWardMemoPreview(button.dataset.wardId, state.bundle.find(e => e.ward?.id === button.dataset.wardId)?.nightReport ? 'night' : 'pm'));
  });
}

async function getWardPrintModule() {
  if (!wardPrintModulePromise) wardPrintModulePromise = import('../ward-print.js');
  return wardPrintModulePromise;
}

async function openWardMemoPreview(wardId, memoType = 'night') {
  const entry = state.bundle.find(item => item.ward?.id === wardId);
  if (!entry) return;
  const report = memoType === 'pm' ? entry.pmReport : entry.nightReport;
  if (!report) return;
  const items = report.report_item_snapshot?.length
    ? report.report_item_snapshot.map(item => ({ ...item, __historical: true }))
    : state.items;
  const mod = await getWardPrintModule();
  const context = {
    ward: entry.ward,
    report,
    capacity: report.bed_capacity_snapshot ?? entry.capacity,
    items,
    settings: mod.loadWardPrintSettings(),
    logoUrl: new URL('../assets/heart-logo.png', import.meta.url).href,
  };
  state.wardPreviewContext = context;
  const submitted = reportSubmittedAt(report);
  $('#wardMemoPreviewTitle').textContent = `${entry.ward.name} ${MEMO_LABELS[memoType]}`;
  $('#wardMemoPreviewMeta').textContent = submitted ? `Submitted ${formatDateTime(submitted, 'en-GB')}` : 'Submitted Ward memo';
  $('#wardMemoPreviewModal').hidden = false;
  await mod.writeWardMemoToIframe($('#wardMemoPreviewFrame'), context);
}

async function printOpenWardMemo() {
  if (!state.wardPreviewContext) return;
  const mod = await getWardPrintModule();
  await mod.printWardMemo(state.wardPreviewContext);
}

function setStatus(message, type = 'info') {
  const el = $('#managerStatus');
  if (el) {
    el.hidden = false;
    el.className = `manager-status no-print ${type}`;
    el.textContent = message;
  }
  const inline = $('#memoEditorStatus');
  if (inline) {
    inline.hidden = !document.body.classList.contains('docx-editor-active');
    inline.className = `memo-editor-status ${type}`;
    inline.textContent = message;
  }
}

function clearStatus() {
  const el = $('#managerStatus');
  if (el) { el.hidden = true; el.textContent = ''; }
  const inline = $('#memoEditorStatus');
  if (inline) { inline.hidden = true; inline.textContent = ''; }
}

function showFatal(error) {
  console.error('Manager workspace failed:', error);
  setStatus(`Manager workspace could not initialise: ${error?.message || error}`, 'error');
}
