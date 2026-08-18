/**
 * npx ts-node --transpile-only src/modules/product/product-pack.spec.ts
 */
import {
  computePackQty,
  DEFAULT_MIN_PACK_QTY,
  distinctColorNames,
  minOrderPieces,
  normalizeMinPackQty,
  packSummaryFa,
  sizesForSizeType,
} from './product-pack';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(sizesForSizeType('FREE').length === 1, 'FREE has 1 size');
assert(sizesForSizeType('TWO').length === 2, 'TWO has 2 sizes');
assert(sizesForSizeType('THREE').length === 3, 'THREE has 3 sizes');

assert(
  JSON.stringify(distinctColorNames(['سرمه‌ای', ' سرمه‌ای', 'کرم', 'سرمه‌ای'])) ===
    JSON.stringify(['سرمه‌ای', 'کرم']),
  'duplicate colors counted once',
);

assert(computePackQty(['آبی', 'قرمز'], 'FREE') === 2, '2 colors × FREE = 2');
assert(computePackQty(['آبی', 'قرمز'], 'TWO') === 4, '2 colors × TWO = 4');
assert(computePackQty(['آبی', 'قرمز', 'سبز'], 'THREE') === 9, '3 colors × THREE = 9');
assert(computePackQty(['آبی', 'آبی'], 'THREE') === 3, 'dup color does not inflate pack');
assert(computePackQty([], 'TWO') === 0, 'no colors → 0 pack pieces');

assert(normalizeMinPackQty(undefined) === DEFAULT_MIN_PACK_QTY, 'default 1 pack');
assert(normalizeMinPackQty(2) === 2, 'custom packs');

let threw = false;
try {
  normalizeMinPackQty(0);
} catch {
  threw = true;
}
assert(threw, '0 packs rejected');

threw = false;
try {
  normalizeMinPackQty(-3);
} catch {
  threw = true;
}
assert(threw, 'negative packs rejected');

assert(minOrderPieces(2, 12) === 24, '2 packs × 12 = 24 pieces');
assert(
  packSummaryFa(2, 12) === 'حداقل ۲ پک — هر پک ۱۲ عدد — مجموع حداقل سفارش ۲۴ عدد',
  `summary: ${packSummaryFa(2, 12)}`,
);

console.log('product-pack.spec.ts OK');
