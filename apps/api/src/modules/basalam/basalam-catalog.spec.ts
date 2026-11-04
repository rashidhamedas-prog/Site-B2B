/**
 * npx ts-node --transpile-only src/modules/basalam/basalam-catalog.spec.ts
 */
import {
  BASALAM_STATUS_UNPUBLISHED,
  absMediaUrl,
  basalamRetailPriceRial,
  buildCreatePayload,
  coreTitle,
  createdProductId,
  extractStyleCodes,
  flattenCategories,
  matchStallProduct,
  parseStallList,
  pickCategoryId,
  pickClothingCategoryId,
  pickPhotoUrls,
  stripHtml,
  toBasalamPriceRial,
} from './basalam-catalog';
import { tomanToRial } from '../customer/customer-wallet';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(extractStyleCodes('کت اسپرت مدل اریکا کد ۷۱۱۷').includes('7117'), 'persian digits');
assert(coreTitle('کت اسپرت لینن مدل اریکا') === coreTitle('کت اسپرت مدل اریکا کد 7117'), 'core title strips fabric/code');

const stall = parseStallList({
  data: [
    { id: 11, title: 'کت اسپرت مدل اریکا کد 7117', sku: '', category: { id: 390 } },
    { id: 12, title: 'شومیز دیگر', sku: 'BLOUSE0001', category: { id: 390 } },
  ],
});
assert(stall.length === 2 && stall[0].categoryId === 390, 'parse stall');

const mapped = matchStallProduct(
  { id: 'local-erika', sku: 'COATS00015', name: 'کت اسپرت لینن مدل اریکا' },
  stall,
  {},
);
assert(mapped === 11, 'match by style-code/title');

assert(
  matchStallProduct({ id: 'x', sku: 'BLOUSE0001', name: 'شومیز' }, stall, {}) === 12,
  'match by sku',
);
assert(
  matchStallProduct({ id: 'already', sku: 'COATS00015', name: 'کت' }, stall, { already: 99 }) === 99,
  'existing map wins',
);

const payload = buildCreatePayload({
  name: 'کت اریکا',
  sku: 'COATS00015',
  description: '<p>پارچه لینن</p>',
  priceIrr: 8_900_000,
  stock: 4,
  photoIds: [1, 2],
  categoryId: 390,
});
assert(payload.is_wholesale === false, 'retail stall only');
assert(payload.status === BASALAM_STATUS_UNPUBLISHED, 'unpublished draft');
assert(payload.primary_price === 8_900_000, 'IRR sent as-is (Rial)');
assert(payload.stock === 4, 'retail stock');
assert(payload.photo === 1 && Array.isArray(payload.photos) && (payload.photos as number[])[0] === 2, 'photo split');
assert(String(payload.description).includes('پارچه') && !String(payload.description).includes('<p>'), 'strip html');
assert(!JSON.stringify(payload).includes('wholesalePrice'), 'no wholesale price');

function throws(fn: () => unknown): boolean {
  try {
    fn();
    return false;
  } catch {
    return true;
  }
}

assert(toBasalamPriceRial(8_900_000) === 8_900_000, 'rial passthrough');
assert(toBasalamPriceRial(tomanToRial(890_000)) === 8_900_000, 'toman → rial helper');
assert(toBasalamPriceRial(1_234_567.6) === 1_234_568, 'rounds to integer');
assert(toBasalamPriceRial('2500000') === 2_500_000, 'numeric string');
assert(throws(() => toBasalamPriceRial(0)), 'zero rejected');
assert(throws(() => toBasalamPriceRial(-10)), 'negative rejected');
assert(throws(() => toBasalamPriceRial(Number.NaN)), 'NaN rejected');
assert(throws(() => toBasalamPriceRial(null)), 'null rejected');
assert(
  throws(() => buildCreatePayload({ name: 'x', priceIrr: 0, stock: 1, photoIds: [1], categoryId: 1 })),
  'payload refuses zero price',
);

const now = new Date('2026-11-04T10:00:00Z');
assert(
  basalamRetailPriceRial(
    {
      wholesalePrice: 5_000_000,
      retailPrice: 7_000_000,
      retailCompareAtPrice: 9_000_000,
      retailIsDiscounted: true,
      retailDiscountStartsAt: '2026-11-01T00:00:00Z',
      retailDiscountEndsAt: '2026-11-30T00:00:00Z',
    },
    now,
  ) === 7_000_000,
  'active sale sends payable, not list price',
);
assert(
  basalamRetailPriceRial(
    {
      wholesalePrice: 5_000_000,
      retailPrice: 7_000_000,
      retailCompareAtPrice: 9_000_000,
      retailIsDiscounted: true,
      retailDiscountStartsAt: '2026-10-01T00:00:00Z',
      retailDiscountEndsAt: '2026-10-15T00:00:00Z',
    },
    now,
  ) === 9_000_000,
  'expired sale window falls back to original payable',
);
assert(
  basalamRetailPriceRial({ wholesalePrice: 5_000_000, retailPrice: 6_500_000 }, now) === 6_500_000,
  'no sale: retail price',
);

assert(stripHtml('<b>سلام</b> دنیا') === 'سلام دنیا', 'stripHtml');
assert(absMediaUrl('a.jpg', 'https://www.poshaktaranom.ir') === 'https://www.poshaktaranom.ir/media/a.jpg', 'media path');
assert(pickPhotoUrls(['https://cdn.example/x.jpg', '/rel.jpg'], 'https://www.poshaktaranom.ir').length === 2, 'photos');
assert(pickCategoryId(stall) === 390, 'category from stall');
assert(pickClothingCategoryId(flattenCategories({ data: [{ id: 1, title: 'پوشاک زنانه' }] })) === 1, 'clothing category');
assert(createdProductId({ data: { id: 24018670 } }) === 24018670, 'created id');

console.log('basalam-catalog.spec.ts: ok');
