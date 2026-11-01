import { assertCatalogReadOnly, projectBotCatalog } from './bot-catalog';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const product = {
  id: 'p1',
  sku: 'SKU-1',
  name: 'تست',
  status: 'ACTIVE',
  showOnWholesale: true,
  wholesalePrice: 1000,
  wholesaleStock: 50,
  retailStock: 9,
  stock: 999, // legacy — must not drive wholesale availability
  minOrderQty: 5,
  variants: [
    { id: 'v1', color: 'قرمز', size: 'L', wholesaleStock: 20, stock: 1 },
  ],
};

const q = projectBotCatalog(product, 'WHOLESALE');
assert(!!q, 'projected');
assert(q!.stock === 20, 'uses wholesale variant stock not legacy');
assert(q!.minOrderQty === 5, 'moq');
assert(q!.unitPrice === 1000, 'live wholesale price');

assertCatalogReadOnly(product);

const hidden = projectBotCatalog({ ...product, showOnWholesale: false });
assert(hidden === null, 'hidden wholesale');

console.log('bot-catalog.spec.ts: ok');
