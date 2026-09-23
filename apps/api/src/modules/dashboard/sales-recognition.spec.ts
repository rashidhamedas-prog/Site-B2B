/**
 * npx ts-node --transpile-only src/modules/dashboard/sales-recognition.spec.ts
 */
import {
  isRecognizedSaleStatus,
  recognizedSaleAtSql,
  recognizedSalePeriodSql,
  recognizedSaleStatuses,
} from './sales-recognition';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const statuses = recognizedSaleStatuses();
assert(statuses.includes('SHIPPED') && statuses.includes('DELIVERED') && statuses.includes('COMPLETED'), 'sale statuses');
assert(statuses.length === 3, 'only post-ship happy path');

assert(isRecognizedSaleStatus('SHIPPED'), 'shipped');
assert(isRecognizedSaleStatus('delivered'), 'delivered is case-insensitive');
assert(isRecognizedSaleStatus('COMPLETED'), 'completed still counts');

for (const earlier of ['DRAFT', 'AWAITING_PAYMENT', 'PENDING_REVIEW', 'CONFIRMED', 'PROCESSING', 'PACKED']) {
  assert(!isRecognizedSaleStatus(earlier), `${earlier} is not a sale yet`);
}
for (const excluded of ['CANCELLED', 'DELETED', 'REFUNDED', 'RETURNED', 'RETURN_REQUESTED']) {
  assert(!isRecognizedSaleStatus(excluded), `${excluded} is not a sale`);
}
assert(!isRecognizedSaleStatus(''), 'empty status');
assert(!isRecognizedSaleStatus(null), 'null status');

assert(recognizedSaleAtSql() === 'COALESCE(o.shippedAt, o.createdAt)', 'ship date with create fallback');
assert(
  recognizedSalePeriodSql('o') === 'COALESCE(o.shippedAt, o.createdAt) >= :start AND COALESCE(o.shippedAt, o.createdAt) <= :end',
  'period uses ship date',
);

let threw = false;
try {
  recognizedSaleAtSql('o; drop');
} catch {
  threw = true;
}
assert(threw, 'rejects unsafe alias');

console.log('sales-recognition.spec.ts ok');
