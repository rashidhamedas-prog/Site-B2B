/**
 * Local: node …/ts-node/dist/bin.js --transpile-only src/database/migrations/20261029-002-omnichannel-unanswered-alerts.spec.ts
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const src = readFileSync(
  resolve(__dirname, '20261029-002-omnichannel-unanswered-alerts.ts'),
  'utf8',
);

assert(src.includes('omnichannel_bot_conversations'), 'conversations table');
assert(src.includes('omnichannel_bot_messages'), 'messages table');
assert(src.includes('omnichannel_alerts'), 'alerts table');
assert(src.includes('CREATE TABLE IF NOT EXISTS'), 'additive create');
assert(src.includes('DROP TABLE IF EXISTS'), 'down drops');
assert(src.includes('UQ_omnichannel_alerts_open_conversation'), 'idempotent open alert index');
assert(src.includes("status\" IN ('open', 'acked')"), 'partial unique open+acked');
assert(!src.includes('DROP TABLE "omnichannel_publication'), 'does not touch publications');
assert(!src.includes('OMNICHANNEL_CONNECTORS_ENABLED'), 'no connector enable');
assert(!src.includes('TELEGRAM_API_URL'), 'no telegram egress');

console.log('20261029-002-omnichannel-unanswered-alerts.spec.ts: ok');
