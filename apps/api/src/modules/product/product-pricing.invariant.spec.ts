/**
 * HIGH-5 channel pricing invariant unit checks (no Nest bootstrap).
 * Prefer: npx ts-node --transpile-only src/modules/product/product-pricing.invariant.spec.ts
 */
import { BadRequestException } from '@nestjs/common';
import { normalizeProductChannelPrices } from './product.service';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function throws(fn: () => unknown, label: string) {
  try {
    fn();
    throw new Error(`expected throw: ${label}`);
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('expected throw:')) throw e;
    assert(e instanceof BadRequestException, `${label}: expected BadRequestException, got ${e}`);
  }
}

// --- create defaults: both channels on ---
{
  const r = normalizeProductChannelPrices({
    wholesalePrice: 1_000_000,
    retailPrice: 1_500_000,
  });
  assert(r.wholesalePrice === 1_000_000, 'create wholesale final');
  assert(r.retailPrice === 1_500_000, 'create retail final');
  assert(r.wholesaleCompareAtPrice === null, 'create wholesale compare null');
  assert(r.retailCompareAtPrice === null, 'create retail compare null');
}

// --- create with compare-at strictly greater ---
{
  const r = normalizeProductChannelPrices({
    wholesalePrice: 100,
    retailPrice: 200,
    wholesaleCompareAtPrice: 150,
    retailCompareAtPrice: 250,
    showOnRetail: true,
    showOnWholesale: true,
  });
  assert(r.wholesaleCompareAtPrice === 150, 'wholesale compare ok');
  assert(r.retailCompareAtPrice === 250, 'retail compare ok');
}

// --- retail required when showOnRetail default/true ---
throws(
  () => normalizeProductChannelPrices({ wholesalePrice: 100, retailPrice: null }),
  'retail null with showOnRetail default'
);
throws(
  () =>
    normalizeProductChannelPrices({
      wholesalePrice: 100,
      retailPrice: undefined,
      showOnRetail: true,
    }),
  'retail missing with showOnRetail true'
);

// --- retail may be null when channel off (update clear / create off-channel) ---
{
  const r = normalizeProductChannelPrices({
    wholesalePrice: 100,
    retailPrice: null,
    showOnRetail: false,
  });
  assert(r.retailPrice === null, 'null retail allowed off-channel');
}

// --- wholesale always required positive (DB NOT NULL) even if showOnWholesale false ---
throws(
  () =>
    normalizeProductChannelPrices({
      wholesalePrice: null,
      retailPrice: null,
      showOnWholesale: false,
      showOnRetail: false,
    }),
  'wholesale still required when wholesale channel off'
);
{
  const r = normalizeProductChannelPrices({
    wholesalePrice: 100,
    retailPrice: null,
    showOnWholesale: false,
    showOnRetail: false,
  });
  assert(r.wholesalePrice === 100, 'wholesale kept when channel off');
}

// --- update-like merge: enabling retail requires positive final ---
throws(
  () =>
    normalizeProductChannelPrices({
      wholesalePrice: 100,
      retailPrice: null,
      showOnRetail: true,
    }),
  'enabling retail without price'
);

// --- compare-at must be STRICTLY greater than final ---
throws(
  () =>
    normalizeProductChannelPrices({
      wholesalePrice: 100,
      retailPrice: 200,
      wholesaleCompareAtPrice: 100,
    }),
  'wholesale compare-at == final'
);
throws(
  () =>
    normalizeProductChannelPrices({
      wholesalePrice: 100,
      retailPrice: 200,
      wholesaleCompareAtPrice: 99,
    }),
  'wholesale compare-at < final'
);
throws(
  () =>
    normalizeProductChannelPrices({
      wholesalePrice: 100,
      retailPrice: 200,
      retailCompareAtPrice: 200,
    }),
  'retail compare-at == final'
);
throws(
  () =>
    normalizeProductChannelPrices({
      wholesalePrice: 100,
      retailPrice: null,
      showOnRetail: false,
      retailCompareAtPrice: 300,
    }),
  'retail compare-at without final'
);

// --- zero / negative / NaN / huge ---
throws(
  () => normalizeProductChannelPrices({ wholesalePrice: 0, retailPrice: 100 }),
  'wholesale zero'
);
throws(
  () =>
    normalizeProductChannelPrices({
      wholesalePrice: 100,
      retailPrice: 0,
      showOnRetail: true,
    }),
  'retail zero on-channel'
);
throws(
  () =>
    normalizeProductChannelPrices({
      wholesalePrice: 100,
      retailPrice: 0,
      showOnRetail: false,
    }),
  'retail zero even off-channel if sent'
);
throws(
  () => normalizeProductChannelPrices({ wholesalePrice: -1, retailPrice: 100 }),
  'wholesale negative'
);
throws(
  () =>
    normalizeProductChannelPrices({
      wholesalePrice: 100,
      retailPrice: -5,
      showOnRetail: true,
    }),
  'retail negative'
);
throws(
  () => normalizeProductChannelPrices({ wholesalePrice: NaN, retailPrice: 100 }),
  'wholesale NaN'
);
throws(
  () =>
    normalizeProductChannelPrices({
      wholesalePrice: 100,
      retailPrice: Number.NaN,
      showOnRetail: true,
    }),
  'retail NaN'
);
throws(
  () =>
    normalizeProductChannelPrices({
      wholesalePrice: Number.MAX_SAFE_INTEGER + 1,
      retailPrice: 100,
    }),
  'wholesale beyond MAX_SAFE_INTEGER'
);

// --- bigint path ---
{
  const r = normalizeProductChannelPrices({
    wholesalePrice: BigInt(1_234_567),
    retailPrice: BigInt(2_000_000),
  });
  assert(r.wholesalePrice === 1_234_567, 'bigint wholesale');
  assert(r.retailPrice === 2_000_000, 'bigint retail');
}

console.log('product-pricing.invariant.spec.ts: OK');
