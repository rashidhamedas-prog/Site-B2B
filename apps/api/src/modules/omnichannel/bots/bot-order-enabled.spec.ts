import {
  readOrderBotEnabled,
  readOrderBotPollCursor,
  withOrderBotEnabled,
  withOrderBotPollCursor,
} from './bot-order-enabled';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(readOrderBotEnabled({}) === false, 'default off');
assert(readOrderBotEnabled({ orderBotEnabled: true }) === true, 'explicit on');
assert(readOrderBotEnabled({ orderBotEnabled: 'true' }) === false, 'string not true');
assert(withOrderBotEnabled({}, true).orderBotEnabled === true, 'set on');
assert(withOrderBotEnabled({ orderBotEnabled: true }, false).orderBotEnabled === false, 'set off');
assert(readOrderBotPollCursor({ orderBotPollCursor: 'abc' }) === 'abc', 'cursor');
assert(withOrderBotPollCursor({}, 'n1').orderBotPollCursor === 'n1', 'write cursor');

console.log('bot-order-enabled.spec.ts: ok');
