/**
 * npx ts-node --transpile-only src/modules/payment/ga4-purchase.ownership.spec.ts
 */
import * as assert from 'assert';
import {
  GA4_EXPIRE_AFTER_HOURS,
  GA4_MAX_ATTEMPTS,
  GA4_RETRY_SCHEDULE_MS,
  isRetryableStatus,
  nextAttemptDelayMs,
} from './ga4-mp';
import {
  GA4_LEDGER_STATUSES,
  batchClaimSql,
  expireSweepSql,
  finishSql,
  ga4LedgerTable,
  inlineClaimSql,
  ledgerUpdateForOutcome,
  ownershipForStatus,
  rowsOf,
} from './ga4-purchase.sql';

// Ownership matrix: server owns everything it ever claimed.
const expected: Record<string, boolean> = {
  PENDING: false,
  SENDING: true,
  SENT: true,
  FAILED: true,
  CLIENT_FALLBACK: false,
  SKIPPED: false,
  INVALID: true,
  EXPIRED: true,
};
assert.deepStrictEqual([...GA4_LEDGER_STATUSES].sort(), Object.keys(expected).sort(), 'all 8 statuses covered');
for (const s of GA4_LEDGER_STATUSES) {
  assert.ok(s.length <= 16, `${s} fits varchar(16)`);
  assert.deepStrictEqual(ownershipForStatus(s), { serverOwned: expected[s], status: s }, s);
}
assert.deepStrictEqual(ownershipForStatus('WHATEVER'), { serverOwned: false, status: 'SKIPPED' });

// Backoff: 1 inline + 8 retries, all inside the 71h expiry (< 72h MP window).
const HOUR = 3_600_000;
assert.strictEqual(GA4_MAX_ATTEMPTS, 9);
const total = GA4_RETRY_SCHEDULE_MS.reduce((a, b) => a + b, 0);
assert.strictEqual(total, (46 * 60 + 21) * 60_000, 'cumulative 46h21m');
assert.ok(total < GA4_EXPIRE_AFTER_HOURS * HOUR && GA4_EXPIRE_AFTER_HOURS < 72);
assert.deepStrictEqual(
  [1, 2, 3, 4, 5, 6, 7, 8].map(nextAttemptDelayMs),
  [60_000, 300_000, 900_000, HOUR, 3 * HOUR, 6 * HOUR, 12 * HOUR, 24 * HOUR],
);
assert.strictEqual(nextAttemptDelayMs(9), null, 'exhausted after attempt 9');
assert.strictEqual(nextAttemptDelayMs(0), null);
assert.strictEqual(nextAttemptDelayMs(1.5), null);

for (const c of [429, 500, 502, 503, 504, 599]) assert.strictEqual(isRetryableStatus(c), true, String(c));
for (const c of [200, 204, 301, 400, 401, 403, 404, 413, 422, 600]) assert.strictEqual(isRetryableStatus(c), false, String(c));

// Outcome → ledger transition.
assert.deepStrictEqual(ledgerUpdateForOutcome({ kind: 'transport_accepted' }, 1), {
  status: 'SENT',
  lastError: null,
  delayMs: null,
});
assert.deepStrictEqual(ledgerUpdateForOutcome({ kind: 'retryable', code: 'timeout' }, 1), {
  status: 'FAILED',
  lastError: 'timeout',
  delayMs: 60_000,
});
assert.deepStrictEqual(ledgerUpdateForOutcome({ kind: 'retryable', code: 'http_503' }, 9), {
  status: 'EXPIRED',
  lastError: 'exhausted:http_503',
  delayMs: null,
});
assert.deepStrictEqual(ledgerUpdateForOutcome({ kind: 'rejected', code: 'http_400' }, 2), {
  status: 'INVALID',
  lastError: 'http_400',
  delayMs: null,
});

// SQL shape: atomic claims, fenced finish, schema-safe table name.
const t = ga4LedgerTable();
const batch = batchClaimSql(t, 20, ['RETAIL']);
assert.ok(/FOR UPDATE SKIP LOCKED/.test(batch.sql) && /RETURNING/.test(batch.sql));
assert.ok(/"leaseUntil" = now\(\) \+ interval/.test(batch.sql));
assert.ok(!/\$\{|undefined/.test(batch.sql));
assert.deepStrictEqual(batch.params, [GA4_MAX_ATTEMPTS, 20, ['RETAIL']]);
assert.ok(/WHERE "id" = \$1 AND "status" = 'PENDING'/.test(inlineClaimSql(t, 'x', '1.1', null).sql));
assert.ok(/"status" = 'SENDING' AND "attempts" = \$2/.test(finishSql(t, 'x', 1, { status: 'SENT', lastError: null, delayMs: null }).sql));
assert.ok(/'EXPIRED'/.test(expireSweepSql(t).sql));
assert.strictEqual(ga4LedgerTable('ga4_conc_test_ab12'), '"ga4_conc_test_ab12"."analytics_event_log"');
assert.throws(() => ga4LedgerTable('x"; DROP TABLE orders; --'));

assert.deepStrictEqual(rowsOf([[{ id: 'a' }], 1]), [{ id: 'a' }], 'TypeORM UPDATE shape');
assert.deepStrictEqual(rowsOf([{ id: 'a' }, { id: 'b' }]), [{ id: 'a' }, { id: 'b' }], 'SELECT shape');
assert.deepStrictEqual(rowsOf(undefined), []);

console.log('ga4-purchase.ownership.spec ok');
