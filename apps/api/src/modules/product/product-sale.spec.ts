/**
 * npx ts-node --transpile-only src/modules/product/product-sale.spec.ts
 */
import {
  applyChannelSalePrices,
  computeFinalFromBase,
  derivedIsDiscounted,
  equivalentPercent,
  isDiscountWindowActive,
  normalizeMinOrderQty,
  resolveChannelSale,
  GLOBAL_MIN_ORDER_QTY,
} from './product-sale';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

{
  const final = computeFinalFromBase(1_000_000, 'PERCENT', 20, null);
  assert(final === 800_000, `percent 20: got ${final}`);
  assert(equivalentPercent(1_000_000, 800_000) === 20, 'badge percent');
}

{
  const final = computeFinalFromBase(1_000_000, 'FIXED', null, 250_000);
  assert(final === 750_000, `fixed: got ${final}`);
}

let threw = false;
try {
  computeFinalFromBase(100, 'FIXED', null, 100);
} catch {
  threw = true;
}
assert(threw, 'fixed >= base should throw');

threw = false;
try {
  computeFinalFromBase(100, 'PERCENT', 0, null);
} catch {
  threw = true;
}
assert(threw, 'percent 0 should throw');

threw = false;
try {
  computeFinalFromBase(100, 'PERCENT', 100, null);
} catch {
  threw = true;
}
assert(threw, 'percent 100 should throw');

threw = false;
try {
  computeFinalFromBase(100, 'PERCENT', -5, null);
} catch {
  threw = true;
}
assert(threw, 'negative percent should throw');

assert(isDiscountWindowActive(null, null) === true, 'no window is active');
assert(
  isDiscountWindowActive('2099-01-01T00:00:00.000Z', null, new Date('2026-08-17')) === false,
  'future start inactive',
);
assert(
  isDiscountWindowActive(null, '2020-01-01T00:00:00.000Z', new Date('2026-08-17')) === false,
  'past end inactive',
);

{
  const expired = resolveChannelSale(
    {
      isDiscounted: true,
      discountType: 'PERCENT',
      discountPercent: 20,
      discountEndsAt: '2020-01-01T00:00:00.000Z',
      wholesalePrice: 800,
      retailPrice: 800,
      retailCompareAtPrice: 1000,
      wholesaleCompareAtPrice: 1000,
    },
    'RETAIL',
    new Date('2026-08-17'),
  );
  assert(expired.active === false, 'expired not active');
  assert(expired.payable === 1000, `expired payable should revert to original, got ${expired.payable}`);
  assert(expired.original === null, 'expired must not expose sale original');
}

{
  const live = resolveChannelSale(
    {
      isDiscounted: true,
      discountType: 'PERCENT',
      discountPercent: 20,
      wholesalePrice: 800,
      retailPrice: 800,
      retailCompareAtPrice: 1000,
    },
    'RETAIL',
  );
  assert(live.active === true, 'live sale');
  assert(live.payable === 800, 'live payable is final');
  assert(live.original === 1000, 'live original');
  assert(live.badgePercent === 20, 'live badge');
}

{
  const onlyWholesale = resolveChannelSale(
    {
      wholesaleIsDiscounted: true,
      retailIsDiscounted: false,
      wholesalePrice: 800,
      retailPrice: 1500,
      wholesaleCompareAtPrice: 1000,
      retailCompareAtPrice: null,
    },
    'WHOLESALE',
  );
  const retail = resolveChannelSale(
    {
      wholesaleIsDiscounted: true,
      retailIsDiscounted: false,
      wholesalePrice: 800,
      retailPrice: 1500,
      wholesaleCompareAtPrice: 1000,
      retailCompareAtPrice: null,
    },
    'RETAIL',
  );
  assert(onlyWholesale.active === true && onlyWholesale.payable === 800, 'wholesale-only sale');
  assert(retail.active === false && retail.payable === 1500, 'retail unchanged when wholesale sale on');
}

{
  const onlyRetail = {
    wholesaleIsDiscounted: false,
    retailIsDiscounted: true,
    wholesaleDiscountPercent: 10,
    retailDiscountPercent: 25,
    wholesalePrice: 2000,
    retailPrice: 750,
    wholesaleCompareAtPrice: null,
    retailCompareAtPrice: 1000,
  };
  const w = resolveChannelSale(onlyRetail, 'WHOLESALE');
  const r = resolveChannelSale(onlyRetail, 'RETAIL');
  assert(w.active === false && w.payable === 2000, 'wholesale off');
  assert(r.active === true && r.payable === 750 && r.badgePercent === 25, 'retail-only 25%');
}

{
  const both = {
    wholesaleIsDiscounted: true,
    retailIsDiscounted: true,
    wholesaleDiscountPercent: 10,
    retailDiscountPercent: 30,
    wholesalePrice: 900,
    retailPrice: 700,
    wholesaleCompareAtPrice: 1000,
    retailCompareAtPrice: 1000,
  };
  assert(resolveChannelSale(both, 'WHOLESALE').badgePercent === 10, 'wholesale 10%');
  assert(resolveChannelSale(both, 'RETAIL').badgePercent === 30, 'retail 30%');
}

{
  const applied = applyChannelSalePrices({
    baseIrr: 1_000_000,
    enabled: true,
    type: 'PERCENT',
    percent: 20,
  });
  assert(applied.compareAt === 1_000_000 && applied.final === 800_000, 'write-time percent');
  const off = applyChannelSalePrices({ baseIrr: 1_000_000, enabled: false, type: 'PERCENT', percent: 20 });
  assert(off.compareAt === null && off.final === 1_000_000, 'disabled channel keeps base, no compare-at');
}

{
  const first = applyChannelSalePrices({ baseIrr: 1250000, enabled: true, type: 'PERCENT', percent: 20 });
  const second = applyChannelSalePrices({ baseIrr: first.compareAt!, enabled: true, type: 'PERCENT', percent: 20 });
  assert(first.final === second.final && first.compareAt === second.compareAt, 'edit/save/edit no drift');
}

assert(derivedIsDiscounted({ wholesaleIsDiscounted: true, retailIsDiscounted: false }) === true, 'OR derived');
assert(derivedIsDiscounted({ wholesaleIsDiscounted: false, retailIsDiscounted: false }) === false, 'neither');

assert(normalizeMinOrderQty(undefined) === GLOBAL_MIN_ORDER_QTY, 'default min 1 pack');
assert(normalizeMinOrderQty(8) === 8, 'custom packs');
threw = false;
try {
  normalizeMinOrderQty(0, false);
} catch {
  threw = true;
}
assert(threw, 'below 1 rejected');
assert(normalizeMinOrderQty(2, true) === 2, 'legacy allowBelowMoq ignored');

console.log('product-sale.spec.ts OK');
