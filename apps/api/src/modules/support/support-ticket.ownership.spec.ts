/**
 * Ownership / channel helpers for support tickets (no DB).
 * npx ts-node --transpile-only src/modules/support/support-ticket.ownership.spec.ts
 */
import { shopperCanReadOrderType, shopperOrderScope } from '../auth/shopper-channel';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const retail = shopperOrderScope('retail');
assert(!!retail && retail.channel === 'RETAIL', 'retail scope');
const wholesale = shopperOrderScope('wholesale');
assert(!!wholesale && wholesale.channel === 'WHOLESALE', 'wholesale scope');
assert(shopperOrderScope('admin') === null, 'admin no shopper scope');

assert(shopperCanReadOrderType('retail', 'RETAIL_WEBSITE') === true, 'retail reads retail order');
assert(shopperCanReadOrderType('retail', 'WHOLESALE') === false, 'retail blocked wholesale order');
assert(shopperCanReadOrderType('wholesale', 'WHOLESALE') === true, 'wholesale reads wholesale');
assert(shopperCanReadOrderType('wholesale', 'RETAIL') === false, 'wholesale blocked retail');

console.log('support-ticket.ownership.spec.ts: ok');
