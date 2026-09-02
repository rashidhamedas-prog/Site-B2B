/**
 * npx ts-node --transpile-only src/modules/discount/discount-channel.spec.ts
 */
import { discountAppliesToChannel, requireDiscountChannel } from './discount-channel';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(requireDiscountChannel('RETAIL') === 'RETAIL', 'retail allowed');
assert(requireDiscountChannel('wholesale') === 'WHOLESALE', 'wholesale allowed');

for (const banned of [undefined, '', 'ALL', 'BOTH', 'FOO']) {
  let threw = false;
  try {
    requireDiscountChannel(banned);
  } catch (err) {
    threw = err instanceof Error && err.message === 'PUBLIC_CHANNEL_REQUIRED';
  }
  assert(threw, `${banned ?? 'undefined'} must be rejected for discount channel`);
}

assert(discountAppliesToChannel('BOTH', 'RETAIL') === true, 'BOTH applies to retail');
assert(discountAppliesToChannel('BOTH', 'WHOLESALE') === true, 'BOTH applies to wholesale');
assert(discountAppliesToChannel('RETAIL', 'RETAIL') === true, 'retail code on retail');
assert(discountAppliesToChannel('RETAIL', 'WHOLESALE') === false, 'retail code blocked on wholesale');
assert(discountAppliesToChannel('WHOLESALE', 'RETAIL') === false, 'wholesale code blocked on retail');

console.log('discount-channel.spec.ts: ok');
