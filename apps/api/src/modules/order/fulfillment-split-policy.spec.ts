/**
 * npx tsx src/modules/order/fulfillment-split-policy.spec.ts
 */
import {
  canPartnerAcceptStatus,
  canPartnerRejectStatus,
  canPartnerShipStatus,
  commissionAmountIrr,
  FULFILLMENT_OWN_KEY,
  isAcceptSlaExpired,
  normalizeTrackingCode,
  parcelLabelForIndex,
  partnerMayAccessFulfillment,
  shouldEnqueuePartnerNotify,
  snapshotVendorFulfillment,
  splitLinesIntoParcels,
  stripOrderVendorSecrets,
  toCustomerParcels,
  vendorGroupKey,
} from './fulfillment-split-policy';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(vendorGroupKey(null) === FULFILLMENT_OWN_KEY, 'null is OWN');
assert(snapshotVendorFulfillment({}).vendorId === null, 'own snapshot');
assert(snapshotVendorFulfillment({ vendorId: 'v1', commissionPercent: 15 }).commissionPercent === 15, 'dropship snap');

assert(commissionAmountIrr(1000, 15) === 150, '15% of 1000');
assert(commissionAmountIrr(1000, 0) === 0, 'zero commission');
assert(parcelLabelForIndex(1) === 'مرسوله ۱', 'persian parcel 1');
assert(parcelLabelForIndex(2) === 'مرسوله ۲', 'persian parcel 2');

const groups = splitLinesIntoParcels([
  {
    id: 'b',
    vendorId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    commissionPercent: 10,
    totalPrice: 200,
    quantity: 1,
    productName: 'کیف',
    sku: 'BAG',
    color: 'مشکی',
    size: 'FREE',
  },
  {
    id: 'a',
    vendorId: null,
    totalPrice: 100,
    quantity: 1,
    productName: 'مانتو',
    sku: 'M',
    color: 'کرم',
    size: 'FREE',
  },
]);
assert(groups.length === 2, 'two parcels');
assert(groups[0].vendorId === null && groups[0].parcelLabel === 'مرسوله ۱', 'OWN first unlabeled');
assert(groups[1].shippingFee === 0, 'no SHIP share on parcel');
assert(groups[1].status === 'PENDING_ACCEPT', 'partner waits');
assert(groups[0].status === 'ACCEPTED', 'OWN auto-accepted');
assert(groups[1].commissionTotal === 20, 'partner commission snapshotted');

const leaked = stripOrderVendorSecrets({
  id: 'o',
  items: [{ vendorId: 'v', commissionPercent: 9, sku: 'X' }],
});
assert(!('vendorId' in leaked.items[0]), 'customer JSON drops vendorId');
assert(!('commissionPercent' in leaked.items[0]), 'customer JSON drops commission');

assert(
  partnerMayAccessFulfillment('v1', 'v1') && !partnerMayAccessFulfillment('v1', 'v2'),
  'row-level isolation',
);
assert(!partnerMayAccessFulfillment('v1', null), 'partner cannot read OWN parcel');
assert(canPartnerAcceptStatus('PENDING_ACCEPT') && !canPartnerAcceptStatus('ACCEPTED'), 'accept gate');
assert(shouldEnqueuePartnerNotify('v1', 'PENDING_ACCEPT'), 'vendor pending gets notify');
assert(!shouldEnqueuePartnerNotify(null, 'ACCEPTED'), 'OWN never notified');
assert(!shouldEnqueuePartnerNotify('v1', 'ACCEPTED'), 'accepted skips notify');
assert(canPartnerShipStatus('ACCEPTED') && !canPartnerShipStatus('PENDING_ACCEPT'), 'ship gate');
assert(canPartnerRejectStatus('PENDING_ACCEPT') && !canPartnerRejectStatus('ACCEPTED'), 'reject gate');
assert(isAcceptSlaExpired(new Date('2020-01-01T00:00:00Z'), new Date('2020-01-02T00:00:00Z')), 'past SLA');
assert(!isAcceptSlaExpired(new Date('2030-01-01T00:00:00Z'), new Date('2020-01-02T00:00:00Z')), 'future SLA');
assert(normalizeTrackingCode('  AB 12  ') === 'AB12', 'tracking normalize');
assert(normalizeTrackingCode('') === null, 'empty tracking rejected');

const customer = toCustomerParcels([
  {
    parcelIndex: 1,
    parcelLabel: 'مرسوله ۱',
    status: 'SHIPPED',
    trackingCode: 'TRK1',
    items: [{ productName: 'مانتو', sku: 'M', color: 'کرم', size: 'FREE', quantity: 1, imageUrl: null }],
  },
]);
assert(customer[0].parcelLabel === 'مرسوله ۱' && !('vendorId' in customer[0]), 'customer parcels unlabeled');
assert(customer[0].trackingCode === 'TRK1', 'customer sees tracking');

console.log('fulfillment-split-policy.spec.ts: ok');
