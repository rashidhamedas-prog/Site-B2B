/**
 * npx ts-node --transpile-only src/modules/product/channel-stock-deduct.spec.ts
 */
import { applyChannelDeduct, simulateSerialDeducts } from './channel-stock-deduct';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(applyChannelDeduct(5, 2) === 3, 'deduct');
let oversell = false;
try {
  applyChannelDeduct(1, 2);
} catch (err) {
  oversell = err instanceof Error && err.message === 'OVERSELL';
}
assert(oversell, 'insufficient stock is oversell');

{
  const raced = simulateSerialDeducts(1, [1, 1]);
  assert(raced.remaining === 0, 'winner takes last unit');
  assert(raced.rejected === 1, 'loser is refused — no oversell');
}

console.log('channel-stock-deduct.spec.ts: ok');
