import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const harness = fileURLToPath(new URL('./support/runtime-mode-vm.mjs', import.meta.url));
for (const scenario of ['demo', 'missing', 'live']) {
  test(`real login/auth/database modules agree in ${scenario} mode`, () => {
    const result = spawnSync(process.execPath,
      ['--no-warnings', '--experimental-vm-modules', harness, scenario],
      { encoding: 'utf8', timeout: 10_000 });
    assert.equal(result.status, 0, [result.stdout, result.stderr].join('\n'));
    assert.match(result.stdout, new RegExp(`Runtime integration ${scenario}: passed`));
  });
}
