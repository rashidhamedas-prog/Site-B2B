/**
 * GA4 purchase ledger state machine + the exact SQL the service runs.
 * Shared with scripts/ga4-mp-concurrency.ts so the race tests exercise real SQL.
 * Postgres only; every time comparison uses now() (never a JS Date).
 */
import {
  GA4_EXPIRE_AFTER_HOURS,
  GA4_MAX_ATTEMPTS,
  nextAttemptDelayMs,
  type Ga4SendOutcome,
} from './ga4-mp';

export const GA4_LEDGER_STATUSES = [
  'PENDING',
  'SENDING',
  'SENT',
  'FAILED',
  'CLIENT_FALLBACK',
  'SKIPPED',
  'INVALID',
  'EXPIRED',
] as const;
export type Ga4LedgerStatus = (typeof GA4_LEDGER_STATUSES)[number];

/**
 * Server owns the purchase once it claimed the row; INVALID/EXPIRED are only
 * reached after a server claim, so the browser must not send late.
 */
const SERVER_OWNED: ReadonlySet<string> = new Set(['SENDING', 'SENT', 'FAILED', 'INVALID', 'EXPIRED']);

export function ownershipForStatus(status: string): { serverOwned: boolean; status: Ga4LedgerStatus } {
  const known = (GA4_LEDGER_STATUSES as readonly string[]).includes(status)
    ? (status as Ga4LedgerStatus)
    : 'SKIPPED';
  return { serverOwned: SERVER_OWNED.has(known), status: known };
}

export const GA4_LEASE_SECONDS = 120;
/** Rows written before the lease column existed: treat updatedAt + 5m as their lease. */
const LEASE_EXPIRED = `COALESCE("leaseUntil", "updatedAt"::timestamptz + interval '5 minutes') < now()`;
const EVENT_AT = `COALESCE("eventAt", "createdAt"::timestamptz)`;

/** `"analytics_event_log"` or `"<schema>"."analytics_event_log"` (schema validated). */
export function ga4LedgerTable(schema?: string): string {
  if (!schema) return '"analytics_event_log"';
  if (!/^[a-z_][a-z0-9_]{0,62}$/.test(schema)) throw new Error('invalid schema name');
  return `"${schema}"."analytics_event_log"`;
}

export type SqlQuery = { sql: string; params: unknown[] };

/** Idempotent ledger insert; the unique (eventName, transactionId) swallows duplicates. */
export function insertPendingSql(
  t: string,
  v: {
    transactionId: string;
    channel: string;
    measurementId: string | null;
    orderId: string | null;
    paymentId: string | null;
    valueIrr: number;
  },
): SqlQuery {
  return {
    sql: `INSERT INTO ${t} ("eventName", "transactionId", "channel", "measurementId", "orderId", "paymentId", "valueIrr", "status", "eventAt")
VALUES ('purchase', $1, $2, $3, $4, $5, $6, 'PENDING', now())
ON CONFLICT ("eventName", "transactionId") DO NOTHING
RETURNING "id"`,
    params: [v.transactionId, v.channel, v.measurementId, v.orderId, v.paymentId, v.valueIrr],
  };
}

export function selectByTransactionSql(t: string, transactionId: string): SqlQuery {
  return {
    sql: `SELECT "id", "status", ${EVENT_AT} AS "eventAt" FROM ${t}
WHERE "eventName" = 'purchase' AND "transactionId" = $1`,
    params: [transactionId],
  };
}

/** Browser takes over; only from PENDING, so it can never steal a server claim. */
export function clientFallbackSql(t: string, id: string, reason: string): SqlQuery {
  return {
    sql: `UPDATE ${t} SET "status" = 'CLIENT_FALLBACK', "lastError" = $2, "updatedAt" = now()
WHERE "id" = $1 AND "status" = 'PENDING'
RETURNING "id"`,
    params: [id, reason],
  };
}

/** Verify-path claim PENDING → SENDING with a lease; exactly one concurrent caller wins. */
export function inlineClaimSql(t: string, id: string, gaClientId: string, gaSessionId: string | null): SqlQuery {
  return {
    sql: `UPDATE ${t} SET "status" = 'SENDING', "attempts" = "attempts" + 1,
  "gaClientId" = $2, "gaSessionId" = $3,
  "leaseUntil" = now() + interval '${GA4_LEASE_SECONDS} seconds', "nextAttemptAt" = NULL, "updatedAt" = now()
WHERE "id" = $1 AND "status" = 'PENDING'
RETURNING "id", "attempts"`,
    params: [id, gaClientId, gaSessionId],
  };
}

/**
 * Worker batch claim: due FAILED rows and SENDING rows whose lease expired.
 * FOR UPDATE SKIP LOCKED keeps concurrent workers on disjoint rows.
 */
export function batchClaimSql(t: string, limit: number, channels: string[]): SqlQuery {
  return {
    sql: `UPDATE ${t} SET "status" = 'SENDING', "attempts" = "attempts" + 1,
  "leaseUntil" = now() + interval '${GA4_LEASE_SECONDS} seconds', "updatedAt" = now()
WHERE "id" IN (
  SELECT "id" FROM ${t}
  WHERE "eventName" = 'purchase' AND "attempts" < $1 AND "gaClientId" IS NOT NULL
    AND "channel" = ANY($3::text[])
    AND ${EVENT_AT} + interval '${GA4_EXPIRE_AFTER_HOURS} hours' > now()
    AND (("status" = 'FAILED' AND ("nextAttemptAt" IS NULL OR "nextAttemptAt" <= now()))
      OR ("status" = 'SENDING' AND ${LEASE_EXPIRED}))
  ORDER BY "nextAttemptAt" ASC NULLS FIRST
  LIMIT $2
  FOR UPDATE SKIP LOCKED
)
RETURNING "id", "transactionId", "channel", "orderId", "gaClientId", "gaSessionId", "attempts", ${EVENT_AT} AS "eventAt"`,
    params: [GA4_MAX_ATTEMPTS, limit, channels],
  };
}

/** Terminal sweep: too old for MP (71h) or out of attempts. Runs before each batch claim. */
export function expireSweepSql(t: string): SqlQuery {
  return {
    sql: `UPDATE ${t} SET "status" = 'EXPIRED', "leaseUntil" = NULL, "nextAttemptAt" = NULL, "updatedAt" = now(),
  "lastError" = CASE WHEN "attempts" >= $1 THEN 'exhausted' ELSE 'expired' END
WHERE "eventName" = 'purchase'
  AND ("status" = 'FAILED' OR ("status" = 'SENDING' AND ${LEASE_EXPIRED}))
  AND ("attempts" >= $1 OR ${EVENT_AT} + interval '${GA4_EXPIRE_AFTER_HOURS} hours' <= now())
RETURNING "transactionId", "channel", "lastError"`,
    params: [GA4_MAX_ATTEMPTS],
  };
}

export type Ga4LedgerUpdate = {
  status: 'SENT' | 'FAILED' | 'INVALID' | 'EXPIRED';
  lastError: string | null;
  delayMs: number | null;
};

/**
 * Outcome of attempt number `attempts` → ledger transition.
 * Retry only transient failures; other 4xx / schema errors are terminal.
 */
export function ledgerUpdateForOutcome(outcome: Ga4SendOutcome, attempts: number): Ga4LedgerUpdate {
  if (outcome.kind === 'transport_accepted') return { status: 'SENT', lastError: null, delayMs: null };
  if (outcome.kind === 'invalid' || outcome.kind === 'rejected') {
    return { status: 'INVALID', lastError: outcome.code, delayMs: null };
  }
  const delayMs = nextAttemptDelayMs(attempts);
  if (delayMs === null) return { status: 'EXPIRED', lastError: `exhausted:${outcome.code}`, delayMs: null };
  return { status: 'FAILED', lastError: outcome.code, delayMs };
}

/** Fenced finish: only the holder of claim `attempts` may move SENDING on. */
export function finishSql(t: string, id: string, attempts: number, u: Ga4LedgerUpdate): SqlQuery {
  return {
    sql: `UPDATE ${t} SET "status" = $3::varchar, "lastError" = $4, "leaseUntil" = NULL,
  "nextAttemptAt" = CASE WHEN $5::int IS NULL THEN NULL ELSE now() + $5::int * interval '1 millisecond' END,
  "sentAt" = CASE WHEN $3::varchar = 'SENT' THEN now() ELSE "sentAt" END,
  "updatedAt" = now()
WHERE "id" = $1 AND "status" = 'SENDING' AND "attempts" = $2
RETURNING "id"`,
    params: [id, attempts, u.status, u.lastError, u.delayMs],
  };
}

/** TypeORM returns `[rows, rowCount]` for raw UPDATE/DELETE and `rows` otherwise. */
export function rowsOf<T>(raw: unknown): T[] {
  if (Array.isArray(raw) && raw.length === 2 && Array.isArray(raw[0]) && typeof raw[1] === 'number') {
    return raw[0] as T[];
  }
  return Array.isArray(raw) ? (raw as T[]) : [];
}
