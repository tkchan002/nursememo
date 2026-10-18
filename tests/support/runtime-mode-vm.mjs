// Executes the REAL browser modules against a minimal, deterministic browser API.
// Run via: node --experimental-vm-modules tests/support/runtime-mode-vm.mjs demo|missing|live|secure
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const scenario = process.argv[2];
assert.ok(['demo', 'missing', 'live', 'secure'].includes(scenario));
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
  addEventListener(type, listener) {
    this.listeners ??= new Map();
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }
  async fire(type, event = {}) {
    const listeners = this.listeners?.get(type) ?? [];
    for (const listener of listeners) await listener({ target: this, ...event });
  }
  focus() { this.focused = true; }
}
const nodes = new Map();
const el = selector => {
  if (!nodes.has(selector)) nodes.set(selector, new FakeElement());
  return nodes.get(selector);
};
const roleButtons = ['ward', 'patrol', 'maintenance'].map(role => {
  const button = new FakeElement();
  button.dataset.role = role;
  return button;
});
let createClientCalls = 0;
let capturedLogin = null;
const client = {
  functions:{invoke:async(name,config)=>{ assert.equal(name,'user-login');capturedLogin=config.body;return {data:{access_token:'test-access',refresh_token:'test-refresh'},error:null}; }},
  auth: {
    setSession: async tokens => { assert.equal(tokens.access_token,'test-access'); assert.equal(tokens.refresh_token,'test-refresh'); return { data: { user: {id:'test-user'},session:{user:{id:'test-user'}} },error:null }; },
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
    // Test scenarios must not depend on the settings committed for deployment.
    // In particular, 'missing' must remove live credentials, and 'demo' must
    // enable demo even when the deployed site uses real Supabase.
    const live = scenario === 'live' || scenario === 'secure';
    const settings = {
      FORCE_DEMO_MODE: scenario === 'demo',
      SUPABASE_URL: live ? 'https://example.supabase.co' : 'https://YOUR-PROJECT.supabase.co',
      SUPABASE_PUBLISHABLE_KEY: live ? 'sb_publishable_example123' : 'YOUR_SUPABASE_PUBLISHABLE_KEY',
    };
    for (const [field, value] of Object.entries(settings)) {
      const pattern = new RegExp(`^(\\s*${field}\\s*:\\s*)(?:true|false|'[^'\\n]*'|"[^"\\n]*")(\\s*,?\\s*)$`, 'gm');
      let matches = 0;
      source = source.replace(pattern, (_whole, prefix, suffix) => {
        matches += 1;
        return `${prefix}${JSON.stringify(value)}${suffix}`;
      });
      assert.equal(matches, 1, `Expected exactly one CONFIG.${field} initializer`);
    }
  }
  if (filepath === resolve(root, 'core/test-password-mode.js')) {
    // Also isolate the insecure test-password setting from the deployed value.
    // The 'secure' scenario must test disabled mapping; the remaining scenarios
    // intentionally exercise enabled mapping even if the site has disabled it.
    const pattern = /^(export const INSECURE_TEST_PASSWORDS\s*=\s*)(?:true|false)(\s*;?\s*)$/gm;
    let matches = 0;
    source = source.replace(pattern, (_whole, prefix, suffix) => {
      matches += 1;
      return `${prefix}${scenario === 'secure' ? 'false' : 'true'}${suffix}`;
    });
    assert.equal(matches, 1, 'Expected one INSECURE_TEST_PASSWORDS setting');
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
  await wardButton.fire('click');
  assert.equal(loginId.value, '');
  assert.equal(password.value, '');
  assert.match(el('#modeBadge').innerHTML, /Setup required/);
  await assert.rejects(entry('data/client.js'), /Supabase is not configured/);
  assert.equal(createClientCalls, 0, 'invalid production configuration must not instantiate a client');
} else if (scenario === 'demo') {
  assert.equal(wardButton.disabled, false);
  assert.equal(introError.classList.contains('hidden'), true);
  await wardButton.fire('click');
  assert.equal(loginId.type, 'text');
  assert.equal(loginId.value, 'C10');
  assert.equal(password.value, 'demo');
  assert.match(el('#modeBadge').innerHTML, /Local demo mode/);
  let prevented = false;
  await el('#loginForm').fire('submit', { preventDefault: () => { prevented = true; } });
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
  await wardButton.fire('click');
  assert.equal(loginId.type, 'text');
  assert.equal(loginId.value, '');
  assert.equal(password.value, '');
  const database = await entry('data/client.js');
  assert.equal(database.DB_MODE, 'supabase');
  assert.equal(createClientCalls, 1);
  loginId.value = 'c10';
  password.value = 'example-test-password';
  await el('#loginForm').fire('submit', { preventDefault: () => {} });
  assert.equal(capturedLogin?.login_id, 'c10');
  assert.equal(capturedLogin?.password, 'example-test-password');
  const auth = await entry('services/auth-service.js');
  await auth.signIn('C10', 'c10', 'ward');
  assert.equal(capturedLogin?.login_id, 'C10');
  assert.equal(capturedLogin?.password, 'c10', 'application password is never converted in browser');
  await auth.signIn('E10', 'wrong', 'ward');
  assert.equal(capturedLogin?.password, 'wrong');
  assert.equal(ctx.location.target, './ward.html');
}
console.log(`Runtime integration ${scenario}: passed`);
