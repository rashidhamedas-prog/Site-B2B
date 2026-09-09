/**
 * npx tsx src/modules/product/vendor-fulfillment-policy.spec.ts
 */
import {
  parseCommissionPercent,
  parsePublicBrandName,
  publicHideDefaultBrand,
  resolveVendorFulfillment,
  stripVendorFulfillmentFields,
} from './vendor-fulfillment-policy';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function throws(fn: () => void, code: string) {
  let got = '';
  try {
    fn();
  } catch (err) {
    got = err instanceof Error ? err.message : '';
  }
  assert(got === code, `expected ${code}, got ${got || 'nothing'}`);
}

assert(parseCommissionPercent(0) === 0, 'commission 0 ok');
assert(parseCommissionPercent(90) === 90, 'commission 90 ok');
throws(() => parseCommissionPercent(91), 'COMMISSION_PERCENT_INVALID');
throws(() => parseCommissionPercent(12.5), 'COMMISSION_PERCENT_INVALID');

assert(parsePublicBrandName('  ') === null, 'blank brand is null');
assert(parsePublicBrandName('کیف چرم') === 'کیف چرم', 'brand trimmed');
throws(() => parsePublicBrandName('x'.repeat(81)), 'BRAND_NAME_TOO_LONG');

const own = resolveVendorFulfillment({
  existingVendorId: null,
  existingCommission: null,
  existingBrand: null,
  showOnWholesale: true,
  showOnRetail: true,
});
assert(own.vendorId === null && own.commissionPercent === null, 'own has no commission');
assert(own.showOnWholesale === true, 'own can stay on wholesale');

const drop = resolveVendorFulfillment({
  vendorId: '11111111-1111-4111-8111-111111111111',
  commissionPercent: 15,
  brandName: '',
  existingVendorId: null,
  existingCommission: null,
  existingBrand: null,
  showOnWholesale: true,
  showOnRetail: false,
});
assert(drop.showOnWholesale === false && drop.showOnRetail === true, 'dropship is retail-only');
assert(drop.commissionPercent === 15 && drop.brandName === null, 'commission snapshotted later');

throws(
  () =>
    resolveVendorFulfillment({
      vendorId: '11111111-1111-4111-8111-111111111111',
      existingVendorId: null,
      existingCommission: null,
      existingBrand: null,
      showOnWholesale: false,
      showOnRetail: true,
    }),
  'COMMISSION_REQUIRED',
);

const publicRow = stripVendorFulfillmentFields({
  id: 'p',
  vendorId: '11111111-1111-4111-8111-111111111111',
  commissionPercent: 20,
  brandName: 'کیف',
  retailPrice: 1,
});
assert(!('vendorId' in publicRow), 'public drops vendorId');
assert(!('commissionPercent' in publicRow), 'public drops commission');
assert(publicRow.brandName === 'کیف', 'public keeps brandName');

assert(
  publicHideDefaultBrand('11111111-1111-4111-8111-111111111111', null) === true,
  'dropship without brand omits Taranom brand',
);
assert(publicHideDefaultBrand(null, null) === false, 'own keeps default brand');

console.log('vendor-fulfillment-policy.spec.ts: ok');
