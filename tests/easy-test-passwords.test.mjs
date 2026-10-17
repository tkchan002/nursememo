import test from 'node:test';
import assert from 'node:assert/strict';
import {
  expandedTestPassword, passwordForSupabase,
} from '../supabase/functions/_shared/login-identity.mjs';

const ids = ['C10', 'E10', 'G2', 'F10', 'E6', 'C6', 'G10', 'G11', 'B10', 'H6', 'patrol', 'NightMaintenance'];

test('all seeded accounts get deterministic Supabase passwords meeting 12-character minimum', () => {
  const storedPasswords = ids.map(expandedTestPassword);
  assert.equal(new Set(storedPasswords).size, ids.length);
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    assert.ok(storedPasswords[i].length >= 12);
    assert.equal(passwordForSupabase(id, id.toLowerCase(), true), storedPasswords[i]);
    assert.equal(passwordForSupabase(id, id, true), storedPasswords[i]);
  }
});

test('the insecure mapping cannot affect normal passwords when disabled', () => {
  assert.equal(passwordForSupabase('C10', 'c10', false), 'c10');
  assert.equal(passwordForSupabase('C10', 'NotMyPassword', true), 'NotMyPassword');
  assert.equal(passwordForSupabase('C10', 'c10c10c10', true), 'c10c10c10');
});
