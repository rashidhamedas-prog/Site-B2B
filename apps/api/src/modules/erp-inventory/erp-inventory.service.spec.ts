/**
 * Unit tests for ERP matrix inventory ingest (WHOLESALE + RETAIL).
 * npx ts-node --transpile-only src/modules/erp-inventory/erp-inventory.service.spec.ts
 */
import { NotFoundException } from '@nestjs/common';
import { ErpInventoryService, MatrixUpsertResult } from './erp-inventory.service';
import type { ErpMatrixUpsertDto } from './dto/erp-matrix.dto';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

type SetStockCall = {
  variantId: string;
  qty: number;
  note: string;
  actor: string;
  channel: string;
};

const TEST_PRODUCT = {
  id: 'prod-1',
  sku: 'COATS00012',
  variants: [
    {
      id: 'var-black-m',
      color: 'مشکی',
      size: 'M',
      barcode: '6281234567890',
      wholesaleStock: 10,
      retailStock: 4,
    },
    {
      id: 'var-white-l',
      color: 'سفید',
      size: 'L',
      barcode: '6281234567891',
      wholesaleStock: 0,
      retailStock: 0,
    },
  ],
};

type HarnessProduct = typeof TEST_PRODUCT;

function createHarness(opts?: {
  product?: HarnessProduct | null;
  productsById?: Record<string, HarnessProduct>;
  mapFindOne?: (args: { where: { erpVariantSku: string } }) => Promise<unknown>;
  productMapFindOne?: (args: { where: { erpProductSku: string } }) => Promise<unknown>;
  variantFindResult?: Array<{ id: string; productId: string; barcode: string }>;
  idemSeed?: Map<string, { response: MatrixUpsertResult; expiresAt: Date }>;
}) {
  const setStockCalls: SetStockCall[] = [];
  const mapSaves: unknown[] = [];
  const idemStore =
    opts?.idemSeed ??
    new Map<string, { response: MatrixUpsertResult; expiresAt: Date }>();

  const catalog = opts?.productsById ?? { [TEST_PRODUCT.id]: opts?.product ?? TEST_PRODUCT };
  const defaultProduct =
    opts?.product === null ? null : opts?.product ?? TEST_PRODUCT;

  const productService = {
    findBySku: async (sku: string) => {
      if (defaultProduct && sku === defaultProduct.sku) return defaultProduct;
      throw new NotFoundException(`Product ${sku} not found`);
    },
    findOne: async (id: string) => {
      const row = catalog[id];
      if (!row) throw new NotFoundException(`Product ${id} not found`);
      return row;
    },
  };

  const inventoryService = {
    setStock: async (
      variantId: string,
      qty: number,
      note: string,
      actor: string,
      channel: string,
    ) => {
      setStockCalls.push({ variantId, qty, note, actor, channel });
    },
  };

  const mapRepo = {
    findOne: opts?.mapFindOne ?? (async () => null),
    create: (row: unknown) => row,
    save: async (row: unknown) => {
      mapSaves.push(row);
      return row;
    },
  };

  const productMapSaves: unknown[] = [];
  const productMapRepo = {
    findOne: opts?.productMapFindOne ?? (async () => null),
    create: (row: unknown) => row,
    save: async (row: unknown) => {
      productMapSaves.push(row);
      return row;
    },
  };

  const variantRepo = {
    find: async () => opts?.variantFindResult ?? [],
  };

  const idemRepo = {
    findOne: async ({ where }: { where: { idempotencyKey: string } }) => {
      const seeded = idemStore.get(where.idempotencyKey);
      if (!seeded) return null;
      if (seeded.expiresAt.getTime() < Date.now()) {
        idemStore.delete(where.idempotencyKey);
        return null;
      }
      return {
        idempotencyKey: where.idempotencyKey,
        response: seeded.response,
        expiresAt: seeded.expiresAt,
      };
    },
    create: (row: unknown) => row,
    save: async (row: {
      idempotencyKey: string;
      response: MatrixUpsertResult;
      expiresAt: Date;
    }) => {
      idemStore.set(row.idempotencyKey, {
        response: row.response,
        expiresAt: row.expiresAt,
      });
      return row;
    },
    delete: async () => ({ affected: 0 }),
  };

  const service = new ErpInventoryService(
    productService as never,
    inventoryService as never,
    mapRepo as never,
    productMapRepo as never,
    variantRepo as never,
    idemRepo as never,
  );

  return { service, setStockCalls, mapSaves, productMapSaves, idemStore };
}

function baseBody(overrides: Partial<ErpMatrixUpsertDto> = {}): ErpMatrixUpsertDto {
  return {
    channel: 'WHOLESALE',
    productSku: 'COATS00012',
    variants: [
      {
        erpVariantSku: 'ERP-V1',
        color: 'مشکی',
        size: 'M',
        qty: 7,
      },
    ],
    ...overrides,
  };
}

async function testErpProductCodeAsSku() {
  const { service, setStockCalls } = createHarness({
    product: { ...TEST_PRODUCT, sku: '7126' },
  });
  const result = await service.upsertMatrix(
    baseBody({
      productSku: '7126',
      variants: [{ erpVariantSku: 'ERP-V1', color: 'مشکی', size: 'M', qty: 8 }],
    }),
  );
  assert(result.ok === true, 'erp code sku: ok');
  assert(result.resolvedBy === 'sku', 'erp code sku: resolvedBy sku');
  assert(setStockCalls[0].qty === 8, 'erp code sku: qty');
}

async function testWholesaleSetStockChannel() {
  const { service, setStockCalls } = createHarness();
  const result = await service.upsertMatrix(baseBody({ channel: 'WHOLESALE' }));

  assert(result.ok === true, 'wholesale: ok when matched');
  assert(result.channel === 'WHOLESALE', 'wholesale: channel echoed');
  assert(setStockCalls.length === 1, 'wholesale: one setStock');
  assert(setStockCalls[0].channel === 'WHOLESALE', 'wholesale: setStock channel');
  assert(setStockCalls[0].variantId === 'var-black-m', 'wholesale: variant id');
  assert(setStockCalls[0].qty === 7, 'wholesale: qty');
  assert(setStockCalls[0].actor === 'erp', 'wholesale: actor erp');
  assert(setStockCalls[0].note === 'ERP matrix sync', 'wholesale: note');
  assert(result.resolvedBy === 'sku', 'wholesale: resolvedBy sku');
}

async function testRetailSetStockChannel() {
  const { service, setStockCalls } = createHarness();
  const result = await service.upsertMatrix(baseBody({ channel: 'RETAIL', variants: [{ erpVariantSku: 'ERP-R1', color: 'مشکی', size: 'M', qty: 2 }] }));

  assert(result.ok === true, 'retail: ok when matched');
  assert(result.channel === 'RETAIL', 'retail: channel echoed');
  assert(setStockCalls.length === 1, 'retail: one setStock');
  assert(setStockCalls[0].channel === 'RETAIL', 'retail: setStock channel');
  assert(setStockCalls[0].qty === 2, 'retail: qty');
}

async function testDryRunSkipsSetStock() {
  const { service, setStockCalls, mapSaves } = createHarness();
  const result = await service.upsertMatrix(baseBody({ dryRun: true, channel: 'RETAIL' }));

  assert(result.dryRun === true, 'dryRun flag');
  assert(setStockCalls.length === 0, 'dryRun: no setStock');
  assert(mapSaves.length === 0, 'dryRun: no map persist');
  assert(result.matched.length === 1, 'dryRun: still resolves match');
  assert(result.matched[0].stock === 4, 'dryRun: stock from retail channel projection');
  assert(result.matched[0].qty === 7, 'dryRun: requested qty in result');
}

async function testUnmatchedVariantOkFalse() {
  const { service, setStockCalls } = createHarness();
  const result = await service.upsertMatrix(
    baseBody({
      variants: [
        { erpVariantSku: 'ERP-UNKNOWN', color: 'آبی', size: 'XL', qty: 5 },
      ],
    }),
  );

  assert(result.ok === false, 'unmatched: ok false');
  assert(result.matched.length === 0, 'unmatched: no matched rows');
  assert(result.unmatched.length === 1, 'unmatched: one row');
  assert(result.unmatched[0].reason === 'variant_not_matched', 'unmatched: reason');
  assert(setStockCalls.length === 0, 'unmatched: no setStock');
  assert(Array.isArray(result.onSite) && result.onSite.length === 2, 'unmatched: site matrix is listed');
  assert(result.onSite!.some((row) => row.color === 'مشکی' && row.size === 'M'), 'unmatched: lists the real site color');
}

async function testProductSkuNotFound() {
  const { service, setStockCalls } = createHarness({ product: null });
  const result = await service.upsertMatrix(
    baseBody({
      productSku: 'MISSING-SKU',
      variants: [{ erpVariantSku: 'E1', color: 'مشکی', size: 'M', qty: 1 }],
    }),
  );

  assert(result.ok === false, 'not found: ok false');
  assert(result.productId === null, 'not found: no product id');
  assert(result.matched.length === 0, 'not found: no matches');
  assert(result.unmatched.length === 1, 'not found: variants listed');
  assert(result.unmatched[0].reason === 'product_sku_not_found', 'not found: reason');
  assert(result.onSite == null, 'not found: no site matrix to invent');
  assert(setStockCalls.length === 0, 'not found: no setStock');
}

async function testIdempotencyReturnsCached() {
  const cached: MatrixUpsertResult = {
    ok: true,
    productId: 'cached-prod',
    productSku: 'COATS00012',
    channel: 'WHOLESALE',
    dryRun: false,
    matched: [
      {
        erpVariantSku: 'CACHED',
        variantId: 'var-cached',
        matchedBy: 'map',
        qty: 99,
        stock: 99,
      },
    ],
    unmatched: [],
  };

  const idemSeed = new Map<string, { response: MatrixUpsertResult; expiresAt: Date }>();
  idemSeed.set('idem-key-1', {
    response: cached,
    expiresAt: new Date(Date.now() + 60_000),
  });

  const { service, setStockCalls } = createHarness({ idemSeed });
  const result = await service.upsertMatrix(
    baseBody({ idempotencyKey: 'idem-key-1', variants: [{ erpVariantSku: 'SHOULD-NOT-RUN', color: 'مشکی', size: 'M', qty: 1 }] }),
  );

  assert(result.idempotent === true, 'idempotent flag');
  assert(result.productId === 'cached-prod', 'idempotent: cached productId');
  assert(result.matched[0].erpVariantSku === 'CACHED', 'idempotent: cached body');
  assert(setStockCalls.length === 0, 'idempotent: setStock skipped');
  assert(
    (await service.upsertMatrix(baseBody({ idempotencyKey: 'idem-key-1' }))).idempotent === true,
    'idempotent: stable on repeat',
  );
}

async function testProductMapResolve() {
  const { service, setStockCalls } = createHarness({
    productMapFindOne: async ({ where }) =>
      where.erpProductSku === '7200'
        ? { erpProductSku: '7200', productId: 'prod-1', matchedBy: 'barcode' }
        : null,
  });

  const result = await service.upsertMatrix(
    baseBody({
      productSku: '7200',
      variants: [{ erpVariantSku: 'ERP-V1', color: 'مشکی', size: 'M', qty: 5 }],
    }),
  );

  assert(result.ok === true, 'product map: ok');
  assert(result.resolvedBy === 'product_map', 'product map: resolvedBy');
  assert(result.productId === 'prod-1', 'product map: product id');
  assert(setStockCalls.length === 1, 'product map: setStock');
}

async function testBarcodeProductResolveWhenSkuMissing() {
  const { service, setStockCalls, productMapSaves } = createHarness({
    variantFindResult: [
      { id: 'var-black-m', productId: 'prod-1', barcode: '6281234567890' },
    ],
  });

  const result = await service.upsertMatrix(
    baseBody({
      productSku: '7126',
      variants: [
        {
          erpVariantSku: 'ERP-V1',
          color: 'مشکی',
          size: 'M',
          barcode: '6281234567890',
          qty: 4,
        },
      ],
    }),
  );

  assert(result.ok === true, 'barcode product: ok');
  assert(result.resolvedBy === 'barcode', 'barcode product: resolvedBy');
  assert(result.productId === 'prod-1', 'barcode product: id');
  assert(setStockCalls.length === 1, 'barcode product: setStock');
  assert(productMapSaves.length === 1, 'barcode product: map persisted');
  assert(
    (productMapSaves[0] as { erpProductSku: string }).erpProductSku === '7126',
    'barcode product: erp sku key',
  );
}

async function testAmbiguousBarcodesProductNotFound() {
  const { service, setStockCalls } = createHarness({
    variantFindResult: [
      { id: 'v1', productId: 'prod-1', barcode: '6281234567890' },
      { id: 'v2', productId: 'prod-2', barcode: '6281234567891' },
    ],
    productsById: {
      'prod-1': TEST_PRODUCT,
      'prod-2': { ...TEST_PRODUCT, id: 'prod-2', sku: 'OTHER' },
    },
  });

  const result = await service.upsertMatrix(
    baseBody({
      productSku: '7200',
      variants: [
        {
          erpVariantSku: 'E1',
          color: 'مشکی',
          size: 'M',
          barcode: '6281234567890',
          qty: 1,
        },
        {
          erpVariantSku: 'E2',
          color: 'سفید',
          size: 'L',
          barcode: '6281234567891',
          qty: 1,
        },
      ],
    }),
  );

  assert(result.ok === false, 'ambiguous: ok false');
  assert(result.productId === null, 'ambiguous: no product');
  assert(result.resolvedBy === undefined, 'ambiguous: no resolvedBy');
  assert(result.unmatched[0].reason === 'product_sku_not_found', 'ambiguous: reason');
  assert(setStockCalls.length === 0, 'ambiguous: no setStock');
}

async function testPartialMatchOkFalse() {
  const { service, setStockCalls } = createHarness();
  const result = await service.upsertMatrix(
    baseBody({
      variants: [
        { erpVariantSku: 'ERP-OK', color: 'مشکی', size: 'M', qty: 3 },
        { erpVariantSku: 'ERP-BAD', color: 'زرد', size: 'XXS', qty: 1 },
      ],
    }),
  );

  assert(result.ok === false, 'partial: ok false when any unmatched');
  assert(result.matched.length === 1, 'partial: one matched');
  assert(result.unmatched.length === 1, 'partial: one unmatched');
  assert(setStockCalls.length === 1, 'partial: setStock only for matched');
}

async function testSpaceEqualsHalfSpace() {
  const { service, setStockCalls } = createHarness({
    product: {
      ...TEST_PRODUCT,
      variants: [
        {
          id: 'var-brown',
          color: 'قهوه‌ای',
          size: 'فری سایز',
          barcode: '1',
          wholesaleStock: 0,
          retailStock: 0,
        },
      ],
    },
  });
  const result = await service.upsertMatrix(
    baseBody({
      variants: [{ erpVariantSku: 'B1', color: 'قهوه ای', size: 'فری سایز (مناسب تا 48)', qty: 4 }],
    }),
  );
  assert(result.ok === true, 'space/zwnj brown matches');
  assert(result.unmatched.length === 0, 'space/zwnj brown: no miss');
  assert(setStockCalls.length === 1 && setStockCalls[0].qty === 4, 'space/zwnj brown wrote qty');
}

async function testFailedMatchIsNotCached() {
  const { service, idemStore, setStockCalls } = createHarness();
  const first = await service.upsertMatrix(
    baseBody({
      idempotencyKey: 'miss-1',
      variants: [{ erpVariantSku: 'NOPE', color: 'آبی', size: 'XL', qty: 1 }],
    }),
  );
  assert(first.ok === false, 'miss: not ok');
  assert(!idemStore.has('miss-1'), 'miss: not cached');
  const second = await service.upsertMatrix(
    baseBody({
      idempotencyKey: 'miss-1',
      variants: [{ erpVariantSku: 'ERP-V1', color: 'مشکی', size: 'M', qty: 2 }],
    }),
  );
  assert(second.ok === true, 'same key retries after a miss');
  assert(second.idempotent !== true, 'retry is a real write');
  assert(setStockCalls.length === 1, 'retry wrote the matched row');
  assert(idemStore.has('miss-1'), 'success is cached');
}

async function testNearColorIsListedNotMatched() {
  const { service, setStockCalls } = createHarness({
    product: {
      ...TEST_PRODUCT,
      variants: [
        {
          id: 'var-cream',
          color: 'کرم',
          size: 'فری سایز',
          barcode: '',
          wholesaleStock: 0,
          retailStock: 0,
        },
      ],
    },
  });
  const result = await service.upsertMatrix(
    baseBody({
      variants: [{ erpVariantSku: 'C1', color: 'کرمی', size: 'فری سایز (مناسب تا 48)', qty: 3 }],
    }),
  );
  assert(result.ok === false, 'کرم is not کرمی');
  assert(result.unmatched.length === 1, 'near color stays unmatched');
  assert(setStockCalls.length === 0, 'near color writes no stock');
  assert(result.onSite && result.onSite[0].color === 'کرم' && result.onSite[0].size === 'فری سایز',
    'near color still reports the site label');
}

async function main() {
  await testErpProductCodeAsSku();
  await testWholesaleSetStockChannel();
  await testRetailSetStockChannel();
  await testDryRunSkipsSetStock();
  await testUnmatchedVariantOkFalse();
  await testProductSkuNotFound();
  await testProductMapResolve();
  await testBarcodeProductResolveWhenSkuMissing();
  await testAmbiguousBarcodesProductNotFound();
  await testIdempotencyReturnsCached();
  await testPartialMatchOkFalse();
  await testSpaceEqualsHalfSpace();
  await testNearColorIsListedNotMatched();
  await testFailedMatchIsNotCached();
  console.log('erp-inventory.service.spec.ts: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
