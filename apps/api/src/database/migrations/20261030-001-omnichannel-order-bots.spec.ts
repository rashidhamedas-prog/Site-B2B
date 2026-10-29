/**
 * Local: node …/ts-node/dist/bin.js --transpile-only src/database/migrations/20261030-001-omnichannel-order-bots.spec.ts
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const src = readFileSync(
  resolve(__dirname, '20261030-001-omnichannel-order-bots.ts'),
  'utf8',
);

assert(src.includes('ALTER TABLE "omnichannel_bot_conversations"'), 'ALTER conversations');
assert(src.includes('ALTER TABLE "omnichannel_bot_messages"'), 'ALTER messages');
assert(src.includes('ADD COLUMN IF NOT EXISTS "state"'), 'FSM state column');
assert(src.includes('ADD COLUMN IF NOT EXISTS "tags"'), 'tags column');
assert(src.includes('ADD COLUMN IF NOT EXISTS "orderId"'), 'order link');
assert(src.includes('ADD COLUMN IF NOT EXISTS "invoiceId"'), 'invoice link');
assert(src.includes('UQ_omnichannel_bot_messages_provider_msgid'), 'idempotency unique');
assert(src.includes('UQ_omnichannel_bot_conversations_open_dest_customer'), 'open partial unique');
assert(!src.includes('CREATE TABLE'), 'no recreate tables');
assert(!src.includes('DROP TABLE'), 'down does not drop PR-13 tables');
assert(!src.includes('OMNICHANNEL_CONNECTORS_ENABLED'), 'no connector enable');
assert(!src.includes('TELEGRAM_API_URL'), 'no telegram egress');
assert(!src.includes('4858359991'), 'no canary remap');

console.log('20261030-001-omnichannel-order-bots.spec.ts: ok');
