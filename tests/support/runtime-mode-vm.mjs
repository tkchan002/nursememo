// Executes the REAL browser modules against a minimal, deterministic browser API.
// Run via: node --experimental-vm-modules tests/support/runtime-mode-vm.mjs demo|missing|live
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const scenario = process.argv[2];
assert.ok(['demo', 'missing', 'live'].includes(scenario));
const storage = () => {
  const records = new Map();
  return {
    getItem: key => records.has(key) ? records.get(key) : null,
    setItem: (key, value) => records.set(key, String(value)),
    removeItem: key => records.delete(key),
  };
};
class FakeElement {
  constructor() {
    this.value = '';
    this.type = 'password';
    this.dataset = {};
    this.disabled = false;
    this.textContent = '';
    this.innerHTML = '';
    this.readOnly = false;
    this.classes = new Set(['hidden']);
    this.classList = {
      add: name => this.classes.add(name),
      remove: name => this.classes.delete(name),
      toggle: (name, force) => {
        const add = force === undefined ? !this.classes.has(name) : force;
        if (add) this.classes.add(name);
        else this.classes.delete(name);
      },
      contains: name => this.classes.has(name),
    };
  }
  setAttribute(name, value) { this[name] = value; }
  focus() { this.focused = true; }
}
const nodes = new Map();
const el = selector => {
  if (!nodes.has(selector)) nodes.set(selector, new FakeElement());
  return nodes.get(selector);
};
const roleButtons = ['ward', 'manager', 'maintenance'].map(role => {
  const button = new FakeElement();
  button.dataset.role = role;
  return button;
});
let createClientCalls = 0;
let capturedLogin = null;
const client = {
  auth: {
    signInWithPassword: async credentials => { capturedLogin = credentials; return { data: { user: { id: 'test-user' }, session: { user: { id: 'test-user' } } }, error: null }; },
    getSession: async () => ({ data: { session: { user: { id: 'test-user' } } }, error: null }),
    signOut: async () => {},
  },
};
const ctx = vm.createContext({
  console, URL, Date, Intl, JSON, Math, crypto: globalThis.crypto || (await import('node:crypto')).webcrypto,
  setTimeout: () => 0,
  window: {},
  localStorage: storage(),
  sessionStorage: storage(),
  location: { replace: target => { ctx.location.target = target; } },
  document: {
    querySelector: el,
    querySelectorAll: selector => selector === '.login-option' ? roleButtons : [],
  },
});
const cache = new Map();
async function resolveModule(specifier, referencingModule) {
  if (specifier === '@supabase/supabase-js') {
    if (!cache.has(specifier)) {
      cache.set(specifier, new vm.SyntheticModule(['createClient'], function () {
        this.setExport('createClient', () => { createClientCalls++; return client; });
      }, { context: ctx, identifier: specifier }));
    }
    return cache.get(specifier);
  }
  const filepath = resolve(dirname(referencingModule.identifier), specifier);
  return load(filepath);
}
async function load(filepath) {
  if (cache.has(filepath)) return cache.get(filepath);
  let source = await readFile(filepath, 'utf8');
  if (filepath === resolve(root, 'config.js')) {
    if (scenario !== 'demo') source = source.replace('FORCE_DEMO_MODE: true', 'FORCE_DEMO_MODE: false');
    if (scenario === 'live') source = source.replace('https://YOUR-PROJECT.supabase.co', 'https://example.supabase.co').replace('YOUR_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_example123');
  }
  const mod = new vm.SourceTextModule(source, {
    context: ctx,
    identifier: filepath,
    importModuleDynamically: async (specifier, referencingModule) => {
      const child = await resolveModule(specifier, referencingModule);
      if (child.status === 'unlinked') await child.link(resolveModule);
      if (child.status === 'linked') await child.evaluate();
      return child;
    },
  });
  cache.set(filepath, mod);
  return mod;
}
async function entry(filename) {
  const mod = await load(resolve(root, filename));
  if (mod.status === 'unlinked') await mod.link(resolveModule);
  if (mod.status === 'linked') await mod.evaluate();
  return mod.namespace;
}

const login = await entry('pages/login-page.js');
assert.ok(login);
const introError = el('#loginConfigError');
const wardButton = roleButtons[0];
const loginId = el('#loginId');
const password = el('#password');

if (scenario === 'missing') {
  assert.equal(wardButton.disabled, true, 'missing live credentials must disable login');
  assert.equal(el('#loginBtn').disabled, true);
  assert.equal(introError.classList.contains('hidden'), false);
  assert.match(introError.textContent, /Supabase is not configured/);
  wardButton.onclick();
  assert.equal(loginId.value, '');
  assert.equal(password.value, '');
  assert.match(el('#modeBadge').innerHTML, /Setup required/);
  await assert.rejects(entry('data/client.js'), /Supabase is not configured/);
  assert.equal(createClientCalls, 0, 'invalid production configuration must not instantiate a client');
} else if (scenario === 'demo') {
  assert.equal(wardButton.disabled, false);
  assert.equal(introError.classList.contains('hidden'), true);
  wardButton.onclick();
  assert.equal(loginId.type, 'text');
  assert.equal(loginId.value, 'C10');
  assert.equal(password.value, 'demo');
  assert.match(el('#modeBadge').innerHTML, /Local demo mode/);
  let prevented = false;
  await el('#loginForm').onsubmit({ preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(ctx.location.target, './ward.html', 'successful form login must navigate to the Ward page');
  const auth = await entry('services/auth-service.js');
  const access = await auth.requireRole('ward');
  assert.equal(access?.login_id, 'C10');
  await assert.rejects(auth.signIn('C10', 'incorrect', 'ward'), /Invalid account or password/);
  assert.equal(createClientCalls, 0, 'demo must not initialize Supabase');
} else {
  assert.equal(wardButton.disabled, false);
  assert.equal(introError.classList.contains('hidden'), true);
  wardButton.onclick();
  assert.equal(loginId.type, 'text');
  assert.equal(loginId.value, '');
  assert.equal(password.value, '');
  const database = await entry('data/client.js');
  assert.equal(database.DB_MODE, 'supabase');
  assert.equal(createClientCalls, 1);
  loginId.value = 'c10';
  password.value = 'example-test-password';
  await el('#loginForm').onsubmit({ preventDefault: () => {} });
  assert.equal(capturedLogin?.email, 'c10@accounts.nightmemo.example.com');
  assert.equal(capturedLogin?.password, 'example-test-password');
  assert.equal(ctx.location.target, './ward.html');
}
console.log(`Runtime integration ${scenario}: passed`);
