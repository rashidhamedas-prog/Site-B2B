import {
  factualFacts,
  humanStockBand,
  isFactualCaption,
  isPartnerCatalogProduct,
  isPublishableRetailProduct,
  parseAdminCatalogQuery,
  parsePartnerCatalogQuery,
  partnerCopyText,
  preparePartnerCatalog,
  shortPartnerBlurb,
  stockBand,
} from './sales-partner-catalog-policy';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(stockBand(0) === 'out_of_stock', 'zero stock');
assert(stockBand(2) === 'low', 'low stock');
assert(stockBand(8) === 'in_stock', 'in stock');
assert(humanStockBand('out_of_stock') === 'فعلاً ناموجود', 'human out');
assert(isFactualCaption('مانتو کرپ با یقه ایستاده') === true, 'factual ok');
assert(isFactualCaption('پرفروش‌ترین مانتو بازار') === false, 'claim blocked');
assert(shortPartnerBlurb('بهترین پارچه سال') === null, 'blurb strips claims');
assert(shortPartnerBlurb('پارچه کرپ سبک') === 'پارچه کرپ سبک', 'blurb keeps facts');

const facts = factualFacts({ fabricType: 'کرپ', sizeType: 'FREE' });
assert(facts.includes('جنس: کرپ') && facts.includes('سایز: فری‌سایز'), 'facts');

const copy = partnerCopyText({
  name: 'مانتو سارا',
  facts,
  priceTomanLabel: '۱٬۲۰۰٬۰۰۰ تومان',
  productUrl: 'https://poshaktaranom.ir/products/sara',
});
assert(copy.includes('مانتو سارا'), 'copy name');
assert(copy.includes('هنگام ثبت سفارش از سرور'), 'copy not price source');
assert(!copy.includes('پرفروش'), 'copy no claim');

const parsed = parsePartnerCatalogQuery({
  q: '%مانتو_',
  categoryId: 'not-a-uuid',
  stock: 'available',
  sort: 'commission',
  page: 0,
});
assert(parsed.q === 'مانتو', 'query strips wildcards');
assert(parsed.categoryId === '', 'category id must be uuid');
assert(parsed.stock === 'available' && parsed.sort === 'commission', 'enums kept');
assert(parsed.page === 1, 'page floor');

const adminParsed = parseAdminCatalogQuery({ eligible: 'yes', categoryId: '11111111-1111-4111-8111-111111111111' });
assert(adminParsed.eligible === 'yes', 'admin eligible');
assert(adminParsed.categoryId.startsWith('11111111'), 'admin category uuid');

const catA = '11111111-1111-4111-8111-111111111111';
const catB = '22222222-2222-4222-8222-222222222222';
const cards = [
  { name: 'مانتو نیکی', categoryId: catA, categoryName: 'مانتو', priceIrr: 2000, stockBand: 'out_of_stock' as const, estimatedCommissionIrr: 200 },
  { name: 'مانتو لینن', categoryId: catA, categoryName: 'مانتو', priceIrr: 1000, stockBand: 'in_stock' as const, estimatedCommissionIrr: 100 },
  { name: 'کت کتان', categoryId: catB, categoryName: 'کت', priceIrr: 3000, stockBand: 'low' as const, estimatedCommissionIrr: 300 },
];
const grouped = preparePartnerCatalog(cards, { sort: 'category' });
assert(grouped.total === 2, 'out of stock is hidden by default');
assert(!grouped.items.some((row) => row.name === 'مانتو نیکی'), 'zero stock card is absent');
assert(grouped.items[0].categoryName === 'کت', 'category sort fa order');
assert(grouped.facets.categories.length === 2, 'two categories');
assert(grouped.facets.categories.find((row) => row.id === catA)?.count === 1, 'manteau count is in-stock only');

const filtered = preparePartnerCatalog(cards, { categoryId: catA, stock: 'available' });
assert(filtered.total === 1 && filtered.items[0].name === 'مانتو لینن', 'category plus available');
assert(filtered.facets.categories.find((row) => row.id === catA)?.count === 1, 'category count respects stock and ignores the selected category');
assert(filtered.facets.categories.some((row) => row.id === catB), 'other categories stay visible');
assert(filtered.facets.stock.out === 1, 'stock count keeps the selected category');
const named = preparePartnerCatalog(cards, { q: 'نیکی' });
assert(named.total === 0, 'name search does not reveal an out-of-stock product');
const namedLive = preparePartnerCatalog(cards, { q: 'لینن' });
assert(namedLive.total === 1 && namedLive.items[0].name === 'مانتو لینن', 'name search keeps in-stock');

const priced = preparePartnerCatalog(cards, { sort: 'price_desc' });
assert(priced.items[0].name === 'کت کتان', 'price desc');

const live = { status: 'ACTIVE', showOnRetail: true, retailPrice: 1_720_000, deletedAt: null };
assert(isPublishableRetailProduct(live), 'priced retail product is live');
assert(!isPublishableRetailProduct({ ...live, retailPrice: 0 }), 'zero price is not live');
assert(!isPublishableRetailProduct({ ...live, retailPrice: null }), 'missing price is not live');
assert(!isPublishableRetailProduct({ ...live, status: 'DRAFT' }), 'draft is not live');
assert(!isPublishableRetailProduct({ ...live, showOnRetail: false }), 'hidden retail is not live');
assert(!isPublishableRetailProduct({ ...live, deletedAt: '2026-10-05' }), 'deleted is not live');
assert(isPartnerCatalogProduct({ product: live, explicitEligible: null }), 'missing row is included');
assert(isPartnerCatalogProduct({ product: live, explicitEligible: true }), 'explicit include stays');
assert(!isPartnerCatalogProduct({ product: live, explicitEligible: false }), 'admin exclusion wins');
assert(!isPartnerCatalogProduct({ product: { ...live, retailPrice: null }, explicitEligible: true }), 'unpriced stays out even if flagged');

console.log('sales-partner-catalog-policy.spec.ts: OK');
