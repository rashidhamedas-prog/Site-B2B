/**
 * npx ts-node --transpile-only src/lib/order-admin-snapshot.spec.ts
 */
import {
  asPaymentRows,
  describeSettlement,
  orderDeliveryAddresses,
  pickOrderPayment,
  recipientSnapshot,
} from './order-admin-snapshot';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const address = JSON.stringify({
  recipient: 'حوریه غلامی',
  mobile: '09120000000',
  province: 'خراسان رضوی',
  city: 'مشهد',
  street: 'احمدآباد، پلاک ۱۲',
  postalCode: '9187154321',
});

const snap = recipientSnapshot({
  shippingAddress: address,
  customer: {
    id: 'cust-1',
    businessName: 'حوریه غلامی',
    ownerName: 'حوریه غلامی',
    phone: '09120000000',
    city: 'تهران',
    province: 'تهران',
  },
});

assert(snap.name === 'حوریه غلامی', 'recipient name');
assert(snap.phone === '09120000000', 'recipient mobile');
assert(snap.address.includes('مشهد'), 'delivery city from order');
assert(snap.address.includes('احمدآباد'), 'street from order');
assert(snap.postalCode === '9187154321', 'postal from order');
assert(snap.profilePlace === 'تهران، تهران', 'profile keeps signup city');
assert(snap.customerId === 'cust-1', 'customer link');
assert(snap.hasDelivery, 'delivery snapshot present');

const fromAddressOnly = recipientSnapshot({
  shippingAddress: address,
  customer: null,
});
assert(fromAddressOnly.name === 'حوریه غلامی', 'name survives missing profile');
assert(fromAddressOnly.hasDelivery, 'address-only order still has a recipient');
assert(fromAddressOnly.customerId === '', 'no dossier id');

const placeholder = recipientSnapshot({
  customer: { ownerName: 'خریدار ترنم', businessName: '09120000000', phone: '09120000000', city: 'تهران', province: 'تهران' },
});
assert(placeholder.name === '', 'placeholder profile is not a recipient');
assert(placeholder.phone === '09120000000', 'profile phone remains');

const empty = recipientSnapshot({ customer: null });
assert(!empty.hasDelivery, 'empty without an address snapshot');

const paid = describeSettlement({
  paymentMethod: 'ONLINE',
  orderId: 'order-45',
  payments: [
    { orderId: 'order-45', gateway: 'TOROBPAY', status: 'FAILED', amount: 1000 },
    { orderId: 'order-45', gateway: 'DIGIPAY', status: 'PAID', refId: '9988', amount: 11600000, paidAt: '2026-09-23T15:55:00.000Z' },
    { orderId: 'other', gateway: 'ZARINPAL', status: 'PAID', amount: 5000 },
  ],
});
assert(paid.headline === 'دیجی‌پی', 'paid gateway wins over failed attempt');
assert(paid.statusLabel === 'تسویه‌شده', 'paid status');
assert(paid.refId === '9988', 'bank ref');
assert(paid.amountToman === 1160000, 'irr to toman');

const onlineOnly = describeSettlement({ paymentMethod: 'ONLINE', orderId: 'missing', payments: [] });
assert(onlineOnly.headline === 'آنلاین', 'method label when no receipt');
assert(onlineOnly.statusLabel === '', 'no invented status');

const cash = describeSettlement({ paymentMethod: 'CASH' });
assert(cash.headline === 'نقدی هنگام تحویل', 'cash settlement');

assert(pickOrderPayment([{ orderId: 'a', status: 'CANCELLED' }, { orderId: 'a', status: 'PENDING' }], 'a')?.status === 'PENDING', 'pending outranks cancelled');
assert(asPaymentRows([{ orderId: 'a', gateway: 'DIGIPAY' }]).length === 1, 'array payload');
assert(asPaymentRows({ data: [{ orderId: 'a' }] }).length === 1, 'wrapped payload');
assert(asPaymentRows(null).length === 0, 'empty payload');

const deliveries = orderDeliveryAddresses([
  { id: '1', orderNumber: 'ORD-1', shippingAddress: address },
  { id: '2', orderNumber: 'ORD-2', shippingAddress: address },
  { id: '3', orderNumber: 'ORD-3', shippingAddress: 'تهران، خیابان آزادی' },
]);
assert(deliveries.length === 2, 'duplicate delivery collapsed');
assert(deliveries[0]?.orderNumber === 'ORD-1', 'first order kept');

console.log('order-admin-snapshot.spec ok');
