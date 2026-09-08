import {
  capProductsBlockLimit,
  normalizeProductsBlock,
  parseProductIds,
  productsBlockCatalogParams,
  serializeProductIds,
} from './products-block';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const a = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const b = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const c = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

assert(parseProductIds(`${a}, ${b} ${a}`).join(',') === `${a},${b}`, 'dedupe and split');
assert(parseProductIds('not-a-uuid,coming-soon').length === 0, 'reject non-uuid');
assert(parseProductIds('WINTER-WEAR00009,COATS00006').join(',') === 'WINTER-WEAR00009,COATS00006', 'keep sku');
assert(parseProductIds([{ id: a }, { id: b }]).length === 2, 'object id list');
assert(serializeProductIds([a, 'nope', b]) === `${a},${b}`, 'serialize strips junk');

const auto = normalizeProductsBlock(
  { headline: 'جدیدترین‌ها', limit: 12, sort: 'newest' },
  'RETAIL',
);
assert(auto.source === 'auto', 'empty ids is auto');
assert(auto.sort === 'newest', 'retail newest');
assert(auto.limit === 12, 'retail limit 12');
assert(auto.hideWhenEmpty === false, 'retail shows empty copy');
assert(auto.showPortalCta === false, 'retail has no portal gate');

const inferred = normalizeProductsBlock({ productIds: `${a},${b}`, limit: 99 }, 'WHOLESALE');
assert(inferred.source === 'manual', 'legacy ids become manual');
assert(inferred.limit === 12, 'home cap 12');
assert(inferred.sort === 'discounted', 'wholesale default sort');
assert(inferred.hideWhenEmpty === true, 'wholesale hides empty');
assert(inferred.showPortalCta === true, 'wholesale portal gate default');

const disabled = normalizeProductsBlock({ enabled: false, source: 'auto' }, 'RETAIL');
assert(disabled.enabled === false, 'can hide section');

const params = productsBlockCatalogParams(
  normalizeProductsBlock({ source: 'manual', productIds: `${a},${b},${c}`, limit: 2 }, 'RETAIL'),
);
assert(params.ids?.join(',') === `${a},${b}`, 'manual uses ordered ids sliced to limit');
assert(!params.categoryId, 'manual ignores category');
const emptyManual = productsBlockCatalogParams(
  normalizeProductsBlock({ source: 'manual', productIds: 'invalid' }, 'RETAIL'),
);
assert(Array.isArray(emptyManual.ids) && emptyManual.ids.length === 0, 'empty manual stays curated');

const autoParams = productsBlockCatalogParams(
  normalizeProductsBlock({ source: 'auto', categoryId: a, sort: 'views', limit: 6 }, 'WHOLESALE'),
);
assert(!autoParams.ids, 'auto has no ids');
assert(autoParams.categoryId === a, 'auto keeps category');
assert(autoParams.sort === 'views', 'views sort');

assert(capProductsBlockLimit(0) === 1, 'min 1');
assert(capProductsBlockLimit(200) === 12, 'max 12');

console.log('products-block.spec.ts ok');
