/**
 * PR-14 inbound service — source + pure helper gates (no Nest DI).
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { extractTelegramFamilyMessageId, resolveInboundMessageId } from '../bots/bot-inbound-idempotency';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const src = readFileSync(resolve(__dirname, 'omnichannel-bot-inbound.service.ts'), 'utf8');

assert(src.includes('BALE_ORDER_WEBHOOK_SECRET'), 'bale webhook secret env name');
assert(src.includes('timingSafeSecretEqual'), 'timing-safe secret');
assert(src.includes("ignored: 'non_private'"), 'reject non-private');
assert(src.includes('maskIranianMobiles'), 'PII mask');
assert(src.includes('isUniqueViolation'), 'unique → duplicate');
assert(src.includes('buildBotProformaDraft'), 'proforma draft');
assert(!src.includes("paymentMethod: 'CREDIT'"), 'no CREDIT');
assert(!src.includes('this.orders'), 'no order service CREDIT');
assert(src.includes('customer_binding_required'), 'verified binding gate');
assert(src.includes('persistSoftBlockNotice'), 'rate-limit notice persisted');
assert(src.includes('handleBaleWebhook'), 'bale webhook');
assert(src.includes('handleTelegramWebhook'), 'telegram stub');
assert(!src.includes('TELEGRAM_API_URL'), 'no telegram egress change');
assert(!src.includes('4858359991'), 'no hard-coded canary remap');
assert(src.includes('owner_chat_missing'), 'audit when owner missing');

const k = resolveInboundMessageId({
  provider: 'BALE',
  customerChatId: 'c1',
  extractedId: extractTelegramFamilyMessageId({ update_id: 1, message: { message_id: 9 } }),
});
assert(!!k && k.providerMessageId === '9', 'message id key');

console.log('omnichannel-bot-inbound.service.spec.ts: ok');
