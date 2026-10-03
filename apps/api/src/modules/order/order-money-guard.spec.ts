/**
 * npx ts-node --transpile-only src/modules/order/order-money-guard.spec.ts
 */
import {
  capturedPaymentBlocksDestructiveAdmin,
  isCapturedPaymentStatus,
} from './order-money-guard';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(isCapturedPaymentStatus('PAID'), 'PAID is captured');
assert(isCapturedPaymentStatus('paid'), 'case-insensitive');
assert(isCapturedPaymentStatus('REFUNDED'), 'refund still financial history');
assert(!isCapturedPaymentStatus('PENDING'), 'pending is not captured');
assert(!isCapturedPaymentStatus('CANCELLED'), 'cancelled start is not captured');
assert(!isCapturedPaymentStatus('FAILED'), 'failed is not captured');

const unpaid = capturedPaymentBlocksDestructiveAdmin({
  paymentStatuses: ['PENDING', 'CANCELLED'],
});
assert(unpaid.allowed === true, 'unpaid may be voided');

const paid = capturedPaymentBlocksDestructiveAdmin({
  paymentStatuses: ['PENDING', 'PAID'],
});
assert(paid.allowed === false, 'any PAID row blocks void/purge');
assert(typeof paid.reason === 'string' && paid.reason.includes('پرداخت'), 'persian reason');

console.log('order-money-guard.spec.ts: ok');
