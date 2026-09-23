import {
  attributeLinkProducts,
  canAdminChangeAttribution,
  normalizeSalesPartnerCode,
  partnerOrderAttribution,
  salesPartnerPublicCode,
  salesPartnerSharePath,
} from './sales-partner-attribution';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const stamped = partnerOrderAttribution({ draftId: 'draft-1', salesPartnerId: 'partner-1' });
assert(stamped.salesSource === 'SALES_PARTNER', 'source');
assert(stamped.salesPartnerId === 'partner-1', 'partner');
assert(stamped.salesPartnerSubmissionId === 'draft-1', 'draft id');
assert(stamped.affiliateId === null, 'no external affiliate');

assert(canAdminChangeAttribution({ reason: 'short', hasEarnedCommission: false, nextPartnerActive: true }).ok === false, 'reason too short');
assert(canAdminChangeAttribution({ reason: 'تصحيح انتساب سفارش', hasEarnedCommission: true, nextPartnerActive: true }).ok === false, 'locked after earn');
assert(canAdminChangeAttribution({ reason: 'تصحيح انتساب سفارش', hasEarnedCommission: false, nextPartnerActive: false }).ok === false, 'inactive target');
assert(canAdminChangeAttribution({ reason: 'تصحيح انتساب سفارش', hasEarnedCommission: false, nextPartnerActive: true }).ok === true, 'admin ok');

const code = salesPartnerPublicCode(Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8]));
assert(normalizeSalesPartnerCode(code) === code, 'generated code');
assert(normalizeSalesPartnerCode('ABC') === null, 'short code rejected');
assert(salesPartnerSharePath(code, 'sara').includes(`/go/sp/${code}/sara`), 'share path');

const clicked = attributeLinkProducts({
  partnerActive: true,
  selfReferral: false,
  requestedProductIds: ['p1', 'p2', 'p3'],
  cartProductIds: ['p1', 'p3'],
  eligibleProductIds: ['p1'],
});
assert(clicked.length === 1 && clicked[0] === 'p1', 'only clicked eligible cart line');
assert(attributeLinkProducts({
  partnerActive: true,
  selfReferral: true,
  requestedProductIds: ['p1'],
  cartProductIds: ['p1'],
  eligibleProductIds: ['p1'],
}).length === 0, 'self referral earns nothing');
assert(attributeLinkProducts({
  partnerActive: false,
  selfReferral: false,
  requestedProductIds: ['p1'],
  cartProductIds: ['p1'],
  eligibleProductIds: ['p1'],
}).length === 0, 'inactive partner ignored');

console.log('sales-partner-attribution.spec.ts: OK');
