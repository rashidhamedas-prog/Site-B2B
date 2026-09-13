/**
 * npx ts-node --transpile-only src/order-status.spec.ts
 */
import {
  ADMIN_ORDER_QUEUES,
  CUSTOMER_STATUS_FLOW,
  adminQueueActions,
  canTransitionOrderStatus,
  canonicalCustomerStatus,
  customerStatusStepIndex,
  foldStatusCounts,
  isKnownOrderStatus,
  orderStatusLabelFa,
} from './order-status';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(ADMIN_ORDER_QUEUES.join(',') === 'AWAITING_PAYMENT,PENDING_REVIEW,CONFIRMED,PROCESSING,SHIPPED,DELIVERED,COMPLETED,CANCELLED,DELETED', 'admin funnel order');
assert(CUSTOMER_STATUS_FLOW.join(',') === 'PENDING_REVIEW,CONFIRMED,PROCESSING,SHIPPED,DELIVERED,COMPLETED', 'customer stepper');
assert(canTransitionOrderStatus('PENDING_REVIEW', 'CONFIRMED'), 'review → confirm');
assert(canTransitionOrderStatus('PENDING_REVIEW', 'PROCESSING'), 'review may skip to packing');
assert(!canTransitionOrderStatus('PROCESSING', 'CONFIRMED'), 'packing cannot go backwards');
assert(canTransitionOrderStatus('PROCESSING', 'SHIPPED'), 'packing → shipped');
assert(canTransitionOrderStatus('DELIVERED', 'COMPLETED'), 'delivered → completed');
assert(!canTransitionOrderStatus('DELIVERED', 'CONFIRMED'), 'delivered cannot reopen');
assert(!canTransitionOrderStatus('AWAITING_PAYMENT', 'PENDING_REVIEW'), 'capture owns unpaid → review');
assert(!canTransitionOrderStatus('UNKNOWN', 'CONFIRMED'), 'unknown from is denied');
assert(canTransitionOrderStatus('CONFIRMED', 'CONFIRMED'), 'idempotent same status');
assert(canonicalCustomerStatus('PACKING') === 'PROCESSING', 'packing alias');
assert(canonicalCustomerStatus('packed') === 'PROCESSING', 'packed alias');
assert(customerStatusStepIndex('PROCESSING') === 2, 'processing step');
assert(customerStatusStepIndex('AWAITING_PAYMENT') === -1, 'unpaid not on stepper');
assert(orderStatusLabelFa('CONFIRMED') === 'تأیید شده', 'label');
assert(isKnownOrderStatus('COMPLETED'), 'completed known');
assert(!isKnownOrderStatus('nope'), 'unknown rejected');
assert(adminQueueActions('PENDING_REVIEW').map((a) => a.to).join(',') === 'CONFIRMED,CANCELLED', 'list review actions');
assert(adminQueueActions('PROCESSING').length === 0, 'ship is tracking');
assert(adminQueueActions('DELIVERED').some((a) => a.to === 'COMPLETED'), 'complete from delivered');

const folded = foldStatusCounts([
  { status: 'CONFIRMED', count: '2' },
  { status: 'DELETED', count: 1 },
]);
assert(folded.ALL === 3, 'all');
assert(folded.CONFIRMED === 2, 'confirmed');
assert(folded.DELETED === 1, 'deleted');
assert(folded.PENDING_REVIEW === 0, 'empty queue');

console.log('order-status spec ok');
