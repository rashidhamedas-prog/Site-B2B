/**
 * npx ts-node --transpile-only src/modules/order/order-stock-settlement.spec.ts
 */
import {
  isOrderStockCommitted,
  shouldCommitStockOnConfirm,
  shouldReverseCommittedStock,
} from './order-stock-settlement';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(shouldCommitStockOnConfirm('PENDING_REVIEW', 'CONFIRMED'), 'confirm commits');
assert(shouldCommitStockOnConfirm('PENDING_REVIEW', 'PROCESSING'), 'skip to packing still settles');
assert(!shouldCommitStockOnConfirm('CONFIRMED', 'CONFIRMED'), 'confirm is idempotent');
assert(!shouldCommitStockOnConfirm('CONFIRMED', 'SHIPPED'), 'already settled');
assert(!shouldCommitStockOnConfirm('PENDING_REVIEW', 'CANCELLED'), 'cancel does not commit');

assert(!isOrderStockCommitted({}), 'new order is uncommitted');
assert(!isOrderStockCommitted({ stockCommittedAt: null }), 'null is uncommitted');
assert(isOrderStockCommitted({ stockCommittedAt: new Date() }), 'timestamp is committed');
assert(
  !isOrderStockCommitted({ stockCommittedAt: new Date(), effectsReversedAt: new Date() }),
  'reversed is not still committed',
);

assert(!shouldReverseCommittedStock({}), 'uncommitted cancel must not restore stock');
assert(shouldReverseCommittedStock({ stockCommittedAt: new Date() }), 'committed cancel restores');
assert(
  !shouldReverseCommittedStock({ stockCommittedAt: new Date(), effectsReversedAt: new Date() }),
  'already reversed skip',
);

console.log('order-stock-settlement.spec.ts: ok');
