// Verify that the real bootstrap script provisions all seeded wards, never
// reuses a password, and can be rerun without changing existing accounts.
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const url = 'https://fakeproject.supabase.co';
const wardNames = ['C10','E10','G2','F10','E6','C6','G10','G11','B10','H6'];
const wards = wardNames.map((name, i) => ({ id: `ward-id-${i}`, name, active:true }));
const fileSystem = new Map();
const users = [];
const access = [];
let createdCount = 0;
const client = {
  from(table) {
    if (table === 'wards') return { select: () => ({ eq: () => ({ order: async () => ({ data: wards, error: null }) }) }) };
    if (table === 'user_access') return {
      select: async () => ({ data: access.map(a => ({ ...a })), error: null }),
      insert: async row => { access.push(row); return { error: null }; },
    };
    throw Error('Unexpected table ' + table);
  },
  auth: { admin: {
    listUsers: async () => ({ data: { users: [...users] }, error: null }),
    createUser: async ({ email, password, email_confirm }) => {
      assert.equal(email_confirm, true);
      assert.ok(password.length >= 30);
      assert.ok(!users.some(u => u.email === email));
      const user = { id: `new-auth-${createdCount++}`, email };
      users.push(user);
      return { data:{ user }, error:null };
    },
    deleteUser: async id => { const i=users.findIndex(u => u.id===id); if(i >= 0)users.splice(i,1); return {error:null}; },
  } },
};

const fs = {
  mkdir: async () => {},
  readFile: async name => {
    if (!fileSystem.has(name)) throw Object.assign(new Error('no file'), {code:'ENOENT'});
    return fileSystem.get(name);
  },
  writeFile: async (name, value, opts={}) => {
    if (opts.flag==='wx' && fileSystem.has(name)) throw Object.assign(new Error('exists'), {code:'EEXIST'});
    fileSystem.set(name, value);
  },
  open: async (name, flag) => {
    if (flag==='wx' && fileSystem.has(name)) throw Object.assign(new Error('exists'), {code:'EEXIST'});
    if (flag==='wx') fileSystem.set(name,'');
    return {
      appendFile: async value => fileSystem.set(name, fileSystem.get(name) + value),
      sync: async () => {}, close: async () => {},
    };
  },
};

async function run() {
  const ctx = vm.createContext({
    console:{ log:()=>{} },
    process:{env:{ SUPABASE_URL:url, SUPABASE_SECRET_KEY:'sb_secret_test_secret_key' }},
    Set, Map, URL, Error, JSON, String,
  });
  const cache = new Map();
  async function resolveDependency(specifier, parent) {
    if (['node:crypto','node:fs/promises','@supabase/supabase-js'].includes(specifier)) {
      if (!cache.has(specifier)) {
        const exports = specifier==='node:crypto' ? {randomBytes}
          : specifier==='node:fs/promises' ? fs : { createClient: () => client };
        cache.set(specifier, new vm.SyntheticModule(Object.keys(exports), function () {
          for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
        }, {context:ctx,identifier:specifier}));
      }
      return cache.get(specifier);
    }
    const filepath = resolve(dirname(parent.identifier), specifier);
    if (cache.has(filepath)) return cache.get(filepath);
    const source = await readFile(filepath,'utf8');
    const mod = new vm.SourceTextModule(source,{context:ctx,identifier:filepath});
    cache.set(filepath,mod);
    return mod;
  }
  const entrypoint = resolve(root,'scripts/bootstrap-accounts.mjs');
  const main = await resolveDependency(entrypoint, {identifier:resolve(root,'entry.mjs')});
  await main.link(resolveDependency);
  await main.evaluate();
}

await run();
assert.equal(createdCount,12);
assert.equal(access.length,12);
assert.equal(access.filter(a => a.role==='ward').length,10);
assert.equal(access.filter(a => a.role==='manager').length,1);
assert.equal(access.filter(a => a.role==='maintenance').length,1);
for(const row of access) {
  const user=users.find(u=>u.id===row.auth_user_id);
  assert.equal(user?.email, `${row.login_id.toLowerCase()}@accounts.nightmemo.example.com`);
  if(row.role==='ward') assert.ok(row.ward_id);
  else assert.equal(row.ward_id,null);
}
const initialCsv = fileSystem.get('.private/initial-accounts.csv');
const credentials = initialCsv.trim().split('\n');
assert.equal(credentials.length,13);
assert.equal(new Set(credentials.slice(1).map(x=>x.split(',')[2])).size,12);
await run();
assert.equal(createdCount,12, 'rerun must not recreate or reset accounts');
assert.equal(fileSystem.get('.private/initial-accounts.csv'), initialCsv);
console.log('Bootstrap runtime integration: 12 accounts provisioned; rerun preserved passwords.');
