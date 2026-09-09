/**
 * npx ts-node --transpile-only src/modules/product/public-product-channel.spec.ts
 */
import {
  resolvePublicProductChannel,
  stripOppositeChannelFields,
  stripVendorFulfillmentFields,
} from './public-product-channel';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(resolvePublicProductChannel('retail') === 'RETAIL', 'retail allowed');
assert(resolvePublicProductChannel('WHOLESALE') === 'WHOLESALE', 'wholesale allowed');
assert(resolvePublicProductChannel(undefined, true) === undefined, 'admin may omit channel');

for (const banned of [undefined, '', 'ALL', 'BOTH']) {
  let threw = false;
  try {
    resolvePublicProductChannel(banned);
  } catch (err) {
    threw = err instanceof Error && err.message === 'PUBLIC_CHANNEL_REQUIRED';
  }
  assert(threw, `${banned ?? 'undefined'} must be rejected for public callers`);
}

const retail = stripOppositeChannelFields(
  {
    retailPrice: 1,
    wholesalePrice: 2,
    retailStock: 3,
    wholesaleStock: 4,
    wholesaleFullContent: 'w',
    wholesaleDiscountAmount: 9,
    allowWholesaleColorSelect: true,
    retailFullContent: 'r',
  },
  'RETAIL',
);
assert(!('wholesalePrice' in retail), 'retail JSON drops wholesale price');
assert(!('wholesaleStock' in retail), 'retail JSON drops wholesale stock');
assert(!('wholesaleFullContent' in retail), 'retail JSON drops wholesale content');
assert(!('wholesaleDiscountAmount' in retail), 'retail JSON drops wholesale discount');
assert(retail.retailPrice === 1 && retail.retailStock === 3, 'retail keeps own columns');

const wholesale = stripOppositeChannelFields(
  { retailPrice: 1, wholesalePrice: 2, retailStock: 3, defaultRetailVariantId: 'x' },
  'WHOLESALE',
);
assert(!('retailPrice' in wholesale), 'wholesale JSON drops retail price');
assert(!('defaultRetailVariantId' in wholesale), 'wholesale JSON drops retail variant id');
assert(wholesale.wholesalePrice === 2, 'wholesale keeps own price');

const strippedVendor = stripVendorFulfillmentFields({
  vendorId: '11111111-1111-4111-8111-111111111111',
  commissionPercent: 10,
  brandName: 'کیف',
  retailPrice: 1,
});
assert(!('vendorId' in strippedVendor), 'public drops vendorId');
assert(!('commissionPercent' in strippedVendor), 'public drops commission');
assert(strippedVendor.brandName === 'کیف' && strippedVendor.retailPrice === 1, 'public keeps brand');

console.log('public-product-channel.spec.ts: ok');
