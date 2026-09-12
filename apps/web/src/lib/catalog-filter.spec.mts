import {
  catalogActiveFilterCount,
  catalogColorHex,
  catalogFilterChips,
  catalogSizeLabel,
  isLightCatalogSwatch,
  mergeCatalogColors,
  mergeCatalogFabrics,
  toggleCatalogValue,
} from './catalog-filter.ts';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(catalogColorHex('مشکی') === '#111111', 'known color hex');
assert(catalogColorHex('رنگ‌ناموجود', '#abc') === '#abc', 'fallback hex');
assert(catalogColorHex('رنگ‌ناموجود') === '#D6D3D1', 'neutral fallback');
assert(isLightCatalogSwatch('#FFFFFF') === true, 'white is light');
assert(isLightCatalogSwatch('#111111') === false, 'black is dark');
assert(catalogSizeLabel('FREE') === 'فری‌سایز', 'free size label');
assert(catalogSizeLabel('38') === '38', 'garment size passthrough');

assert(catalogActiveFilterCount({}) === 0, 'empty count');
assert(
  catalogActiveFilterCount({ fabric: 'لینن', color: 'مشکی', inStock: '1' }) === 3,
  'three chips',
);

const chips = catalogFilterChips(
  { fabric: 'کتان', size: 'TWO', collectionId: 'c1', inStock: 'true' },
  'بهار',
);
assert(chips[0]?.label === 'فقط موجود', 'stock chip first');
assert(chips.some((c) => c.label === 'سایز: دو سایز'), 'size chip');
assert(chips.some((c) => c.label === 'کالکشن: بهار'), 'collection name');

assert(toggleCatalogValue('لینن', 'لینن') === '', 'toggle off');
assert(toggleCatalogValue('لینن', 'کتان') === 'کتان', 'toggle other');

const fabrics = mergeCatalogFabrics(['لینن', 'ابریشم']);
assert(fabrics[0] === 'لینن', 'known fabric first');
assert(fabrics.includes('ابریشم'), 'extra fabric appended');

const colors = mergeCatalogColors(['مشکی', 'یشمی']);
assert(colors[0]?.name === 'سفید', 'palette order kept');
assert(colors.some((c) => c.name === 'یشمی'), 'unknown color appended');

console.log('catalog-filter.spec.mts: ok');
