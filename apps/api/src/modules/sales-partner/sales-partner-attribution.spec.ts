import { canAdminChangeAttribution, partnerOrderAttribution } from './sales-partner-attribution';

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

console.log('sales-partner-attribution.spec.ts: OK');
