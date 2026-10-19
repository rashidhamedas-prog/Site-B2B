import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  categoryDisplayName,
  categoryStorefrontHref,
  HOME_CATEGORY_GRID_CAP,
  insertCategoryBlockAfterHero,
  merchandiseCategories,
  resolveHomeCategoryMaxItems,
  WHOLESALE_CATEGORY_INDEX_CAP,
} from './category-storefront.ts';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const a = { id: 'a', name: 'شومیز', nameEn: 'blouses' };
const b = { id: 'b', name: 'Autumn پاییزی', nameEn: '' };
const c = { id: 'c', name: 'کت', nameEn: 'coats' };
const newestFirst = [b, c, a];

assert(categoryDisplayName(a) === 'شومیز', 'name is the label, not nameEn');
assert(categoryDisplayName(b) === 'Autumn پاییزی', 'mixed leftover name is shown as saved');
assert(categoryDisplayName({ id: 'x', name: '  ', nameEn: 'coats' }) === 'coats', 'fallback nameEn');

assert(resolveHomeCategoryMaxItems(undefined) === HOME_CATEGORY_GRID_CAP, 'default cap');
assert(resolveHomeCategoryMaxItems(10) === 10, 'honor editorial 10');
assert(resolveHomeCategoryMaxItems(99) === HOME_CATEGORY_GRID_CAP, '99 collapses to cap');
assert(resolveHomeCategoryMaxItems(0) === 1, 'floor 1');

const auto = merchandiseCategories(newestFirst, { categoryIds: '', maxItems: 10 });
assert(auto[0]?.id === 'b', 'auto keeps newest first — پاییزی is not reversed off the list');
assert(auto.length === 3, '3 items all fit under cap 10');
assert(
  merchandiseCategories(newestFirst, { maxItems: 2 }).map((x) => x.id).join(',') === 'b,c',
  'slice drops oldest, not the new category',
);

const pinned = merchandiseCategories(newestFirst, {
  categoryIds: 'a,c',
  maxItems: 16,
});
assert(pinned.map((x) => x.id).join(',') === 'a,c,b', 'pins first then remaining API order');

const homeMix = [
  { id: 'a', name: 'شومیز', showOnHome: true },
  { id: 'b', name: 'Autumn', showOnHome: false },
  { id: 'c', name: 'کت', showOnHome: undefined },
];
assert(
  merchandiseCategories(homeMix, { homeOnly: true, maxItems: 16 })
    .map((x) => x.id)
    .join(',') === 'a,c',
  'homeOnly drops showOnHome=false and keeps undefined as visible',
);
assert(
  merchandiseCategories(homeMix, { maxItems: 16 }).map((x) => x.id).join(',') === 'a,b,c',
  'nav/path without homeOnly must keep every ACTIVE category',
);
assert(
  merchandiseCategories(homeMix, { homeOnly: true, categoryIds: 'b,a', maxItems: 16 })
    .map((x) => x.id)
    .join(',') === 'a,c',
  'CMS pin cannot force a home-hidden category onto the home grid',
);

const gridSrc = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../components/retail/RetailCategoryBannerGrid.tsx'),
  'utf8',
);
assert(gridSrc.includes('homeOnly: true'), 'luxury home grid filters showOnHome');
const boutiqueSrc = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../themes/retail-boutique/BoutiqueCategoryRow.tsx'),
  'utf8',
);
assert(boutiqueSrc.includes('homeOnly: true'), 'boutique home row filters showOnHome');
const layoutSrc = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../app/retail/layout.tsx'),
  'utf8',
);
assert(!layoutSrc.includes('homeOnly'), 'mega-nav must not use homeOnly');

const renderer = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../components/cms/RetailBlocksRenderer.tsx'),
  'utf8',
);
assert(!renderer.includes('RetailHomeCategoryLinks'), 'home must not inject a duplicate pill cloud');

assert(categoryStorefrontHref({ id: '1', slug: 'shomiz' }) === '/category/shomiz', 'slug href');
assert(
  categoryStorefrontHref({ id: 'abc', slug: ' ' }) === '/products?categoryId=abc',
  'blank slug falls back to id',
);

const seventeen = Array.from({ length: 17 }, (_, i) => ({
  id: `c${i}`,
  name: i === 16 ? 'شومیز' : `cat-${i}`,
  showOnHome: i > 9 ? false : true,
}));
assert(
  merchandiseCategories(seventeen, { maxItems: 16 }).length === 16,
  'retail image cap still drops the 17th',
);
const wholesaleIndex = merchandiseCategories(seventeen, {
  maxItems: WHOLESALE_CATEGORY_INDEX_CAP,
  capCeiling: WHOLESALE_CATEGORY_INDEX_CAP,
});
assert(wholesaleIndex.length === 17, 'wholesale index keeps all 17 active categories');
assert(wholesaleIndex[16]?.name === 'شومیز', 'شومیز stays visible when it sorts last');
assert(
  merchandiseCategories(seventeen, {
    homeOnly: true,
    maxItems: 16,
  }).every((row) => row.showOnHome !== false),
  'retail homeOnly still hides unchecked tiles',
);

const savedHome = [
  { id: 'hero', type: 'hero' },
  { id: 'stats', type: 'stats' },
  { id: 'products', type: 'products' },
];
const inserted = { id: 'wholesale-home-categories', type: 'categoryBanners' };
const withCats = insertCategoryBlockAfterHero(savedHome, inserted);
assert(withCats[1]?.type === 'categoryBanners', 'missing wholesale home block is inserted after the hero');
assert(insertCategoryBlockAfterHero(withCats, inserted).length === withCats.length, 'existing category block is not duplicated');

const wholesaleRenderer = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../components/cms/WholesaleBlocksRenderer.tsx'),
  'utf8',
);
assert(wholesaleRenderer.includes('WholesaleCategoryIndex'), 'wholesale renderer mounts the category index');
assert(!wholesaleRenderer.includes('Retail-only block'), 'wholesale no longer drops category banners');
const wholesaleIndexSrc = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../components/wholesale/WholesaleCategoryIndex.tsx'),
  'utf8',
);
assert(
  wholesaleIndexSrc.includes('homeOnly: true'),
  'wholesale home CMS index filters showOnHome like retail',
);
assert(
  /toWholesaleCategoryTiles\([\s\S]*homeOnly:\s*opts\?\.homeOnly/.test(wholesaleIndexSrc) ||
    wholesaleIndexSrc.includes('homeOnly: opts?.homeOnly'),
  'products/nav tiles can still pass homeOnly false/omit',
);
const wholesaleLayout = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../app/(wholesale)/layout.tsx'),
  'utf8',
);
assert(wholesaleLayout.includes('WholesaleCategoryNavSlot'), 'wholesale nav streams categories without blocking the header');
assert(wholesaleLayout.includes('<Suspense'), 'category nav is outside the header fetch');
assert(!wholesaleLayout.includes('homeOnly'), 'wholesale nav must list categories hidden from the retail home grid');
const navSrc = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../components/wholesale/WholesaleCategoryNav.tsx'),
  'utf8',
);
assert(navSrc.includes('capCeiling: WHOLESALE_CATEGORY_INDEX_CAP'), 'nav uses the wholesale index cap');
assert(!navSrc.includes('homeOnly'), 'nav keeps categories hidden on the retail home grid');
const fetchSrc = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../cms/fetch.ts'),
  'utf8',
);
assert(fetchSrc.includes('ensureWholesaleHomeCategoryBlock'), 'saved wholesale home still receives the category block');

console.log('category-storefront.spec.mts: OK');
