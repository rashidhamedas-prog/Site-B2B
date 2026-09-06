import * as assert from 'node:assert/strict';
import {
  WHOLESALE_HERO_ASSET_URLS,
  applyWholesaleHeroAssetChanges,
  planWholesaleHeroAssetSwaps,
  swapWholesaleHeroAssetUrls,
} from '../wholesale-hero-cache-bust.util';

const forward = {
  fromImageUrl: WHOLESALE_HERO_ASSET_URLS.oldImageUrl,
  toImageUrl: WHOLESALE_HERO_ASSET_URLS.newImageUrl,
  fromMobileImageUrl: WHOLESALE_HERO_ASSET_URLS.oldMobileImageUrl,
  toMobileImageUrl: WHOLESALE_HERO_ASSET_URLS.newMobileImageUrl,
};

const original = [
  {
    id: 'hero-admin-id',
    type: 'hero',
    props: {
      autoplayMs: 9100,
      adminFlag: 'keep-me',
      slides: [
        {
          headline: 'متن ویرایش‌شده ادمین',
          imageUrl: WHOLESALE_HERO_ASSET_URLS.oldImageUrl,
          mobileImageUrl: WHOLESALE_HERO_ASSET_URLS.oldMobileImageUrl,
          ctaHref: '/custom-admin-target',
        },
        {
          headline: 'اسلاید دوم',
          imageUrl: '/banners/hero-product-2026-v2/wholesale-02.webp',
          mobileImageUrl: WHOLESALE_HERO_ASSET_URLS.newMobileImageUrl,
        },
      ],
    },
  },
  { id: 'text', type: 'text', props: { body: 'بدون تغییر' } },
];

const patched = swapWholesaleHeroAssetUrls(original, forward);
assert.equal(patched.changed, true);
const blocks = patched.blocks as typeof original;
assert.equal(blocks[0].props.slides?.[0].imageUrl, WHOLESALE_HERO_ASSET_URLS.newImageUrl);
assert.equal(
  blocks[0].props.slides?.[0].mobileImageUrl,
  WHOLESALE_HERO_ASSET_URLS.newMobileImageUrl
);
assert.equal(blocks[0].props.slides?.[0].headline, 'متن ویرایش‌شده ادمین');
assert.equal(blocks[0].props.slides?.[0].ctaHref, '/custom-admin-target');
assert.equal(blocks[0].props.autoplayMs, 9100);
assert.equal(blocks[0].props.adminFlag, 'keep-me');
assert.strictEqual(blocks[1], original[1]);
assert.equal(
  blocks[0].props.slides?.[1].imageUrl,
  '/banners/hero-product-2026-v2/wholesale-02.webp'
);

// A later admin text edit must survive migration rollback; only the
// recorded field changes are reversed. A pre-existing hashed mobile URL
// on another slide stays hashed.
blocks[0].props.slides![0].headline = 'ویرایش پس از مهاجرت';
const planned = planWholesaleHeroAssetSwaps(original, forward);
assert.equal(planned.length, 2);
assert.equal(planned.every((change) => change.slideIndex === 0), true);
const rolledBack = applyWholesaleHeroAssetChanges(blocks, planned, 'reverse');
const restored = rolledBack.blocks as typeof original;
assert.equal(restored[0].props.slides?.[0].headline, 'ویرایش پس از مهاجرت');
assert.equal(restored[0].props.slides?.[0].imageUrl, WHOLESALE_HERO_ASSET_URLS.oldImageUrl);
assert.equal(
  restored[0].props.slides?.[1].mobileImageUrl,
  WHOLESALE_HERO_ASSET_URLS.newMobileImageUrl
);

const noMatch = swapWholesaleHeroAssetUrls([{ type: 'hero', props: { slides: [] } }], forward);
assert.equal(noMatch.changed, false);

console.log('20260906-004-wholesale-hero-cache-bust.spec.ts: ok');
