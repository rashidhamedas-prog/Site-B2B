import { readFileSync } from 'fs';
import { resolve } from 'path';
import { readOrderBotEnabled } from '../bots/bot-order-enabled';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const src = readFileSync(resolve(__dirname, 'omnichannel-bot-poller.service.ts'), 'utf8');

assert(src.includes('readOrderBotEnabled'), 'respects per-connection flag');
assert(src.includes('isOmnichannelOrderBotRubikaEnabled'), 'rubika env gate');
assert(src.includes('flags_off'), 'no-op when flags off');
assert(src.includes('fetchOrderBotUpdates'), 'ack polling');
assert(
  src.includes('withOrderBotPollCursor') || src.includes('readOrderBotPollCursor'),
  'cursor persist',
);
assert(!src.includes('setWebhook') || src.includes('Bale'), 'no rubika webhook invention');
assert(!src.includes('TELEGRAM_API_URL'), 'no telegram egress');

assert(readOrderBotEnabled({ orderBotEnabled: false }) === false, 'disabled no-op precondition');
assert(readOrderBotEnabled({}) === false, 'default disabled');

console.log('omnichannel-bot-poller.service.spec.ts: ok');
