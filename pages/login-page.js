import { APP_RUNTIME, CONFIG } from '../config.js';
import { qs, qsa } from '../core/dom.js';
import { flash } from '../core/ui.js';
import { modeBadge } from '../components/app-shell.js';

const DB_MODE = APP_RUNTIME.mode;
const titles = {
  ward: 'Ward Login',
  manager: 'Patrol Night Login',
  maintenance: `${CONFIG.APP_NAME} Maintenance`,
};
const defaults = {
  ward: 'C10',
  manager: 'PatrolNight',
  maintenance: 'NightMaintenance',
};
const destinations = {
  ward: './ward.html',
  manager: './manager.html',
  maintenance: './maintenance.html',
};

let role = null;
let authPromise = null;

qs('#modeBadge').innerHTML = APP_RUNTIME.ready
  ? modeBadge(DB_MODE)
  : '<span class="mode-badge">Setup required</span>';

// A misconfigured production connection is visible and non-interactive from
// first paint; never show demo credentials or wait for login to discover it.
if (!APP_RUNTIME.ready) {
  const message = qs('#loginConfigError');
  message.textContent = APP_RUNTIME.error;
  message.classList.remove('hidden');
  qsa('.login-option').forEach(button => { button.disabled = true; });
  qs('#loginBtn').disabled = true;
}


function loadAuth() {
  if (!authPromise) authPromise = import('../services/auth-service.js');
  return authPromise;
}

// Let the page paint first, then prepare the auth/Supabase module in the
// background so the Login click normally waits only for credential auth.
if (APP_RUNTIME.ready && DB_MODE === 'supabase') {
  const warmAuth = () => { loadAuth().catch(() => {}); };
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(warmAuth, { timeout: 800 });
  } else {
    setTimeout(warmAuth, 0);
  }
}

qsa('.login-option').forEach(button => {
  button.addEventListener('click', () => selectRole(button.dataset.role));
});
qs('#backBtn').addEventListener('click', returnToRoleChooser);
qs('#togglePassword').addEventListener('click', () => {
  setPasswordVisibility(qs('#password').type === 'password');
});
qs('#loginForm').addEventListener('submit', async event => {
  event.preventDefault();
  if (!role || !APP_RUNTIME.ready) return;

  let navigating = false;
  setLoginBusy(true);
  try {
    const { signIn } = await loadAuth();
    await signIn(qs('#loginId').value, qs('#password').value, role);
    navigating = true;
    location.replace(destinations[role]);
  } catch (error) {
    flash(error.message || String(error), 'error', 6000);
  } finally {
    if (!navigating) setLoginBusy(false);
  }
});

function selectRole(nextRole) {
  if (!APP_RUNTIME.ready) return;
  role = nextRole;
  qs('#loginTitle').textContent = titles[nextRole];
  qs('#loginRolePrompt').textContent = `Sign in to ${titles[nextRole]}.`;
  qs('#loginId').type = 'text';
  qs('#loginId').value = DB_MODE === 'demo' ? defaults[nextRole] : '';
  qs('#password').value = DB_MODE === 'demo' ? 'demo' : '';
  setPasswordVisibility(false);
  setLoginBusy(false);

  qs('#demoHint').classList.toggle('hidden', DB_MODE !== 'demo');
  if (DB_MODE === 'demo') qs('#demoHint').textContent = 'Demo mode is enabled. Password: demo.';

  qs('#loginBox').classList.add('show');
  qs('#loginIntro').classList.add('hidden');
  qsa('.login-option').forEach(button => {
    button.classList.toggle('active', button.dataset.role === nextRole);
  });
  setTimeout(() => qs('#loginId').focus(), 30);
}

function returnToRoleChooser() {
  role = null;
  qs('#loginBox').classList.remove('show');
  qs('#loginIntro').classList.remove('hidden');
  qs('#loginId').value = '';
  qs('#password').value = '';
  setPasswordVisibility(false);
  setLoginBusy(false);
  qsa('.login-option').forEach(button => button.classList.remove('active'));
}

function setPasswordVisibility(visible) {
  const input = qs('#password');
  const button = qs('#togglePassword');
  input.type = visible ? 'text' : 'password';
  button.setAttribute('aria-pressed', String(visible));
  button.setAttribute('aria-label', visible ? 'Hide password' : 'Show password');
  button.title = visible ? 'Hide password' : 'Show password';
}

function setLoginBusy(busy) {
  const button = qs('#loginBtn');
  button.disabled = busy;
  button.setAttribute('aria-busy', String(busy));
  button.textContent = busy ? 'Signing in…' : 'Login';

  qs('#loginId').readOnly = busy;
  qs('#password').readOnly = busy;
  qs('#backBtn').disabled = busy;
  qs('#togglePassword').disabled = busy;
}
