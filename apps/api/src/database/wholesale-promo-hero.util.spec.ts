import * as assert from 'node:assert/strict';
import {
  WHOLESALE_PROMO_HERO_SLIDES,
  applyWholesalePromoHeroSlidesToBlocks,
} from './wholesale-promo-hero.util';

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
          imageUrl: '/banners/hero-product-2026-v2/wholesale-01.webp',
          ctaHref: '/custom-admin-target',
        },
      ],
    },
  },
  { id: 'text', type: 'text', props: { body: 'بدون تغییر' } },
];

const patched = applyWholesalePromoHeroSlidesToBlocks(original);
assert.equal(patched.changed, true);
const blocks = patched.blocks as typeof original;
assert.equal(blocks[0].props.slides?.[0].imageUrl, WHOLESALE_PROMO_HERO_SLIDES[0].imageUrl);
assert.equal(blocks[0].props.slides?.[1].imageUrl, WHOLESALE_PROMO_HERO_SLIDES[1].imageUrl);
assert.equal(blocks[0].props.slides?.[2].headline, 'متن ویرایش‌شده ادمین');
assert.equal(blocks[0].props.slides?.[2].ctaHref, '/custom-admin-target');
assert.equal(blocks[0].props.autoplayMs, 9100);
assert.equal(blocks[0].props.adminFlag, 'keep-me');
assert.strictEqual(blocks[1], original[1]);
assert.equal(WHOLESALE_PROMO_HERO_SLIDES[0].ctaHref, '/portal/register');
assert.equal(WHOLESALE_PROMO_HERO_SLIDES[1].ctaHref, '/category/women-coats');

const again = applyWholesalePromoHeroSlidesToBlocks(blocks);
assert.equal(again.changed, false);

const retail = applyWholesalePromoHeroSlidesToBlocks([
  { type: 'hero', props: { slides: [{ headline: 'تکی', imageUrl: '/retail.webp' }] } },
]);
assert.equal(retail.changed, true);
assert.equal(
  ((retail.blocks as Array<{ props: { slides: Array<{ imageUrl: string }> } }>)[0].props.slides[0]
    .imageUrl),
  WHOLESALE_PROMO_HERO_SLIDES[0].imageUrl,
);

console.log('wholesale-promo-hero.util.spec.ts: ok');
