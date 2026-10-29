import {
  extractRubikaMessageId,
  extractTelegramFamilyMessageId,
  inboundIdempotencyKey,
  isDuplicateInbound,
} from './bot-inbound-idempotency';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const k1 = inboundIdempotencyKey('bale', '42');
assert(!!k1 && k1.provider === 'BALE' && k1.providerMessageId === '42', 'normalize key');
assert(inboundIdempotencyKey('BALE', '') === null, 'empty id null');
assert(inboundIdempotencyKey('', '1') === null, 'empty provider null');

assert(
  extractTelegramFamilyMessageId({ update_id: 9, message: { message_id: 77 } }) === '77',
  'bale/tg message_id',
);
assert(
  extractTelegramFamilyMessageId({ update_id: 9 }) === 'upd:9',
  'fallback update_id',
);
assert(
  extractRubikaMessageId({ new_message: { message_id: 'rm-1' } }) === 'rm-1',
  'rubika message id',
);

assert(
  isDuplicateInbound({ provider: 'BALE', providerMessageId: '42' }, k1!),
  'duplicate detected',
);
assert(
  !isDuplicateInbound({ provider: 'BALE', providerMessageId: '43' }, k1!),
  'different id not dup',
);

console.log('bot-inbound-idempotency.spec.ts: ok');
