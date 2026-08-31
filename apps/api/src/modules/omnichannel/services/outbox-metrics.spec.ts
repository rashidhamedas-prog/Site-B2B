/**
 * npx ts-node --transpile-only src/modules/omnichannel/services/outbox-metrics.spec.ts
 */
import { summarizeOutbox } from './outbox-metrics';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const now = new Date('2026-08-29T12:00:00.000Z');
const metrics = summarizeOutbox(
  [
    { status: 'PENDING', availableAt: '2026-08-29T11:50:00.000Z' },
    { status: 'PROCESSING', availableAt: '2026-08-29T11:00:00.000Z', lockedAt: '2026-08-29T11:56:00.000Z' },
    { status: 'PROCESSING', availableAt: now, lockedAt: '2026-08-29T11:00:00.000Z' },
    { status: 'DONE' },
    { status: 'DEAD' },
  ],
  now,
);

assert(metrics.pending === 1 && metrics.processing === 2, 'open counts');
assert(metrics.done === 1 && metrics.dead === 1, 'terminal counts');
assert(metrics.oldestPendingAgeSec === 3600, `lag ${metrics.oldestPendingAgeSec}`);
assert(metrics.staleLocks === 1, 'lock older than 5m is stale');

console.log('outbox-metrics.spec.ts: ok');
