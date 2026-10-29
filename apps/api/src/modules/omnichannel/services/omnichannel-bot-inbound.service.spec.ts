/**
 * PR-14 inbound service — source + pure helper gates (no Nest DI).
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { extractTelegramFamilyMessageId, inboundIdempotencyKey } from '../bots/bot-inbound-idempotency';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const src = readFileSync(resolve(__dirname, 'omnichannel-bot-inbound.service.ts'), 'utf8');

assert(src.includes('BALE_ORDER_WEBHOOK_SECRET'), 'bale webhook secret env name');
assert(src.includes('handleBaleWebhook'), 'bale webhook');
assert(src.includes('handleTelegramWebhook'), 'telegram stub');
assert(src.includes('isOmnichannelOrderBotBaleEnabled'), 'bale flag gate');
assert(src.includes('isOmnichannelOrderBotTelegramEnabled'), 'telegram flag gate');
assert(!src.includes('TELEGRAM_API_URL'), 'no telegram egress change');
assert(!src.includes('OMNICHANNEL_CONNECTORS_ENABLED ='), 'does not flip connectors');
assert(!src.includes('4858359991'), 'no hard-coded canary remap');
assert(src.includes('owner_chat_missing'), 'audit when owner missing');
assert(src.includes('lastCustomerMessageAt'), 'feeds unanswered scanner');
assert(src.includes('lastStaffReplyAt'), 'auto-reply updates staff stamp');
assert(src.includes('assertOrderBotEnableAllowed'), 'enable RBAC helper');
assert(src.includes("toUpperCase() !== 'OWNER'"), 'owner-only enable');
assert(src.includes('goRef'), 'goRef gate');

const k = inboundIdempotencyKey(
  'BALE',
  extractTelegramFamilyMessageId({ update_id: 1, message: { message_id: 9 } }),
);
assert(!!k && k.providerMessageId === '9', 'message id key');

console.log('omnichannel-bot-inbound.service.spec.ts: ok');
