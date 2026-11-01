import { maskIranianMobiles, maskPhoneDisplay, phoneLast4, sanitizeCustomerInfoForStorage } from './bot-pii';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(maskIranianMobiles('تماس 09123456789 بده') === 'تماس 0912***89 بده', 'mask in text');
assert(!maskIranianMobiles('09123456789').includes('345678'), 'no mid digits');
assert(phoneLast4('09123456789') === '6789', 'last4');
assert(maskPhoneDisplay('09123456789') === '0912***89', 'display');
assert(!sanitizeCustomerInfoForStorage('علی 09121112233 تهران').includes('09121112233'), 'sanitized');

console.log('bot-pii.spec.ts: ok');
