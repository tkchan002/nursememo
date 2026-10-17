import { requireRole, signOut } from '../services/auth-service.js';
import {
  getAllWards, getOperatingPeriods, getCapacityHistory, createWard, reorderWards,
  addOperatingPeriod, closeOperatingPeriod, saveWardConfiguration, getAccounts, adminAccount,
  getWardStaff, saveWardStaff, setStaffActive, getReportItems, saveReportItem, reorderReportItems, getAuditLog,
  getMaintenanceWardsSnapshot, getNightMemoTemplateMetadata, getNightMemoVisualTemplate, publishNightMemoVisualTemplate, DB_MODE,
} from '../data/index.js';
import { qs, qsa, esc } from '../core/dom.js';
import { todayISO, toDisplayDate, formatDateTime } from '../core/dates.js';
import { flash } from '../core/ui.js';
import { setAppHeader } from '../components/app-shell.js';
import { CONFIG } from '../config.js';
import { initMaintenanceTestData, refreshGeneratedDemoBatches } from './maintenance-test-data.js';
import { moveOrderedItem, sortByOrder } from '../domain/ordering.js';
import { emptyBedGenderLabel, validateWardName } from '../domain/ward.js';
import { editableCapacity, capacityNumber } from '../domain/capacity-history.js';
import { INSECURE_TEST_PASSWORDS } from '../core/test-password-mode.js';
import { loginIdToEmail } from '../supabase/functions/_shared/login-identity.mjs';
import { validateMaintenancePassword, toStoredMaintenancePassword } from '../domain/maintenance-accounts.js';
import { assertDocxBytes } from '../documents/docx-bytes.js';

const $ = qs;
const state = {
  access: null,
  wards: [],
  periods: [],
  accounts: [],
  items: [],
  editingAccount: null,
  passwordAccount: null,
  editingItem: null,
  editingWard: null,
  wardModalSequence: 0,
  capacityAtOpen: null,
  savingWard: false,
  docxTemplateVersion: null,
  visualEditor: null, visualLoading: null, templateDirty: false, publishedTemplate:false,
  loaded: { wards: false, accounts: false, items: false },
  loading: {},
};

init().catch(error => { console.error(error); flash(error.message || String(error), 'error', 8000); });

async function init() {
  state.access = await requireRole('maintenance');
  if (!state.access) return;
  setAppHeader({ title: CONFIG.APP_NAME, subtitle: 'Maintenance · Configuration and lifecycle console', access: state.access, mode: DB_MODE });
  initMaintenanceTestData();
  bind();
  // Only the visible Wards tab is on the initial critical path. Accounts,
  // Report Items, Staff and Audit are fetched only when the user opens them.
  await ensureWardsLoaded();
}

function bind() {
  $('#logoutBtn').addEventListener('click', signOut);
  qsa('[data-maint]').forEach(b => { b.addEventListener('click', () => showPage(b.dataset.maint)); });
  qsa('[data-close]').forEach(b => { b.addEventListener('click', () => closeModal(b.dataset.close)); });
  $('#addWardBtn').addEventListener('click', () => openWardModal());
  $('#wardFormModal').addEventListener('submit', saveWardFromModal);
  $('#addAccountBtn').addEventListener('click', () => openAccountModal());
  $('#refreshAccountsBtn').addEventListener('click', () => ensureAccountsLoaded(true));
  $('#accountForm').addEventListener('submit', saveAccount);
  $('#accountLogin').addEventListener('input', updateAccountEmailPreview);
  $('#passwordForm').addEventListener('submit', savePassword);
  $('#showNewPassword').addEventListener('change', () => {
    const type = $('#showNewPassword').checked ? 'text' : 'password';
    $('#newPassword').type = type;
    $('#confirmNewPassword').type = type;
  });
  $('#staffWard').addEventListener('change', renderMaintStaff);
  $('#maintAddStaff').addEventListener('click', () => appendMaintStaffEditor());
  $('#addItemBtn').addEventListener('click', () => openItemModal());
  $('#itemForm').addEventListener('submit', saveItem);
  $('#refreshAudit').addEventListener('click', renderAudit);
  $('#docxSaveBtn').addEventListener('click', publishVisualTemplate);
  $('#docxResetBtn').addEventListener('click', () => resetVisualTemplate());
  $('#docxReloadBtn').addEventListener('click', () => loadVisualTemplate(true));
  $('#docxSampleBtn').addEventListener('click', () => downloadVisualTemplateSample());
}

async function showPage(name) {
  qsa('[data-maint]').forEach(x => x.classList.toggle('active', x.dataset.maint === name));
  qsa('[data-maint-page]').forEach(x => x.classList.toggle('active', x.dataset.maintPage === name));
  try {
    if (name === 'wards') await ensureWardsLoaded();
    if (name === 'accounts') { await ensureWardsLoaded(); await ensureAccountsLoaded(); }
    if (name === 'staff') { await ensureWardsLoaded(); await renderMaintStaff(); }
    if (name === 'items') await ensureItemsLoaded();
    if (name === 'audit') await renderAudit();
    if (name === 'docx') await loadVisualTemplate();
    if (name === 'demo') await refreshGeneratedDemoBatches();
  } catch (error) {
    console.error(`Unable to load maintenance tab ${name}:`, error);
    flash(error.message || String(error), 'error', 7000);
  }
}

function openModal(sel) { $(sel).classList.add('show'); }
function closeModal(sel) {
  if (sel === '#wardModal') {
    if (state.savingWard) return;
    state.wardModalSequence++;
  }
  $(sel).classList.remove('show');
}

async function ensureWardsLoaded(force = false) {
  if (state.loaded.wards && !force) return;
  if (state.loading.wards) return state.loading.wards;
  $('#wardRows').innerHTML = '<tr><td colspan="7" class="muted">Loading wards...</td></tr>';
  state.loading.wards = (async () => {
    const snapshot = await getMaintenanceWardsSnapshot();
    if (snapshot) {
      state.wards = snapshot.wards || [];
      state.periods = snapshot.periods || [];
    } else {
      [state.wards, state.periods] = await Promise.all([getAllWards(), getOperatingPeriods()]);
    }
    state.loaded.wards = true;
    fillWardSelects();
    renderWardList();
  })();
  try { await state.loading.wards; } finally { state.loading.wards = null; }
}

async function ensureAccountsLoaded(force = false) {
  if (state.loaded.accounts && !force) { renderAccounts(); return; }
  if (state.loading.accounts) return state.loading.accounts;
  $('#accountRows').innerHTML = '<tr><td colspan="7" class="muted">Loading accounts...</td></tr>';
  state.loading.accounts = (async () => {
    state.accounts = await getAccounts();
    state.loaded.accounts = true;
    renderAccounts();
  })();
  try { await state.loading.accounts; } finally { state.loading.accounts = null; }
}

async function ensureItemsLoaded(force = false) {
  if (state.loaded.items && !force) { renderItems(); return; }
  if (state.loading.items) return state.loading.items;
  $('#itemRows').innerHTML = '<tr><td colspan="6" class="muted">Loading report items...</td></tr>';
  state.loading.items = (async () => {
    state.items = await getReportItems(todayISO(), true);
    state.loaded.items = true;
    renderItems();
  })();
  try { await state.loading.items; } finally { state.loading.items = null; }
}

function fillWardSelects() {
  const opts = '<option value="">— None —</option>' + state.wards.map(w => `<option value="${esc(w.id)}">${esc(w.name)}</option>`).join('');
  ['#staffWard', '#accountWard'].forEach(sel => {
    const el = $(sel), old = el.value; el.innerHTML = opts;
    if ([...el.options].some(o => o.value === old)) el.value = old;
  });
  if (!$('#staffWard').value && state.wards[0]) $('#staffWard').value = state.wards[0].id;
}

function renderWardList() {
  const today = todayISO();
  const periods = state.periods || [];
  const orderedWards = sortByOrder(state.wards, 'display_order');
  state.wards = orderedWards;

  const host = $('#wardRows');
  if (!orderedWards.length) {
    host.innerHTML = '<tr><td colspan="6" class="muted">No wards configured.</td></tr>';
    return;
  }

  host.innerHTML = orderedWards.map((w, index) => {
    const open = periods.some(p => p.ward_id === w.id && p.start_date <= today && (!p.end_date || p.end_date >= today));
    const status = open ? 'Currently open' : 'Closed / scheduled';
    const moveButtons = `<div class="ward-move-controls">
      <button class="btn secondary small" data-move-ward="${esc(w.id)}" data-move-delta="-1" ${index === 0 ? 'disabled' : ''} title="Move ${esc(w.name)} up one position">↑ Up</button>
      <button class="btn secondary small" data-move-ward="${esc(w.id)}" data-move-delta="1" ${index === orderedWards.length - 1 ? 'disabled' : ''} title="Move ${esc(w.name)} down one position">↓ Down</button>
    </div>`;
    const lifecycleButton = open
      ? `<button class="btn danger small" data-close-ward="${esc(w.id)}">Close Ward</button>`
      : `<button class="btn secondary small" data-reopen-ward="${esc(w.id)}">Reopen</button>`;

    return `<tr>
      <td class="ward-list-code"><strong>${esc(w.name)}</strong></td>
      <td><div class="ward-list-subtext">Tel ${esc(w.phone || '—')} · Fax ${esc(w.fax || '—')}</div></td>
      <td><span class="ward-status"><span class="dot ${open ? 'active' : 'closed'}"></span>${esc(status)}</span></td>
      <td>${esc(emptyBedGenderLabel(w.empty_bed_gender_mode))}${w.single_double_reporting_enabled ? ' · S/D enabled' : ''}</td>
      <td>${moveButtons}</td>
      <td><div class="ward-row-actions"><button class="btn secondary small" data-edit-ward="${esc(w.id)}">Edit</button>${lifecycleButton}</div></td>
    </tr>`;
  }).join('');

  qsa('[data-move-ward]').forEach(b => { b.addEventListener('click', () => moveWard(b.dataset.moveWard, Number(b.dataset.moveDelta))); });
  qsa('[data-edit-ward]').forEach(b => { b.addEventListener('click', () => openWardModal(state.wards.find(w => w.id === b.dataset.editWard))); });
  qsa('[data-close-ward]').forEach(b => { b.addEventListener('click', () => closeWard(b.dataset.closeWard)); });
  qsa('[data-reopen-ward]').forEach(b => { b.addEventListener('click', () => reopenWard(b.dataset.reopenWard)); });
}

async function moveWard(wardId, delta) {
  const result = moveOrderedItem(state.wards, wardId, delta, 'display_order');
  if (!result.changed) return;
  try {
    await reorderWards(result.items.map(ward => ward.id));
    state.wards = result.items;
    fillWardSelects();
    renderWardList();
    flash('Ward display order updated.', 'success');
  } catch (error) {
    flash(error.message || String(error), 'error', 7000);
    await refreshWardConfiguration();
  }
}

async function refreshWardConfiguration() {
  state.loaded.wards = false;
  await ensureWardsLoaded(true);
}

function initializeCapacityOptions() {
  const select = $('#mWardCapacity');
  if (select.options.length) return;
  const options = document.createDocumentFragment();
  for (let beds = 0; beds <= 500; beds++) {
    const option = document.createElement('option');
    option.value = String(beds);
    option.textContent = String(beds);
    options.append(option);
  }
  select.append(options);
}

async function openWardModal(w = null) {
  if (state.savingWard) return;
  const requestId = ++state.wardModalSequence;
  state.editingWard = w;
  state.capacityAtOpen = null;
  initializeCapacityOptions();
  $('#wardModalTitle').textContent = w ? 'Edit Ward' : 'Add Ward';
  $('#editWardId').value = w?.id || '';
  $('#mWardName').value = w?.name || '';
  $('#mWardPhone').value = w?.phone || '';
  $('#mWardFax').value = w?.fax || '';
  $('#mWardGender').value = w?.empty_bed_gender_mode || 'male';
  $('#mWardSingleDouble').checked = w?.single_double_reporting_enabled === true;
  $('#mWardStart').value = todayISO();
  $('#mWardEnd').value = '';
  $('#mWardNote').value = '';
  $('#mWardCapacity').value = w ? '' : '40';
  const save = $('#wardFormModal button[type="submit"]');
  save.disabled = !!w;
  $('#mWardCapacity').disabled = !!w;
  qsa('.new-ward-only').forEach(x => x.classList.toggle('hidden', !!w));
  qsa('.edit-ward-only').forEach(x => x.classList.toggle('hidden', !w));
  $('#wardCapacityHistory').innerHTML = '';
  openModal('#wardModal');
  if (!w) return;
  try {
    const rows = await getCapacityHistory(w.id);
    if (requestId !== state.wardModalSequence || !$('#wardModal').classList.contains('show')) return;
    const chosen = editableCapacity(rows, todayISO());
    state.capacityAtOpen = { value: Number(chosen.row.bed_capacity), updatedAt: w.updated_at || null };
    $('#mWardCapacity').value = String(chosen.row.bed_capacity);
    $('#wardCapacityHistory').innerHTML = `<table class="data-table"><thead><tr><th>Effective From</th><th>Effective To</th><th>Beds</th></tr></thead><tbody>${rows.map(row => `<tr><td>${esc(toDisplayDate(row.effective_from))}</td><td>${esc(row.effective_to ? toDisplayDate(row.effective_to) : 'Current')}</td><td>${esc(row.bed_capacity)}</td></tr>`).join('')}</tbody></table>`;
    $('#mWardCapacity').disabled = false;
    save.disabled = false;
  } catch (error) {
    if (requestId === state.wardModalSequence) flash(error.message || String(error), 'error', 7000);
  }
}

async function saveWardFromModal(event) {
  event.preventDefault();
  const save = $('#wardFormModal button[type="submit"]');
  if (save.disabled) return;
  save.disabled = true;
  state.savingWard = true;
  try {
    const wardName = validateWardName($('#mWardName').value);
    const capacity = capacityNumber($('#mWardCapacity').value);
    const settings = {
      name: wardName,
      phone: $('#mWardPhone').value.trim(),
      fax: $('#mWardFax').value.trim(),
      empty_bed_gender_mode: $('#mWardGender').value,
      single_double_reporting_enabled: $('#mWardSingleDouble').checked,
    };
    if (state.editingWard) {
      if (!state.capacityAtOpen) throw new Error('Bed capacity has not loaded. Reopen Edit Ward.');
      await saveWardConfiguration(state.editingWard.id, settings, capacity, {
        expectedCapacity: state.capacityAtOpen.value,
        expectedUpdatedAt: state.capacityAtOpen.updatedAt,
        effectiveDate: todayISO(),
      });
      flash('Ward and bed capacity saved.', 'success');
    } else {
      await createWard({ ...settings, start_date: $('#mWardStart').value,
        end_date: $('#mWardEnd').value || null, bed_capacity: capacity,
        note: $('#mWardNote').value.trim() });
      flash('Ward created. Create its login account in Accounts.', 'success', 6000);
    }
    state.savingWard = false;
    closeModal('#wardModal');
    await refreshWardConfiguration();
  } catch (error) {
    flash(error.message || String(error), 'error', 7000);
  } finally {
    state.savingWard = false;
    if ($('#wardModal').classList.contains('show') && (!state.editingWard || state.capacityAtOpen)) save.disabled = false;
  }
}
async function closeWard(wardId) {
  const date = prompt('Closing date (YYYY-MM-DD):', todayISO()); if (!date) return;
  const periods = await getOperatingPeriods(wardId); const open = periods.find(p => p.start_date <= date && (!p.end_date || p.end_date >= date));
  if (!open) return flash('No open operating period found for that date.', 'warning');
  await closeOperatingPeriod(open.id, date, 'Ward closed from maintenance console'); flash('Ward operating period closed.', 'success'); await refreshWardConfiguration();
}
async function reopenWard(wardId) { const date = prompt('Reopening date (YYYY-MM-DD):', todayISO()); if (!date) return; await addOperatingPeriod(wardId, date, null, 'Ward reopened from maintenance console'); flash('Ward reopened.', 'success'); await refreshWardConfiguration(); }
function openPasswordModal(account) {
  if (!account?.auth_exists) return flash('No corresponding Supabase Authentication account exists.', 'error');
  state.passwordAccount = account;
  $('#passwordUserId').value = account.auth_user_id;
  $('#passwordModalTitle').textContent = `Set New Password — ${account.login_id}`;
  $('#newPassword').value = '';
  $('#confirmNewPassword').value = '';
  $('#showNewPassword').checked = false;
  $('#newPassword').type = 'password';
  $('#confirmNewPassword').type = 'password';
  $('#passwordInstructions').textContent = INSECURE_TEST_PASSWORDS
    ? `Test-only: enter ${account.login_id.toLowerCase()} in both fields for matching demo credentials, or use at least 8 characters. This replaces the real Supabase password; the previous password cannot be retrieved.`
    : 'Enter at least 8 characters. The new password replaces the real Supabase password; the previous password cannot be retrieved.';
  openModal('#passwordModal');
}

function renderAccounts() {
  const accounts = state.accounts;
  $('#accountRows').innerHTML = accounts.length ? accounts.map(a => {
    const exists = a.auth_exists !== false;
    const authStatus = !exists
      ? '<span class="tag subtle">Missing in Auth</span>'
      : a.auth_login_matches === false
        ? '<span class="tag subtle">Login ID mismatch</span>'
        : '<span class="tag">Confirmed</span>';
    const lastLogin = a.auth_last_sign_in_at ? esc(formatDateTime(a.auth_last_sign_in_at)) : '—';
    const disabled = exists ? '' : ' disabled title="No Supabase Authentication account"';
    return `<tr><td>${esc(a.login_id)}${a.auth_email ? `<div class="muted account-auth-email">${esc(a.auth_email)}</div>` : ''}</td><td>${esc(a.role)}</td><td>${esc(a.wards?.name || '—')}</td><td>${a.active ? '<span class="tag">Active</span>' : '<span class="tag subtle">Disabled</span>'}</td><td>${authStatus}</td><td>${lastLogin}</td><td><div class="inline-actions"><button class="btn secondary small" data-edit-account="${esc(a.auth_user_id)}"${disabled}>Edit</button><button class="btn secondary small" data-password="${esc(a.auth_user_id)}"${disabled}>Set Password</button></div></td></tr>`;
  }).join('') : '<tr><td colspan="7" class="muted">No accounts. Create accounts using Maintenance or run the account bootstrap.</td></tr>';
  qsa('[data-edit-account]').forEach(b => {
    b.addEventListener('click', () => openAccountModal(accounts.find(a => a.auth_user_id === b.dataset.editAccount)));
  });
  qsa('[data-password]').forEach(b => {
    b.addEventListener('click', () => openPasswordModal(accounts.find(a => a.auth_user_id === b.dataset.password)));
  });
}
function openAccountModal(a = null) {
  state.editingAccount = a;
  $('#accountModalTitle').textContent = a ? 'Edit Supabase Account' : 'Create Supabase Account';
  $('#accountUserId').value = a?.auth_user_id || '';
  $('#accountLogin').value = a?.login_id || '';
  $('#accountDisplay').value = a?.display_name || '';
  $('#accountRole').value = a?.role || 'ward';
  $('#accountWard').value = a?.ward_id || '';
  $('#accountActive').value = String(a?.active ?? true);
  $('#accountPassword').value = '';
  $('#accountPasswordWrap').classList.toggle('hidden', !!a);
  $('#accountPassword').required = !a;
  updateAccountEmailPreview();
  openModal('#accountModal');
}
function updateAccountEmailPreview() {
  const entered = $('#accountLogin').value.trim();
  const output = $('#accountAuthEmailPreview');
  try {
    output.textContent = loginIdToEmail(entered);
    output.classList.remove('invalid');
  } catch {
    output.textContent = 'Enter a valid Login ID (2–32 characters, starting with a letter).';
    output.classList.add('invalid');
  }
  $('#accountRenameHelp').hidden = !state.editingAccount
    || entered.toLowerCase() === state.editingAccount.login_id.toLowerCase();
}
async function saveAccount(event) {
  event.preventDefault();
  try {
    const loginId = $('#accountLogin').value.trim();
    if (!state.editingAccount) {
      const enteredPassword = $('#accountPassword').value;
      validateMaintenancePassword(loginId, enteredPassword, INSECURE_TEST_PASSWORDS);
      await adminAccount('create', {
        login_id: loginId, display_name: $('#accountDisplay').value.trim(),
        role: $('#accountRole').value,
        ward_id: $('#accountRole').value === 'ward' ? ($('#accountWard').value || null) : null,
        password: toStoredMaintenancePassword(loginId, enteredPassword, INSECURE_TEST_PASSWORDS, DB_MODE),
      });
    } else {
      const a = state.editingAccount;
      const renamed = loginId.toLowerCase() !== a.login_id.toLowerCase();
      if (renamed) await adminAccount('rename_login', { auth_user_id: a.auth_user_id, login_id: loginId, display_name: $('#accountDisplay').value.trim() });
      await adminAccount('update_access', {
        auth_user_id: a.auth_user_id, role: $('#accountRole').value,
        ward_id: $('#accountRole').value === 'ward' ? ($('#accountWard').value || null) : null,
        active: $('#accountActive').value === 'true', display_name: $('#accountDisplay').value.trim(),
      });
      if (renamed && INSECURE_TEST_PASSWORDS) {
        flash('Account renamed. Reset the password to the new matching account ID before logging in with it.', 'warning', 10000);
      }
    }
    closeModal('#accountModal');
    await ensureAccountsLoaded(true);
    flash('Supabase account saved.', 'success');
  } catch (error) { flash(error.message || String(error), 'error', 7000); }
}
async function savePassword(event) {
  event.preventDefault();
  const account = state.passwordAccount;
  if (!account || account.auth_user_id !== $('#passwordUserId').value) {
    return flash('Select an account again.', 'error');
  }
  const password = $('#newPassword').value;
  if (password !== $('#confirmNewPassword').value) return flash('The two new passwords do not match.', 'error');
  try {
    validateMaintenancePassword(account.login_id, password, INSECURE_TEST_PASSWORDS);
    await adminAccount('reset_password', {
      auth_user_id: account.auth_user_id,
      password: toStoredMaintenancePassword(account.login_id, password, INSECURE_TEST_PASSWORDS, DB_MODE),
    });
    closeModal('#passwordModal');
    state.passwordAccount = null;
    $('#newPassword').value = '';
    $('#confirmNewPassword').value = '';
    flash('Supabase Authentication password replaced. Existing passwords cannot be viewed.', 'success');
    await ensureAccountsLoaded(true);
  } catch (error) { flash(error.message || String(error), 'error', 7000); }
}
async function renderMaintStaff() {
  const wardId = $('#staffWard').value; if (!wardId) { $('#maintStaffTable').innerHTML = ''; return; }
  const staff = await getWardStaff(wardId, true); $('#maintStaffTable').innerHTML = '<table class="data-table"><thead><tr><th>Role</th><th>Name</th><th>Appointment</th><th>Status</th><th></th></tr></thead><tbody id="maintStaffRows"></tbody></table>'; staff.forEach(s => appendMaintStaffEditor(s));
}
function appendMaintStaffEditor(s = { role: 'RN', name: '', appointment_date: '', active: true }) {
  const wardId = $('#staffWard').value; if (!wardId) return;
  const tr = document.createElement('tr'); tr.dataset.id = s.id || '';
  tr.innerHTML = `<td><select class="control" data-role><option>RN</option><option>EN</option><option>APN</option><option>Student Nurse</option></select></td><td><input class="control" data-name value="${esc(s.name || '')}"></td><td><input class="control" type="date" data-appt value="${esc(s.appointment_date || '')}"></td><td>${s.active === false ? 'Inactive' : 'Active'}</td><td><div class="inline-actions"><button class="btn secondary small" data-save>Save</button>${s.id ? `<button class="btn danger small" data-toggle>${s.active === false ? 'Activate' : 'Deactivate'}</button>` : ''}</div></td>`;
  qs('[data-role]', tr).value = s.role || 'RN';
  qs('[data-save]', tr).addEventListener('click', async () => { await saveWardStaff({ id: tr.dataset.id || undefined, ward_id: wardId, role: qs('[data-role]', tr).value, name: qs('[data-name]', tr).value.trim(), appointment_date: qs('[data-appt]', tr).value || null, active: s.active !== false, display_order: 0 }); flash('Staff saved.', 'success'); await renderMaintStaff(); });
  const toggle = qs('[data-toggle]', tr); if (toggle) toggle.addEventListener('click', async () => { await setStaffActive(s.id, s.active === false); await renderMaintStaff(); });
  qs('#maintStaffRows').append(tr);
}
function renderItems() {
  const sorted = sortByOrder(state.items, 'sort_order');
  state.items = sorted;
  $('#itemRows').innerHTML = sorted.map((i, index) => `<tr>
    <td>${esc(i.section)}</td>
    <td>${esc(i.label)}${i.builtin ? ' <span class="tag subtle">Built-in</span>' : ''}</td>
    <td>${esc(i.input_type)}</td>
    <td>${esc(toDisplayDate(i.effective_from || ''))}${i.effective_to ? ` – ${esc(toDisplayDate(i.effective_to))}` : ''}</td>
    <td>${i.active ? '<span class="tag">Active</span>' : '<span class="tag subtle">Inactive</span>'}</td>
    <td><div class="inline-actions">
      <button class="btn secondary small" data-move-item="${esc(i.id)}" data-move-delta="-1" ${index === 0 ? 'disabled' : ''} title="Move report item up">↑ Up</button>
      <button class="btn secondary small" data-move-item="${esc(i.id)}" data-move-delta="1" ${index === sorted.length - 1 ? 'disabled' : ''} title="Move report item down">↓ Down</button>
      <button class="btn secondary small" data-edit-item="${esc(i.id)}">Edit</button>
    </div></td>
  </tr>`).join('');
  qsa('[data-edit-item]').forEach(b => { b.addEventListener('click', () => openItemModal(state.items.find(i => i.id === b.dataset.editItem))); });
  qsa('[data-move-item]').forEach(b => { b.addEventListener('click', () => moveReportItem(b.dataset.moveItem, Number(b.dataset.moveDelta))); });
}

async function moveReportItem(itemId, delta) {
  const result = moveOrderedItem(state.items, itemId, delta, 'sort_order');
  if (!result.changed) return;
  try {
    await reorderReportItems(result.items.map(item => item.id));
    state.items = result.items;
    renderItems();
    flash('Report item order updated.', 'success');
  } catch (error) {
    flash(error.message || String(error), 'error', 7000);
    await ensureItemsLoaded(true);
  }
}

function openItemModal(i = null) {
  state.editingItem = i; $('#itemModalTitle').textContent = i ? 'Edit Report Item' : 'Add Report Item'; $('#itemId').value = i?.id || ''; $('#itemBuiltin').value = i?.builtin ? 'true' : 'false';
  $('#itemKey').value = i?.key || ''; $('#itemLabel').value = i?.label || ''; $('#itemSection').value = i?.section || 'additional'; $('#itemType').value = i?.input_type || 'free_text';
  $('#itemActive').value = String(i?.active ?? true); $('#itemOptions').value = (i?.options || []).join(', '); $('#itemFrom').value = i?.effective_from || todayISO(); $('#itemTo').value = i?.effective_to || '';
  $('#itemKey').disabled = !!i; $('#itemType').disabled = !!i?.builtin; openModal('#itemModal');
}
async function saveItem(event) {
  event.preventDefault();
  try {
    const old = state.editingItem;
    await saveReportItem({ id: old?.id || undefined, key: $('#itemKey').value.trim(), label: $('#itemLabel').value.trim(), section: $('#itemSection').value, input_type: old?.builtin ? old.input_type : $('#itemType').value, options: $('#itemOptions').value.split(',').map(x => x.trim()).filter(Boolean), active: $('#itemActive').value === 'true', effective_from: $('#itemFrom').value || todayISO(), effective_to: $('#itemTo').value || null, builtin: old?.builtin || false, manager_slot: old?.manager_slot || null, config: old?.config || { storage: 'dynamicItems' } });
    closeModal('#itemModal'); flash('Report item saved.', 'success'); await ensureItemsLoaded(true);
  } catch (error) { flash(error.message || String(error), 'error', 7000); }
}
async function renderAudit() { const rows = await getAuditLog(200); $('#auditRows').innerHTML = rows.length ? rows.map(r => `<div class="audit-row"><b>${esc(formatDateTime(r.occurred_at))}</b> · <code>${esc(r.action)}</code> · ${esc(r.entity_type || '')} ${esc(r.entity_id || '')}<div class="muted">${esc(JSON.stringify(r.details || {}))}</div></div>`).join('') : '<div class="muted">No audit entries yet.</div>'; }

// The master template is edited in the same self-hosted DOCX editor used for
// Night Memo. Only publishing changes the shared template; no autosave writes
// partial changes to Supabase.
async function ensureVisualEditor() {
  if (state.visualEditor) return state.visualEditor;
  if (state.visualLoading) return state.visualLoading;
  const {createManagerDocumentEditor}=await import('../editor/manager-ranuts.js');
  const editor=createManagerDocumentEditor('#docxTemplateEditor', () => {
    state.templateDirty=true;
    $('#docxTemplateStatus').textContent='Unpublished template changes. Click Publish This Template to make them available to new memos.';
  });
  state.visualLoading=editor.ready().then(() => {
    state.visualEditor=editor;
    return editor;
  }).catch(error => { editor.destroy();throw error; }).finally(() => {state.visualLoading=null;});
  return state.visualLoading;
}
async function openTemplateBytes(bytes) {
  const editor=await ensureVisualEditor();
  await editor.open(assertDocxBytes(bytes));
  state.templateDirty=false;
}
async function loadVisualTemplate(force=false) {
  if (state.visualEditor && !force) return;
  if (force && state.templateDirty && !window.confirm('Discard your unpublished template edits?')) return;
  const status=$('#docxTemplateStatus');
  status.textContent='Loading published document template…';
  $('#docxSaveBtn').disabled=true;
  try {
    const template=await getNightMemoTemplateMetadata();
    state.docxTemplateVersion=template.version;
    const bytes=template.hasTemplate ? await getNightMemoVisualTemplate() : null;
    const {buildEditableTemplateSample}=await import('../documents/visual-template.js');
    await openTemplateBytes(bytes || await buildEditableTemplateSample());
    state.publishedTemplate=Boolean(bytes);
    status.textContent=`Ready to edit · published version ${template.version}${bytes ? '' : ' (default template)'}. Changes apply to new documents only after Publish.`;
  } catch(error) {
    status.textContent=`Unable to open template: ${error.message || error}`;
    throw error;
  } finally {$('#docxSaveBtn').disabled=false;}
}
async function resetVisualTemplate() {
  if(state.templateDirty && !window.confirm('Replace your unpublished edits with the default template?')) return;
  try {
    const template=await getNightMemoTemplateMetadata();
    const {buildEditableTemplateSample}=await import('../documents/visual-template.js');
    await openTemplateBytes(await buildEditableTemplateSample());
    state.docxTemplateVersion=template.version;
    state.templateDirty=true;
    $('#docxTemplateStatus').textContent='Default template loaded. Publish it to replace the shared template.';
  } catch(error) {flash(error.message||String(error),'error',8000);}
}
async function publishVisualTemplate() {
  const status=$('#docxTemplateStatus');
  if(state.docxTemplateVersion===null||!state.visualEditor) {flash('Load the template before publishing.','error');return;}
  const button=$('#docxSaveBtn'); button.disabled=true;
  try {
    const {validateVisualTemplate}=await import('../documents/visual-template.js');
    const bytes=validateVisualTemplate(await state.visualEditor.export('DOCX'));
    const saved=await publishNightMemoVisualTemplate(bytes,state.docxTemplateVersion);
    state.docxTemplateVersion=saved.version;
    state.templateDirty=false;
    state.publishedTemplate=true;
    status.textContent=`Published version ${saved.version}. Newly generated Night Memos will use this document. Existing saved drafts and reports are unchanged.`;
    flash('Visual DOCX template published successfully.','success');
  } catch(error) {
    status.textContent=`Cannot publish: ${error.message||error}`;
    flash(status.textContent,'error',10000);
  } finally {button.disabled=false;}
}
async function downloadVisualTemplateSample() {
  const button=$('#docxSampleBtn');button.disabled=true;
  try {
    if (!state.visualEditor) throw new Error('Wait until the template editor opens.');
    const {validateVisualTemplate,renderVisualTemplate}=await import('../documents/visual-template.js');
    const template=validateVisualTemplate(await state.visualEditor.export('DOCX'));
    const sample={title:'Night Memo (Male)',header:{fromName:'Sample APN',dectPhone:'2322',callTeam:'MC',date:'19/9/2025'},
      mainTableRows:[{ward:'C10',admissionEC:3,admissionCC:0,transferIn:0,discharge:3,transferOut:2,death:0,totalPatient:7,emptyBed:'1D',ventilator:0,bipap:0,hfnc:0,staff:'3/3'}],
      infectionRows:[{ward:'C10',covid:0,cre:0,vre:0,mdra:0,cd:0,influenza:'1M (bed 1)',hdCapd:'HD: 0 CAPD: 0',remarks:''}],
      earlyBirdHtml:'<div>C10: 1F (bed 5) to KH3B</div>',emptyBedHtml:'<div>C10: 1D room</div>',
      additionalReportHtml:'<div>Example report</div>',ct:{total:0,maleGeneral:0,maleCohort:0,femaleGeneral:0,femaleCohort:0},
      signature:{name:'Sample APN',designation:'N.O./APN'}};
    const bytes=renderVisualTemplate(template,sample);
    const url=URL.createObjectURL(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}));
    const a=document.createElement('a');a.href=url;a.download='Night-Memo-Template-Preview.docx';document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),30000);
    $('#docxTemplateStatus').textContent='Preview downloaded. Template is NOT published until you click Publish This Template.';
  } catch(error) {flash(`Unable to create preview: ${error.message||error}`,'error',9000);}
  finally {button.disabled=false;}
}
