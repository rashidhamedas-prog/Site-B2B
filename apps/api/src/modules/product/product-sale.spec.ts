/**
 * npx ts-node --transpile-only src/modules/product/product-sale.spec.ts
 */
import {
  computeFinalFromBase,
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

assert(normalizeMinOrderQty(undefined) === GLOBAL_MIN_ORDER_QTY, 'default min 6');
assert(normalizeMinOrderQty(8) === 8, 'custom >= 6');
threw = false;
try {
  normalizeMinOrderQty(5, false);
} catch {
  threw = true;
}
assert(threw, 'below 6 without override');
assert(normalizeMinOrderQty(2, true) === 2, 'explicit override');

console.log('product-sale.spec.ts OK');
