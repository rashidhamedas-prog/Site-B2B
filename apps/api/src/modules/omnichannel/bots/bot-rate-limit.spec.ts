import {
  checkBotRateLimit,
  resetBotRateLimitForTests,
} from './bot-rate-limit';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

resetBotRateLimitForTests();
const base = { provider: 'BALE', customerChatId: 'c1', perMinute: 3, burst: 3, nowMs: 1_000 };
assert(checkBotRateLimit(base).allowed === true, '1 ok');
assert(checkBotRateLimit({ ...base, nowMs: 1_100 }).allowed === true, '2 ok');
assert(checkBotRateLimit({ ...base, nowMs: 1_200 }).allowed === true, '3 ok');
const blocked = checkBotRateLimit({ ...base, nowMs: 1_300 });
assert(blocked.allowed === false, '4 blocked');
assert(blocked.allowed === false && /صبر/.test(blocked.notice), 'persian notice');

const later = checkBotRateLimit({ ...base, nowMs: 1_000 + 61_000 });
assert(later.allowed === true, 'window reset');

console.log('bot-rate-limit.spec.ts: ok');
