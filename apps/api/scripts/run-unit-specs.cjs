/**
 * Run apps/api ts-node assert specs without a Windows cmd.exe command-line length limit.
 * Spec list: scripts/unit-specs.txt (one path per line, relative to apps/api).
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const listPath = path.join(__dirname, 'unit-specs.txt');
const lines = fs
  .readFileSync(listPath, 'utf8')
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'));

if (!lines.length) {
  console.error('unit-specs.txt is empty');
  process.exit(1);
}

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
let failed = 0;
for (const rel of lines) {
  const result = spawnSync(npx, ['ts-node', '--transpile-only', rel], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    failed += 1;
    console.error(`FAIL ${rel} (exit ${result.status})`);
    process.exit(result.status || 1);
  }
}
console.log(`unit-specs: ${lines.length} ok`);
process.exit(failed ? 1 : 0);
