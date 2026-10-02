/**
 * npx ts-node --transpile-only src/modules/support/support-ticket.fsm.spec.ts
 */
import {
  canTransitionSupportStatus,
  normalizeCategory,
  normalizePriority,
  statusAfterCustomerReply,
  statusAfterStaffReply,
} from './support-ticket.fsm';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(canTransitionSupportStatus('OPEN', 'IN_PROGRESS') === true, 'open→in_progress');
assert(canTransitionSupportStatus('OPEN', 'CLOSED') === true, 'open→closed');
assert(canTransitionSupportStatus('CLOSED', 'OPEN') === true, 'closed→open');
assert(canTransitionSupportStatus('CLOSED', 'IN_PROGRESS') === false, 'closed↛in_progress');
assert(canTransitionSupportStatus('RESOLVED', 'WAITING_CUSTOMER') === false, 'resolved↛waiting');
assert(canTransitionSupportStatus('OPEN', 'OPEN') === true, 'idempotent');

assert(statusAfterCustomerReply('WAITING_CUSTOMER') === 'OPEN', 'customer reopen waiting');
assert(statusAfterCustomerReply('RESOLVED') === 'OPEN', 'customer reopen resolved');
assert(statusAfterCustomerReply('IN_PROGRESS') === 'IN_PROGRESS', 'keep in progress');
assert(statusAfterCustomerReply('CLOSED') === 'OPEN', 'closed reply forces open label');

assert(statusAfterStaffReply('OPEN') === 'WAITING_CUSTOMER', 'staff reply waits');
assert(statusAfterStaffReply('IN_PROGRESS') === 'WAITING_CUSTOMER', 'staff reply from progress');
assert(statusAfterStaffReply('RESOLVED') === 'RESOLVED', 'keep resolved');
assert(statusAfterStaffReply('CLOSED') === 'CLOSED', 'keep closed');

assert(normalizeCategory('payment') === 'PAYMENT', 'category');
assert(normalizeCategory('nope') === 'OTHER', 'category fallback');
assert(normalizePriority('urgent') === 'URGENT', 'priority');
assert(normalizePriority('') === 'NORMAL', 'priority fallback');

console.log('support-ticket.fsm.spec.ts: ok');
