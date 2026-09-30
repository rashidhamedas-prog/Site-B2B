import { normalizeCatalogProduct } from './normalize-catalog-product';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const slim = normalizeCatalogProduct({
  id: 'p1',
  slug: 'jacquard-jacket-pardis',
  sku: 'COATS00013',
  name: 'کت ژاکارد مدل پردیس',
  fabric: 'ژاکارد',
  wholesalePrice: 1_000_000,
  status: 'ACTIVE',
  wholesaleStock: 12,
  images: ['https://cdn.example/a.jpg'],
  sizeType: 'TWO',
  minOrderQty: 1,
  orderBadgeLabel: 'حداقل سفارش 6 عدد',
  allowWholesaleColorSelect: true,
  minWholesaleColors: 2,
  variants: [{ id: 'v1', color: 'مشکی', colorHex: '#111', wholesaleStock: 6, size: '1' }],
});

assert(slim.orderBadgeLabel === 'حداقل سفارش 6 عدد', 'custom badge survives normalize');
assert(slim.minOrderQty === 1, 'minOrderQty preserved');
assert(slim.allowWholesaleColorSelect === true, 'color select preserved');
assert(slim.minWholesaleColors === 2, 'min colors preserved');
assert(slim.variants[0]?.wholesaleStock === 6, 'variant stock preserved');

assert(
  normalizeCatalogProduct({
    id: 'p2',
    name: 'x',
    sku: 'x',
    slug: 'x',
    fabric: '',
    wholesalePrice: 0,
    status: 'ACTIVE',
    images: [],
    variants: [],
    orderBadgeLabel: null,
  }).orderBadgeLabel === null,
  'explicit null stays null (fallback to pack wording)',
);

assert(
  normalizeCatalogProduct({
    id: 'p3',
    name: 'x',
    sku: 'x',
    slug: 'x',
    fabric: '',
    wholesalePrice: 0,
    status: 'ACTIVE',
    images: [],
    variants: [],
  }).orderBadgeLabel === undefined,
  'missing field stays undefined',
);

console.log('normalize-catalog-product.spec.ts ok');
