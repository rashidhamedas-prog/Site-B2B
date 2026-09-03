/**
 * npx ts-node --transpile-only src/modules/basalam/basalam-catalog.spec.ts
 */
import {
  BASALAM_STATUS_UNPUBLISHED,
  absMediaUrl,
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
} from './basalam-catalog';

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
assert(payload.primary_price === 890_000, 'IRR → Toman');
assert(payload.stock === 4, 'retail stock');
assert(payload.photo === 1 && Array.isArray(payload.photos) && (payload.photos as number[])[0] === 2, 'photo split');
assert(String(payload.description).includes('پارچه') && !String(payload.description).includes('<p>'), 'strip html');
assert(!JSON.stringify(payload).includes('wholesalePrice'), 'no wholesale price');

assert(stripHtml('<b>سلام</b> دنیا') === 'سلام دنیا', 'stripHtml');
assert(absMediaUrl('a.jpg', 'https://www.poshaktaranom.ir') === 'https://www.poshaktaranom.ir/media/a.jpg', 'media path');
assert(pickPhotoUrls(['https://cdn.example/x.jpg', '/rel.jpg'], 'https://www.poshaktaranom.ir').length === 2, 'photos');
assert(pickCategoryId(stall) === 390, 'category from stall');
assert(pickClothingCategoryId(flattenCategories({ data: [{ id: 1, title: 'پوشاک زنانه' }] })) === 1, 'clothing category');
assert(createdProductId({ data: { id: 24018670 } }) === 24018670, 'created id');

console.log('basalam-catalog.spec.ts: ok');
