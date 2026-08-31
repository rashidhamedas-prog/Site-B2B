export type OutboxMetricRow = {
  status: string;
  availableAt?: Date | string | null;
  lockedAt?: Date | string | null;
};

export type OutboxMetrics = {
  pending: number;
  processing: number;
  done: number;
  dead: number;
  oldestPendingAgeSec: number;
  staleLocks: number;
};

const STALE_LOCK_MS = 5 * 60 * 1000;

function ageMs(value: Date | string | null | undefined, now: Date): number {
  if (!value) return 0;
  const t = new Date(value).getTime();
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, now.getTime() - t);
}

/** Durable counters from outbox rows — not process-local memory. */
export function summarizeOutbox(rows: OutboxMetricRow[], now = new Date()): OutboxMetrics {
  const metrics: OutboxMetrics = {
    pending: 0,
    processing: 0,
    done: 0,
    dead: 0,
    oldestPendingAgeSec: 0,
    staleLocks: 0,
  };
  let oldest = 0;
  for (const row of rows) {
    const status = String(row.status || '').toUpperCase();
    if (status === 'PENDING') metrics.pending += 1;
    else if (status === 'PROCESSING') metrics.processing += 1;
    else if (status === 'DONE') metrics.done += 1;
    else if (status === 'DEAD') metrics.dead += 1;
    if (status === 'PENDING' || status === 'PROCESSING') {
      oldest = Math.max(oldest, ageMs(row.availableAt, now));
    }
    if (status === 'PROCESSING' && ageMs(row.lockedAt, now) > STALE_LOCK_MS) {
      metrics.staleLocks += 1;
    }
  }
  metrics.oldestPendingAgeSec = Math.floor(oldest / 1000);
  return metrics;
}
