/**
 * npx ts-node --transpile-only src/database/migrations/20261021-003-analytics-event-log-retry-lease.spec.ts
 */
import * as assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import { AnalyticsEventLogRetryLease1761004800003 } from './20261021-003-analytics-event-log-retry-lease';

const src = readFileSync(join(__dirname, '20261021-003-analytics-event-log-retry-lease.ts'), 'utf8');
const entity = readFileSync(
  join(__dirname, '../../modules/payment/entities/analytics-event-log.entity.ts'),
  'utf8',
);

async function main() {
  for (const col of ['eventAt', 'nextAttemptAt', 'leaseUntil']) {
    assert.ok(
      new RegExp(`ADD COLUMN IF NOT EXISTS "${col}" timestamptz NULL`).test(src),
      `${col}: idempotent nullable timestamptz add`,
    );
    assert.ok(new RegExp(`DROP COLUMN IF EXISTS "${col}"`).test(src), `${col}: reversible down`);
    assert.ok(entity.includes(`${col}: Date | null`), `${col}: entity mirrors column`);
  }
  assert.ok(!/NOT NULL/.test(src), 'all new columns nullable');
  assert.ok(
    /CREATE INDEX IF NOT EXISTS "IDX_analytics_event_log_status_next" ON "analytics_event_log" \("status", "nextAttemptAt"\)/.test(
      src,
    ),
    'due-row index, idempotent',
  );
  assert.ok(/DROP INDEX IF EXISTS "IDX_analytics_event_log_status_next"/.test(src), 'index dropped on down');
  assert.ok(entity.includes('IDX_analytics_event_log_status_next'), 'entity index name matches');
  assert.ok(entity.includes('UQ_analytics_event_log_event_txn'), 'unique constraint kept');
  assert.ok(!/phone|email|address|nationalId|mobile/i.test(src), 'no PII columns');
  assert.ok(!/DROP TABLE|"orders"|UQ_analytics_event_log_event_txn/.test(src), 'never drops tables or the unique');

  const executed: string[] = [];
  const qr = { query: async (sql: string) => void executed.push(sql) } as never;
  const m = new AnalyticsEventLogRetryLease1761004800003();
  await m.up(qr);
  const upCount = executed.length;
  await m.up(qr);
  assert.equal(executed.length, upCount * 2, 'up re-runnable');
  assert.ok(executed.slice(0, upCount).every((s) => /IF NOT EXISTS|WHERE "eventAt" IS NULL/.test(s)), 'up idempotent');
  executed.length = 0;
  await m.down(qr);
  assert.ok(executed.every((s) => /IF EXISTS/.test(s)), 'down idempotent');
  assert.equal(executed.length, 4);
  console.log('20261021-003-analytics-event-log-retry-lease.spec ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
