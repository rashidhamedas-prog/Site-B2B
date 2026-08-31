/**
 * npx ts-node --transpile-only src/modules/inventory/inventory-movement.policy.spec.ts
 */
import {
  canReverseFromInventoryUi,
  isReversableMovement,
  signedDeltaForMovement,
  withAdjustDeltaNote,
} from './inventory-movement.policy';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(signedDeltaForMovement('SALE', 4) === -4, 'sale is negative');
assert(signedDeltaForMovement('RETURN', 4) === 4, 'return is positive');
assert(signedDeltaForMovement('IN', 2) === 2, 'in is positive');
assert(signedDeltaForMovement('OUT', 2) === -2, 'out is negative');
assert(signedDeltaForMovement('ADJUST', 9, 'تصحیح\nDELTA=-3') === -3, 'adjust uses DELTA');
assert(withAdjustDeltaNote('تنظیم', 5).includes('DELTA=5'), 'note records delta');
assert(isReversableMovement('SALE') === true, 'sale reversible');
assert(isReversableMovement('REVERSAL') === false, 'reversal not reversible');
assert(canReverseFromInventoryUi({ type: 'SALE' }) === true, 'plain sale can reverse');
assert(canReverseFromInventoryUi({ type: 'SALE', referenceType: 'ORDER' }) === false, 'order sale only via cancel');
assert(canReverseFromInventoryUi({ type: 'RETURN', referenceType: 'RMA' }) === false, 'rma return only via rma');
assert(canReverseFromInventoryUi({ type: 'REVERSAL' }) === false, 'reversal not from ui');

let threw = false;
try {
  signedDeltaForMovement('ADJUST', 9, 'no marker');
} catch {
  threw = true;
}
assert(threw, 'unsigned adjust cannot reverse');

console.log('inventory-movement.policy.spec.ts: ok');
