import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('real account bootstrap creates and resumes 12 accounts under simulated Supabase', () => {
  const path = fileURLToPath(new URL('./support/bootstrap-accounts-vm.mjs', import.meta.url));
  const result = spawnSync(process.execPath, ['--experimental-vm-modules', path], {encoding:'utf8'});
  assert.equal(result.status,0,`${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout,/12 accounts provisioned/);
});
