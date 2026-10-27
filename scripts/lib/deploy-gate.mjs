/**
 * Deploy approval gate + drain helpers (testable JS; production CLI is deploy-gate.py).
 * FORCE / TARANOM_DEPLOY_FORCE must never bypass approval.
 */
import { existsSync, readFileSync, unlinkSync, appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * @typedef {{ commit?: string, goRef?: string, approvedAt?: string }} DeployApproval
 */

/**
 * @param {string} filePath
 * @returns {DeployApproval}
 */
export function readApproval(filePath) {
  if (!filePath || !existsSync(filePath)) {
    const err = new Error(`deploy approval missing: ${filePath || '(empty path)'}`);
    err.code = 'APPROVAL_MISSING';
    throw err;
  }
  let raw;
  try {
    raw = JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (cause) {
    const err = new Error(`deploy approval unreadable: ${filePath}`);
    err.code = 'APPROVAL_INVALID';
    err.cause = cause;
    throw err;
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    const err = new Error('deploy approval must be a JSON object');
    err.code = 'APPROVAL_INVALID';
    throw err;
  }
  return /** @type {DeployApproval} */ (raw);
}

/**
 * @param {{ approval: DeployApproval, commit: string, force?: boolean | string }} opts
 * @returns {{ commit: string, goRef: string }}
 */
export function assertApproval({ approval, commit, force = false }) {
  const target = String(commit || '').trim().toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(target)) {
    const err = new Error(`deploy target commit must be a full 40-char sha, got: ${commit || '(empty)'}`);
    err.code = 'COMMIT_INVALID';
    throw err;
  }

  const approved = String(approval?.commit || '').trim().toLowerCase();
  if (!approved) {
    const err = new Error('deploy approval.commit is required');
    err.code = 'APPROVAL_INVALID';
    throw err;
  }
  if (approved !== target) {
    const err = new Error(
      `deploy approval commit mismatch: approval=${approved.slice(0, 12)} target=${target.slice(0, 12)}` +
        (force && String(force) !== '0' && String(force) !== 'false' ? ' (FORCE does not bypass)' : ''),
    );
    err.code = 'APPROVAL_COMMIT_MISMATCH';
    throw err;
  }

  const goRef = String(approval?.goRef || '').trim();
  if (!goRef) {
    const err = new Error('deploy approval.goRef is required (written GO from Hamed)');
    err.code = 'APPROVAL_INVALID';
    throw err;
  }

  return { commit: target, goRef };
}

/**
 * @param {{ filePath: string, commit: string, force?: boolean | string }} opts
 */
export function checkApprovalFile({ filePath, commit, force = false }) {
  const approval = readApproval(filePath);
  return assertApproval({ approval, commit, force });
}

/**
 * @param {{ filePath: string, logPath: string, commit: string, goRef: string, at?: Date }} opts
 */
export function consumeApproval({ filePath, logPath, commit, goRef, at = new Date() }) {
  const line = formatDeployLog({ commit, goRef, at });
  const dir = dirname(logPath);
  if (dir && dir !== '.') mkdirSync(dir, { recursive: true });
  appendFileSync(logPath, `${line}\n`, 'utf8');
  if (filePath && existsSync(filePath)) unlinkSync(filePath);
  return line;
}

/**
 * @param {{ commit: string, goRef: string, at?: Date }} opts
 */
export function formatDeployLog({ commit, goRef, at = new Date() }) {
  return `${at.toISOString()}\tcommit=${commit}\tgoRef=${goRef}`;
}

/**
 * @param {{ startedAt: number, now: number, timeoutMs: number, stillBusy: boolean }} opts
 * @returns {'continue' | 'drained' | 'abort'}
 */
export function drainWaitTick({ startedAt, now, timeoutMs, stillBusy }) {
  if (!stillBusy) return 'drained';
  if (now - startedAt >= timeoutMs) return 'abort';
  return 'continue';
}

/**
 * Simulate an in-flight send (e.g. Rubika ~45s) under a drain deadline.
 * @param {{ sendMs: number, timeoutMs: number, now?: () => number, sleep?: (ms: number) => Promise<void> }} opts
 */
export async function waitForInFlightDrain({
  sendMs,
  timeoutMs,
  now = Date.now,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
}) {
  const startedAt = now();
  const busyUntil = startedAt + sendMs;

  while (true) {
    const t = now();
    const stillBusy = t < busyUntil;
    const decision = drainWaitTick({ startedAt, now: t, timeoutMs, stillBusy });
    if (decision === 'drained') return { ok: true, waitedMs: t - startedAt };
    if (decision === 'abort') return { ok: false, waitedMs: t - startedAt, reason: 'drain_timeout' };
    const step = Math.min(50, Math.max(1, busyUntil - t));
    await sleep(step);
  }
}

function parseArgs(argv) {
  /** @type {Record<string, string>} */
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq !== -1) {
      out[a.slice(2, eq)] = a.slice(eq + 1);
      continue;
    }
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      out[key] = next;
      i++;
    } else {
      out[key] = '1';
    }
  }
  return out;
}

function main(argv = process.argv.slice(2)) {
  const cmd = argv[0];
  const args = parseArgs(argv.slice(1));
  if (cmd === 'assert-approval') {
    const result = checkApprovalFile({
      filePath: args.file,
      commit: args.commit,
      force: args.force || process.env.TARANOM_DEPLOY_FORCE || '',
    });
    process.stdout.write(JSON.stringify(result) + '\n');
    return;
  }
  if (cmd === 'consume-approval') {
    const line = consumeApproval({
      filePath: args.file,
      logPath: args.log,
      commit: args.commit,
      goRef: args['go-ref'] || args.goRef || '',
    });
    process.stdout.write(line + '\n');
    return;
  }
  console.error('usage: deploy-gate.mjs assert-approval --file PATH --commit SHA [--force 1]');
  console.error('       deploy-gate.mjs consume-approval --file PATH --log PATH --commit SHA --go-ref REF');
  process.exit(2);
}

const isCli = process.argv[1] && /deploy-gate\.mjs$/.test(process.argv[1].replace(/\\/g, '/'));
if (isCli) {
  try {
    main();
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
