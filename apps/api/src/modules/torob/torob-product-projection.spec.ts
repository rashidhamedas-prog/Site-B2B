import { resolveChannelSale } from '../product/product-sale';
import {
  enumeratePublishableOptions,
  irrToTomanOnce,
  pageUniqueForProduct,
  pageUniqueForVariant,
  projectSelectedPdpOption,
  projectTorobOption,
  retailPageUrl,
} from './torob-product-projection';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const baseProduct = {
  id: 'prod-1',
  sku: 'coats00001',
  slug: 'linen-coat',
  name: 'مانتو لینن',
  status: 'ACTIVE',
  showOnRetail: true,
  retailPrice: 2_500_000,
  images: ['https://cdn.example/products/coat.jpg'],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  variants: [] as any[],
};

{
  const row = projectTorobOption({ product: baseProduct });
  assert(row.publishable === true, 'publishable');
  assert(row.payload?.page_unique === pageUniqueForProduct('prod-1'), 'product unique');
  assert(row.payload?.current_price === 250_000, 'toman once');
  assert(row.payload?.availability === false, 'no stock');
  assert(!!row.payload?.spec && typeof row.payload.spec === 'object', 'spec object');
  assert(row.payload?.guarantee === undefined, 'no empty guarantee');
  const inStock = projectTorobOption({ product: { ...baseProduct, retailStock: 4 } });
  assert(inStock.payload?.availability === true, 'product-level retailStock');
}

{
  assert(projectTorobOption({ product: { ...baseProduct, showOnRetail: false } }).skipReason === 'hidden_retail', 'hidden');
  assert(projectTorobOption({ product: { ...baseProduct, status: 'ARCHIVED' } }).skipReason === 'not_active', 'archived');
  assert(
    projectTorobOption({ product: { ...baseProduct, deletedAt: '2026-01-03T00:00:00.000Z' } }).skipReason ===
      'soft_deleted',
    'deleted',
  );
  assert(projectTorobOption({ product: { ...baseProduct, retailPrice: 0 } }).skipReason === 'invalid_retail_price', 'price');
  const noImage = projectTorobOption({ product: { ...baseProduct, images: [], sku: 'coats00007' } });
  assert(noImage.publishable === false, 'coats00007 unpublished');
}

{
  const variant = {
    id: 'var-1',
    productId: 'prod-1',
    color: 'کرم',
    size: 'فری',
    retailStock: 3,
    wholesaleStock: 0,
    imageUrl: 'https://cdn.example/products/coat-cream.jpg',
    createdAt: '2026-01-01T12:00:00.000Z',
    updatedAt: '2026-01-05T00:00:00.000Z',
  };
  const row = projectTorobOption({ product: { ...baseProduct, retailStock: 0, variants: [variant] }, variant });
  assert(row.payload?.page_unique === pageUniqueForVariant('var-1'), 'variant unique');
  assert(row.payload?.availability === true, 'retail stock');
  assert(row.payload?.image_links[0] === 'https://cdn.example/products/coat-cream.jpg', 'option image first');
  assert(row.payload?.page_url === retailPageUrl('linen-coat', 'var-1'), 'page url');
  assert(row.payload?.date_updated === '2026-01-05T00:00:00.000Z', 'date_updated max');
}

{
  const out = projectTorobOption({
    product: { ...baseProduct, retailStock: 0 },
    variant: { id: 'var-0', productId: 'prod-1', retailStock: 0, wholesaleStock: 40 },
  });
  assert(out.publishable === true, 'oos still listed');
  assert(out.payload?.availability === false, 'wholesale stock ignored');
}

{
  const saleProduct = {
    ...baseProduct,
    retailIsDiscounted: true,
    retailDiscountType: 'PERCENT' as const,
    retailDiscountPercent: 20,
    retailPrice: 2_000_000,
    retailCompareAtPrice: 2_500_000,
  };
  const sale = resolveChannelSale(saleProduct as any, 'RETAIL');
  const row = projectTorobOption({ product: saleProduct });
  assert(row.payload?.current_price === irrToTomanOnce(sale.payable), 'sale price');
  if (sale.active) {
    assert((row.payload?.old_price || 0) > (row.payload?.current_price || 0), 'old_price');
  }
}

{
  const expired = projectTorobOption({
    product: {
      ...baseProduct,
      retailIsDiscounted: true,
      retailDiscountType: 'PERCENT',
      retailDiscountPercent: 20,
      retailPrice: 2_000_000,
      retailCompareAtPrice: 2_500_000,
      retailDiscountEndsAt: '2020-01-01T00:00:00.000Z',
    },
  });
  assert(expired.payload?.old_price === undefined, 'expired sale');
}

{
  const withG = projectTorobOption({ product: { ...baseProduct, guarantee: '  <b>۷ روز بازگشت</b>  ' } });
  assert(withG.payload?.guarantee === '۷ روز بازگشت', 'sanitize guarantee');
  const emptyG = projectTorobOption({ product: { ...baseProduct, guarantee: '   ' } });
  assert(emptyG.payload?.guarantee === undefined, 'blank guarantee omitted');
}

{
  const selected = projectSelectedPdpOption(
    {
      ...baseProduct,
      defaultRetailVariantId: 'v2',
      variants: [
        { id: 'v1', productId: 'prod-1', retailStock: 5, createdAt: '2026-01-01T00:00:00.000Z' },
        { id: 'v2', productId: 'prod-1', retailStock: 0, createdAt: '2026-01-02T00:00:00.000Z' },
      ],
    },
    'not-mine',
  );
  assert(selected.selectedVariantId === 'v2', 'invalid url falls back to default');
}

{
  const published = enumeratePublishableOptions({
    ...baseProduct,
    variants: [
      { id: 'v1', productId: 'prod-1', retailStock: 1, imageUrl: 'https://cdn.example/a.jpg' },
      { id: 'v2', productId: 'other', retailStock: 1, imageUrl: 'https://cdn.example/b.jpg' },
    ],
  });
  assert(published.filter((row) => row.publishable).length === 1, 'foreign variant skipped');
}

console.log('torob-product-projection.spec ok');
