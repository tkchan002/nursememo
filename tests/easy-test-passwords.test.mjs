import test from 'node:test';
import assert from 'node:assert/strict';
import { expandedTestPassword } from '../supabase/functions/_shared/login-identity.mjs';
const ids = ['C10', 'E10', 'G2', 'F10', 'E6', 'C6', 'G10', 'G11', 'B10', 'H6', 'patrol', 'NightMaintenance'];
test('the existing Auth account bootstrap still supports its old internal password scheme', () => {
  const passwords=ids.map(expandedTestPassword);
  assert.equal(new Set(passwords).size,ids.length);
  assert.ok(passwords.every(p => p.length >= 12));
});
test('browser application login does not contain matching-ID Auth password expansion',async()=>{
  const {readFileSync}=await import('node:fs');
  const text=readFileSync(new URL('../services/auth-service.js',import.meta.url),'utf8');
  assert.doesNotMatch(text,/expandedTestPassword|passwordForSupabase|signInWithPassword/);
  assert.match(text,/functions\.invoke\('user-login'/);
});
