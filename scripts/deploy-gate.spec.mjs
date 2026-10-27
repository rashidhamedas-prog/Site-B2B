import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import {
  assertApproval,
  checkApprovalFile,
  consumeApproval,
  drainWaitTick,
  formatDeployLog,
  readApproval,
  waitForInFlightDrain,
} from './lib/deploy-gate.mjs';

const SHA = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const OTHER = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

test('readApproval fails when file is missing', () => {
  assert.throws(() => readApproval(join(tmpdir(), 'no-such-deploy-approval.json')), (err) => {
    assert.equal(err.code, 'APPROVAL_MISSING');
    return true;
  });
});

test('assertApproval rejects wrong commit even when FORCE is set', () => {
  assert.throws(
    () =>
      assertApproval({
        approval: { commit: OTHER, goRef: 'GO Hamed test' },
        commit: SHA,
        force: true,
      }),
    (err) => {
      assert.equal(err.code, 'APPROVAL_COMMIT_MISMATCH');
      assert.match(String(err.message), /FORCE does not bypass/);
      return true;
    },
  );
});

test('assertApproval accepts matching commit and goRef', () => {
  const ok = assertApproval({
    approval: { commit: SHA, goRef: 'GO حامد 2026-10-27' },
    commit: SHA,
    force: '1',
  });
  assert.equal(ok.commit, SHA);
  assert.equal(ok.goRef, 'GO حامد 2026-10-27');
});

test('checkApprovalFile: missing, wrong commit, and FORCE still blocked', () => {
  const dir = mkdtempSync(join(tmpdir(), 'deploy-gate-'));
  const file = join(dir, 'deploy-approval.json');
  try {
    assert.throws(() => checkApprovalFile({ filePath: file, commit: SHA, force: 1 }), (err) => {
      assert.equal(err.code, 'APPROVAL_MISSING');
      return true;
    });

    writeFileSync(file, JSON.stringify({ commit: OTHER, goRef: 'GO x' }), 'utf8');
    assert.throws(() => checkApprovalFile({ filePath: file, commit: SHA, force: '1' }), (err) => {
      assert.equal(err.code, 'APPROVAL_COMMIT_MISMATCH');
      return true;
    });

    writeFileSync(file, JSON.stringify({ commit: SHA, goRef: 'GO حامد PR-0' }), 'utf8');
    const ok = checkApprovalFile({ filePath: file, commit: SHA, force: '1' });
    assert.equal(ok.goRef, 'GO حامد PR-0');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('consumeApproval deletes the file and appends the deploy log', () => {
  const dir = mkdtempSync(join(tmpdir(), 'deploy-gate-'));
  const file = join(dir, 'deploy-approval.json');
  const log = join(dir, 'logs', 'deploy.log');
  writeFileSync(file, JSON.stringify({ commit: SHA, goRef: 'GO 1' }), 'utf8');
  const line = consumeApproval({
    filePath: file,
    logPath: log,
    commit: SHA,
    goRef: 'GO 1',
    at: new Date('2026-10-27T12:00:00.000Z'),
  });
  assert.equal(existsSync(file), false);
  assert.equal(line, formatDeployLog({ commit: SHA, goRef: 'GO 1', at: new Date('2026-10-27T12:00:00.000Z') }));
  assert.equal(readFileSync(log, 'utf8').trim(), line);
  rmSync(dir, { recursive: true, force: true });
});

function runGateCli(runtime, script, args) {
  return spawnSync(runtime, [script, ...args], { encoding: 'utf8' });
}

for (const [label, runtime, script] of [
  ['node', process.execPath, join('scripts', 'lib', 'deploy-gate.mjs')],
  ['python', process.platform === 'win32' ? 'python' : 'python3', join('scripts', 'lib', 'deploy-gate.py')],
]) {
  test(`CLI (${label}) assert-approval: missing, wrong commit, FORCE still fails`, () => {
    const dir = mkdtempSync(join(tmpdir(), `deploy-gate-cli-${label}-`));
    const file = join(dir, 'deploy-approval.json');

    const missing = runGateCli(runtime, script, [
      'assert-approval',
      '--file',
      file,
      '--commit',
      SHA,
      '--force',
      '1',
    ]);
    assert.notEqual(missing.status, 0);
    assert.match(missing.stderr, /approval missing/i);

    writeFileSync(file, JSON.stringify({ commit: OTHER, goRef: 'GO x' }), 'utf8');
    const wrong = runGateCli(runtime, script, [
      'assert-approval',
      '--file',
      file,
      '--commit',
      SHA,
      '--force',
      '1',
    ]);
    assert.notEqual(wrong.status, 0);
    assert.match(wrong.stderr, /mismatch|FORCE/i);

    writeFileSync(file, JSON.stringify({ commit: SHA, goRef: 'GO ok' }), 'utf8');
    const ok = runGateCli(runtime, script, [
      'assert-approval',
      '--file',
      file,
      '--commit',
      SHA,
      '--force',
      '1',
    ]);
    assert.equal(ok.status, 0, ok.stderr);
    assert.match(ok.stdout, /"goRef":\s*"GO ok"/);

    rmSync(dir, { recursive: true, force: true });
  });
}

test('drainWaitTick aborts when still busy past timeout (no kill)', () => {
  assert.equal(drainWaitTick({ startedAt: 0, now: 50, timeoutMs: 120, stillBusy: false }), 'drained');
  assert.equal(drainWaitTick({ startedAt: 0, now: 50, timeoutMs: 120, stillBusy: true }), 'continue');
  assert.equal(drainWaitTick({ startedAt: 0, now: 120, timeoutMs: 120, stillBusy: true }), 'abort');
});

test('waitForInFlightDrain completes a 45s-class send under 120s budget', async () => {
  let clock = 0;
  const result = await waitForInFlightDrain({
    sendMs: 45_000,
    timeoutMs: 120_000,
    now: () => clock,
    sleep: async (ms) => {
      clock += ms;
    },
  });
  assert.equal(result.ok, true);
  assert.ok(result.waitedMs >= 45_000);
  assert.ok(result.waitedMs <= 120_000);
});

test('waitForInFlightDrain aborts when send exceeds drain budget', async () => {
  let clock = 0;
  const result = await waitForInFlightDrain({
    sendMs: 150_000,
    timeoutMs: 120_000,
    now: () => clock,
    sleep: async (ms) => {
      clock += ms;
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'drain_timeout');
  assert.equal(result.waitedMs, 120_000);
});
