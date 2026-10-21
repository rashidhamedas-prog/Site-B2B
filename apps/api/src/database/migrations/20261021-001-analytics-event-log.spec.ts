import { readFileSync } from 'fs';
import { join } from 'path';
import { AnalyticsEventLog1761004800001 } from './20261021-001-analytics-event-log';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const src = readFileSync(join(__dirname, '20261021-001-analytics-event-log.ts'), 'utf8');
const entity = readFileSync(
  join(__dirname, '../../modules/payment/entities/analytics-event-log.entity.ts'),
  'utf8',
);

assert(/CREATE TABLE IF NOT EXISTS "analytics_event_log"/.test(src), 'idempotent create');
assert(/UQ_analytics_event_log_event_txn/.test(src), 'unique constraint name');
assert(/UNIQUE \("eventName", "transactionId"\)/.test(src), 'unique on (eventName, transactionId)');
assert(/DROP TABLE IF EXISTS "analytics_event_log"/.test(src), 'reversible down');
assert(!/DROP TABLE[^;]*"orders"/.test(src), 'never touches orders');
assert(/UQ_analytics_event_log_event_txn/.test(entity), 'entity mirrors unique');
assert(!/phone|email|address|nationalId/i.test(src), 'no PII columns');
assert(!!new AnalyticsEventLog1761004800001(), 'class');

const ids = readFileSync(join(__dirname, '20261021-002-analytics-event-log-ga-ids.ts'), 'utf8');
assert(/ADD COLUMN IF NOT EXISTS "gaClientId"/.test(ids), 'ga ids: idempotent add');
assert(/DROP COLUMN IF EXISTS "gaClientId"/.test(ids), 'ga ids: reversible down');
assert(!/NOT NULL/.test(ids), 'ga ids: nullable (safe on existing rows)');
assert(!/phone|email|address|nationalId/i.test(ids), 'ga ids: no PII columns');
assert(/IDX_analytics_event_log_status/.test(entity), 'entity index names match migration');
console.log('20261021-001-analytics-event-log.spec ok');
