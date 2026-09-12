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

console.log('category-storefront.spec.mts: OK');
