import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  categoryDisplayName,
  HOME_CATEGORY_GRID_CAP,
  merchandiseCategories,
  resolveHomeCategoryMaxItems,
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

console.log('category-storefront.spec.mts: OK');
