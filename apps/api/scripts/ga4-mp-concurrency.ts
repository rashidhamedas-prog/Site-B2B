/**
 * Race tests for the GA4 purchase ledger against a real Postgres, using the exact
 * SQL builders the service runs. Isolated schema, dropped at the end.
 *
 *   GA4_CONCURRENCY_PG_URL=postgres://user:pass@localhost:5432/db \
 *     npx ts-node --transpile-only scripts/ga4-mp-concurrency.ts
 *
 * Point it at a local/disposable database only. Exit 1 on any failure.
 */
import * as assert from 'assert';
import { randomBytes } from 'crypto';
import { Pool } from 'pg';
import { AnalyticsEventLog1761004800001 } from '../src/database/migrations/20261021-001-analytics-event-log';
import { AnalyticsEventLogGaIds1761004800002 } from '../src/database/migrations/20261021-002-analytics-event-log-ga-ids';
import { AnalyticsEventLogRetryLease1761004800003 } from '../src/database/migrations/20261021-003-analytics-event-log-retry-lease';
import {
  batchClaimSql,
  expireSweepSql,
  finishSql,
  ga4LedgerTable,
  inlineClaimSql,
  insertPendingSql,
  type SqlQuery,
} from '../src/modules/payment/ga4-purchase.sql';

const url = process.env.GA4_CONCURRENCY_PG_URL;
const schema = `ga4_conc_test_${randomBytes(4).toString('hex')}`;
const t = ga4LedgerTable(schema);

type Client = { query: (sql: string, params?: unknown[]) => Promise<{ rows: any[] }>; release: () => void };

async function main(): Promise<void> {
  if (!url) {
    console.log('ga4-mp-concurrency SKIPPED (set GA4_CONCURRENCY_PG_URL to a disposable database)');
    return;
  }
  const pool = new Pool({ connectionString: url, max: 12, options: `-c search_path=${schema}` });
  const q = async (c: { query: Client['query'] }, s: SqlQuery) => (await c.query(s.sql, s.params)).rows;
  try {
    await pool.query(`CREATE SCHEMA "${schema}"`);
    const ddl: Client = await pool.connect();
    try {
      await ddl.query(`SET search_path TO "${schema}"`);
      const qr = { query: (sql: string) => ddl.query(sql) } as never;
      await new AnalyticsEventLog1761004800001().up(qr);
      await new AnalyticsEventLogGaIds1761004800002().up(qr);
      await new AnalyticsEventLogRetryLease1761004800003().up(qr);
      await new AnalyticsEventLogRetryLease1761004800003().up(qr);
    } finally {
      ddl.release();
    }

    const insert = (txn: string) =>
      q(pool, insertPendingSql(t, {
        transactionId: txn,
        channel: 'RETAIL',
        measurementId: 'G-TEST',
        orderId: null,
        paymentId: null,
        valueIrr: 1000,
      }));

    // (1) concurrent verify claims on one transaction: exactly one wins.
    const [{ id: verifyId }] = await insert('ORD-VERIFY-1');
    const clients: Client[] = await Promise.all(Array.from({ length: 6 }, () => pool.connect()));
    try {
      const results = await Promise.all(
        clients.map((c, i) => q(c, inlineClaimSql(t, verifyId, `12345678.${100000 + i}`, null))),
      );
      const winners = results.filter((r) => r.length === 1);
      assert.strictEqual(winners.length, 1, 'exactly one verify claim wins');
      assert.strictEqual(Number(winners[0][0].attempts), 1);
    } finally {
      clients.forEach((c) => c.release());
    }
    console.log('(1) concurrent verify claim: exactly one winner ok');

    // (2) two workers batch-claim N due FAILED rows: each claimed exactly once.
    const N = 40;
    for (let i = 0; i < N; i++) {
      await pool.query(
        `INSERT INTO ${t} ("eventName", "transactionId", "channel", "status", "attempts", "gaClientId", "eventAt", "nextAttemptAt")
         VALUES ('purchase', $1, 'RETAIL', 'FAILED', 1, '12345678.12345678', now(), now() - interval '1 minute')`,
        [`ORD-BATCH-${i}`],
      );
    }
    const worker = async (): Promise<string[]> => {
      const c: Client = await pool.connect();
      const got: string[] = [];
      try {
        for (;;) {
          await c.query('BEGIN');
          const rows = await q(c, batchClaimSql(t, 7, ['RETAIL']));
          await c.query('SELECT pg_sleep(0.05)');
          await c.query('COMMIT');
          if (!rows.length) return got;
          got.push(...rows.map((r) => String(r.transactionId)));
        }
      } finally {
        c.release();
      }
    };
    const [a, b] = await Promise.all([worker(), worker()]);
    const all = [...a, ...b].filter((x) => x.startsWith('ORD-BATCH-'));
    assert.strictEqual(new Set(all).size, all.length, 'no row claimed twice');
    assert.strictEqual(all.length, N, 'every due row claimed once');
    const leased = await pool.query(
      `SELECT count(*)::int AS n FROM ${t} WHERE "transactionId" LIKE 'ORD-BATCH-%' AND "status" = 'SENDING' AND "attempts" = 2 AND "leaseUntil" > now()`,
    );
    assert.strictEqual(leased.rows[0].n, N, 'claimed rows are SENDING, attempts+1, leased');
    console.log(`(2) two workers: ${a.length}+${b.length} claims, no duplicates ok`);

    // (3) stuck SENDING with expired lease reclaimed once; valid lease untouched.
    await pool.query(
      `INSERT INTO ${t} ("eventName", "transactionId", "channel", "status", "attempts", "gaClientId", "eventAt", "leaseUntil")
       VALUES ('purchase', 'ORD-STUCK', 'RETAIL', 'SENDING', 1, '12345678.12345678', now(), now() - interval '1 minute'),
              ('purchase', 'ORD-LIVE', 'RETAIL', 'SENDING', 1, '12345678.12345678', now(), now() + interval '5 minutes')`,
    );
    const [r1, r2] = await Promise.all([q(pool, batchClaimSql(t, 10, ['RETAIL'])), q(pool, batchClaimSql(t, 10, ['RETAIL']))]);
    const reclaimed = [...r1, ...r2].map((r) => String(r.transactionId));
    assert.deepStrictEqual(reclaimed.filter((x) => x === 'ORD-STUCK'), ['ORD-STUCK'], 'expired lease reclaimed exactly once');
    assert.ok(!reclaimed.includes('ORD-LIVE'), 'valid lease not reclaimed');
    console.log('(3) lease expiry reclaim ok');

    // Fencing: a stale holder (old attempts value) cannot finish the row.
    const stuck = (await pool.query(`SELECT "id", "attempts" FROM ${t} WHERE "transactionId" = 'ORD-STUCK'`)).rows[0];
    const sent = { status: 'SENT' as const, lastError: null, delayMs: null };
    assert.strictEqual((await q(pool, finishSql(t, stuck.id, Number(stuck.attempts) - 1, sent))).length, 0, 'stale fence rejected');
    assert.strictEqual((await q(pool, finishSql(t, stuck.id, Number(stuck.attempts), sent))).length, 1, 'current fence finishes');
    const failed = { status: 'FAILED' as const, lastError: 'timeout', delayMs: 60_000 };
    const live = (await pool.query(`SELECT "id" FROM ${t} WHERE "transactionId" = 'ORD-LIVE'`)).rows[0];
    await q(pool, finishSql(t, live.id, 1, failed));
    const due = (await pool.query(
      `SELECT "status", "nextAttemptAt" > now() + interval '50 seconds' AS later, "leaseUntil" IS NULL AS unleased FROM ${t} WHERE "id" = $1`,
      [live.id],
    )).rows[0];
    assert.deepStrictEqual(due, { status: 'FAILED', later: true, unleased: true }, 'FAILED scheduled by backoff');
    console.log('fenced finish + backoff scheduling ok');

    // Expiry sweep: >71h-old FAILED row becomes EXPIRED and is never claimed.
    await pool.query(
      `INSERT INTO ${t} ("eventName", "transactionId", "channel", "status", "attempts", "gaClientId", "eventAt", "nextAttemptAt")
       VALUES ('purchase', 'ORD-OLD', 'RETAIL', 'FAILED', 2, '12345678.12345678', now() - interval '71 hours 1 minute', now() - interval '1 minute')`,
    );
    const swept = await q(pool, expireSweepSql(t));
    assert.deepStrictEqual(swept.map((r) => [r.transactionId, r.lastError]), [['ORD-OLD', 'expired']]);
    console.log('expiry sweep ok');

    // (4) duplicate (eventName, transactionId) insert is ignored.
    const again = await insert('ORD-VERIFY-1');
    assert.strictEqual(again.length, 0, 'duplicate insert ignored');
    const cnt = await pool.query(`SELECT count(*)::int AS n FROM ${t} WHERE "transactionId" = 'ORD-VERIFY-1'`);
    assert.strictEqual(cnt.rows[0].n, 1);
    console.log('(4) unique (eventName, transactionId) ok');
  } finally {
    await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`).catch(() => undefined);
    await pool.end();
  }
  console.log('ga4-mp-concurrency ok');
}

main().catch((err: unknown) => {
  console.error(err instanceof assert.AssertionError ? err.message : 'ga4-mp-concurrency failed');
  if (!(err instanceof assert.AssertionError)) console.error(err);
  process.exit(1);
});
