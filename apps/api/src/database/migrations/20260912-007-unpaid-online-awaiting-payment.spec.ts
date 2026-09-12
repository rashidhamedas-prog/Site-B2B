import { readFileSync } from 'fs';
import { join } from 'path';
import { UnpaidOnlineAwaitingPayment1757692800007 } from './20260912-007-unpaid-online-awaiting-payment';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const src = readFileSync(join(__dirname, '20260912-007-unpaid-online-awaiting-payment.ts'), 'utf8');

assert(/AWAITING_PAYMENT/.test(src), 'target status');
assert(/PENDING_REVIEW/.test(src), 'source status');
assert(/paymentMethod/.test(src), 'only ONLINE method');
assert(/id::text/.test(src), 'compare payment orderId as text');
assert(/voidedAt/.test(src), 'skip voided');
assert(/down\(/.test(src) && /PENDING_REVIEW/.test(src), 'down restores review');
assert(!!new UnpaidOnlineAwaitingPayment1757692800007(), 'class');
console.log('20260912-007-unpaid-online-awaiting-payment.spec ok');
