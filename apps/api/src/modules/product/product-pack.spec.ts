/**
 * npx ts-node --transpile-only src/modules/product/product-pack.spec.ts
 */
import {
  computePackQty,
  compositionPerSize,
  DEFAULT_MIN_PACK_QTY,
  distinctColorNames,
  minOrderPieces,
  normalizeMinPackQty,
  normalizeProductPackSizeFields,
  packSummaryFa,
  piecesPerColorInPack,
  sizesForSizeType,
} from './product-pack';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(sizesForSizeType('FREE').length === 1, 'FREE has 1 size');
assert(sizesForSizeType('TWO').length === 2, 'TWO has 2 sizes');
assert(sizesForSizeType('THREE').length === 3, 'THREE has 3 sizes');
assert(
  JSON.stringify(sizesForSizeType('CUSTOM', ['۳۸', ' ۴۰', '۳۸', ''])) ===
    JSON.stringify(['۳۸', '۴۰']),
  'CUSTOM labels normalized',
);
assert(sizesForSizeType('CUSTOM', []).length === 0, 'CUSTOM empty until labels set');

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

assert(
  computePackQty(['آبی', 'قرمز'], {
    sizeType: 'CUSTOM',
    sizeLabels: ['S', 'M', 'L'],
    packDefinitionMode: 'AUTO',
  }) === 6,
  'CUSTOM AUTO = colors × sizes',
);

assert(
  piecesPerColorInPack({
    sizeType: 'TWO',
    packDefinitionMode: 'MANUAL',
    packComposition: { 'سایز ۱': 2, 'سایز ۲': 1 },
  }) === 3,
  'MANUAL pieces per color',
);

assert(
  computePackQty(['آبی', 'قرمز'], {
    sizeType: 'TWO',
    packDefinitionMode: 'MANUAL',
    packComposition: { 'سایز ۱': 2, 'سایز ۲': 1 },
  }) === 6,
  'MANUAL pack = colors × composition sum',
);

assert(
  JSON.stringify(
    compositionPerSize({
      sizeType: 'TWO',
      packDefinitionMode: 'AUTO',
    }),
  ) === JSON.stringify({ 'سایز ۱': 1, 'سایز ۲': 1 }),
  'AUTO composition is 1 per size',
);

const normalizedManual = normalizeProductPackSizeFields({
  sizeType: 'CUSTOM',
  sizeLabels: ['۳۸', '۴۰'],
  packDefinitionMode: 'MANUAL',
  packComposition: { '۳۸': 2, '۴۰': 0 },
});
assert(normalizedManual.packDefinitionMode === 'MANUAL', 'manual mode kept');
assert(normalizedManual.packComposition?.['۳۸'] === 2, 'manual composition kept');
assert(normalizedManual.sizeLabels?.length === 2, 'custom labels kept');

const normalizedAuto = normalizeProductPackSizeFields({
  sizeType: 'TWO',
  packDefinitionMode: 'AUTO',
  packComposition: { 'سایز ۱': 9 },
});
assert(normalizedAuto.packDefinitionMode === 'AUTO', 'auto mode');
assert(normalizedAuto.packComposition === null, 'AUTO clears composition');
assert(normalizedAuto.sizeLabels === null, 'preset clears custom labels');

let threw = false;
try {
  normalizeProductPackSizeFields({
    sizeType: 'CUSTOM',
    sizeLabels: [],
    packDefinitionMode: 'AUTO',
  });
} catch {
  threw = true;
}
assert(threw, 'CUSTOM without labels rejected');

threw = false;
try {
  normalizeProductPackSizeFields({
    sizeType: 'TWO',
    packDefinitionMode: 'MANUAL',
    packComposition: { 'سایز ۱': 0, 'سایز ۲': 0 },
  });
} catch {
  threw = true;
}
assert(threw, 'empty MANUAL pack rejected');

assert(normalizeMinPackQty(undefined) === DEFAULT_MIN_PACK_QTY, 'default 1 pack');
assert(normalizeMinPackQty(2) === 2, 'custom packs');

threw = false;
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
