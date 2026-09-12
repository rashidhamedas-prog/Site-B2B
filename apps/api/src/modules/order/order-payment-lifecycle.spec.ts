/**
 * npx ts-node --transpile-only src/modules/order/order-payment-lifecycle.spec.ts
 */
import {
  AWAITING_PAYMENT,
  CONFIRMED,
  PENDING_REVIEW,
  initialCreateStatus,
  isOrderPayable,
  requiresCapturedPayment,
  shouldNotifyOrderRegisteredOnCreate,
  statusAfterCapturedPayment,
} from './order-payment-lifecycle';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(requiresCapturedPayment('ONLINE', 150000), 'online payable needs capture');
assert(requiresCapturedPayment('online', 1), 'method is case-insensitive');
assert(!requiresCapturedPayment('ONLINE', 0), 'zero-total online is free');
assert(!requiresCapturedPayment('CASH', 150000), 'cash is not gateway-captured');
assert(!requiresCapturedPayment('INSTALLMENT', 150000), 'installment is invoiced');

assert(initialCreateStatus('ONLINE', 150000) === AWAITING_PAYMENT, 'unpaid online awaits payment');
assert(initialCreateStatus('CASH', 150000) === PENDING_REVIEW, 'cash enters review');
assert(initialCreateStatus('INSTALLMENT', 150000) === PENDING_REVIEW, 'installment enters review');
assert(initialCreateStatus('ONLINE', 0) === PENDING_REVIEW, 'wallet-covered online enters review');

assert(!shouldNotifyOrderRegisteredOnCreate(AWAITING_PAYMENT), 'no registered SMS before pay');
assert(shouldNotifyOrderRegisteredOnCreate(PENDING_REVIEW), 'review SMS on create for cash');

const afterOnlinePay = statusAfterCapturedPayment(AWAITING_PAYMENT);
assert(afterOnlinePay.nextStatus === PENDING_REVIEW, 'paid online enters review');
assert(afterOnlinePay.notifyRegistered === true, 'registered SMS after capture');

const afterCashPay = statusAfterCapturedPayment(PENDING_REVIEW);
assert(afterCashPay.nextStatus === CONFIRMED, 'paying a reviewed cash order confirms');
assert(afterCashPay.notifyRegistered === false, 'do not re-send registered SMS');

const already = statusAfterCapturedPayment(CONFIRMED);
assert(already.nextStatus === CONFIRMED, 'already confirmed stays');
assert(already.notifyRegistered === false, 'no SMS on idempotent capture');

assert(isOrderPayable(AWAITING_PAYMENT), 'awaiting is payable');
assert(isOrderPayable(PENDING_REVIEW), 'reviewed cash may still pay invoice/order');
assert(!isOrderPayable(CONFIRMED), 'confirmed is not payable');
assert(!isOrderPayable('PROCESSING'), 'packing is not payable');
assert(!isOrderPayable('CANCELLED'), 'cancelled is not payable');

console.log('order-payment-lifecycle.spec ok');
