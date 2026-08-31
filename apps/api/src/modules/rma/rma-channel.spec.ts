/**
 * npx ts-node --transpile-only src/modules/rma/rma-channel.spec.ts
 */
import { rmaStockChannel } from './rma-channel';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(rmaStockChannel('RETAIL') === 'RETAIL', 'retail');
assert(rmaStockChannel('RETAIL_WEBSITE') === 'RETAIL', 'retail website');
assert(rmaStockChannel('WHOLESALE') === 'WHOLESALE', 'wholesale');
assert(rmaStockChannel(undefined) === 'WHOLESALE', 'default wholesale');

console.log('rma-channel.spec.ts: ok');
