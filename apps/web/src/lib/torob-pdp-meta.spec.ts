import { resolveRetailPdpOption, torobHeadMeta } from './torob-pdp-meta';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const product = {
  id: 'p1',
  name: 'مانتو',
  retailPrice: 1_000_000,
  sale: { payable: 800_000, active: true, original: 1_000_000 },
  guarantee: '۷ روز بازگشت',
  defaultRetailVariantId: 'v2',
  variants: [
    { id: 'v1', color: 'مشکی', size: 'فری', retailStock: 2, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'v2', color: 'کرم', size: 'فری', retailStock: 0, createdAt: '2026-01-02T00:00:00.000Z' },
  ],
  images: ['https://cdn.example/a.jpg'],
};

const selected = resolveRetailPdpOption(product, 'not-real');
assert(selected.selected?.id === 'v2', 'default after invalid query');
assert(selected.productPriceToman === 80_000, 'toman once');
assert(selected.availability === 'outofstock', 'retail stock');
assert(selected.guarantee === '۷ روز بازگشت', 'guarantee');

const meta = torobHeadMeta(selected);
assert(meta.product_price === '80000', 'meta price');
assert(meta.availability === 'outofstock', 'meta availability');
assert(meta.product_id === 'v2', 'meta id');
assert(meta.guarantee === '۷ روز بازگشت', 'meta guarantee');
assert(meta.product_name === 'مانتو', 'meta name');

const none = resolveRetailPdpOption({ ...product, guarantee: '' }, 'v1');
assert(none.selected?.id === 'v1', 'requested variant');
assert(torobHeadMeta(none).guarantee === undefined, 'omit empty guarantee');

const noVariant = resolveRetailPdpOption({
  id: 'p0',
  name: 'شال',
  retailPrice: 400_000,
  retailStock: 6,
  variants: [],
  images: ['https://cdn.example/shawl.jpg'],
});
assert(noVariant.selected === null, 'no variant selected');
assert(noVariant.availability === 'instock', 'product-level retailStock matches API');
assert(noVariant.productId === 'product:p0', 'product namespace unique');

console.log('torob-pdp-meta.spec ok');
