import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const harness = fileURLToPath(new URL('./support/bootstrap-accounts-vm.mjs', import.meta.url));
for (const scenario of ['easy', 'secure', 'missing-ack']) {
  test(`account bootstrap ${scenario} behavior uses real script and a fake Supabase backend`, () => {
    const result = spawnSync(process.execPath,
      ['--no-warnings', '--experimental-vm-modules', harness, scenario],
      { encoding: 'utf8', timeout: 15000 });
    assert.equal(result.status, 0, [result.stdout, result.stderr].join('\n'));
    assert.match(result.stdout, new RegExp(`Bootstrap (?:runtime integration ${scenario}|missing explicit demo acknowledgement)`));
  });
}
