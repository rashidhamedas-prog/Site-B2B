/**
 * npx ts-node --transpile-only src/modules/dashboard/report-sql.spec.ts
 */
import {
  customerMatchesInvoiceSql,
  customerMatchesOrderSql,
  orderMatchesReturnSql,
  paymentLabel,
  orderMatchesItemSql,
  productMatchesVariantSql,
  variantMatchesOrderItemSql,
} from './report-sql';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const joins = [
  orderMatchesItemSql(),
  variantMatchesOrderItemSql(),
  productMatchesVariantSql(),
  customerMatchesOrderSql(),
  orderMatchesReturnSql(),
  customerMatchesInvoiceSql(),
];

for (const sql of joins) {
  assert(sql.includes('::text'), `${sql} must cast uuid to text`);
  assert(!/[^:]=\s*[a-z]\.(id|productId|productVariantId|customerId|orderId)(?!")/.test(sql), `${sql} must not compare raw uuid`);
}

assert(orderMatchesItemSql() === 'o.id::text = i."orderId"', 'order item join');
assert(
  variantMatchesOrderItemSql() === 'v.id::text = i."productVariantId"',
  'variant join casts uuid id against varchar item',
);
assert(
  productMatchesVariantSql() === 'p.id::text = v."productId"',
  'product join casts uuid id against varchar variant',
);
assert(paymentLabel('digipay') === 'دیجی‌پی', 'retail gateway label');
assert(paymentLabel('INSTALLMENT') === 'اقساط', 'wholesale installment label');
assert(paymentLabel('CREDIT') === 'اعتباری', 'wholesale credit label');
assert(paymentLabel('') === 'نامشخص', 'blank method');
assert(paymentLabel('CUSTOM') === 'CUSTOM', 'unknown method stays visible');

let threw = false;
try {
  variantMatchesOrderItemSql('v;drop', 'i');
} catch {
  threw = true;
}
assert(threw, 'alias injection rejected');

console.log('report-sql.spec.ts ok');
