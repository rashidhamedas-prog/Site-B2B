import * as assert from 'node:assert/strict';
import {
  RETAIL_CAMPAIGN_HERO_SLIDES,
  applyRetailCampaignHeroSlidesToBlocks,
  isRetailCampaignHeroAsset,
} from './retail-campaign-hero.util';

const original = [
  {
    id: 'hero-admin-id',
    type: 'hero',
    props: {
      autoplayMs: 9100,
      adminFlag: 'keep-me',
      slides: [
        {
          headline: 'دیجی‌پی قدیمی',
          imageUrl: '/banners/digipay-installment-2026/retail-desktop.webp',
          ctaHref: '/products',
        },
        {
          headline: 'شومیز گلرخ',
          imageUrl: '/banners/hero-product-2026-v2/retail-01.webp',
        },
      ],
    },
  },
  { id: 'text', type: 'text', props: { body: 'بدون تغییر' } },
];

const patched = applyRetailCampaignHeroSlidesToBlocks(original);
assert.equal(patched.changed, true);
const blocks = patched.blocks as typeof original;
assert.equal(blocks[0].props.slides?.[0].imageUrl, RETAIL_CAMPAIGN_HERO_SLIDES[0].imageUrl);
assert.equal(blocks[0].props.slides?.[1].imageUrl, RETAIL_CAMPAIGN_HERO_SLIDES[1].imageUrl);
assert.equal(blocks[0].props.slides?.[2].imageUrl, '/banners/hero-product-2026-v2/retail-01.webp');
assert.equal(blocks[0].props.slides?.[0].ctaHref, '/products');
assert.equal(blocks[0].props.slides?.[1].ctaHref, '/category/women-coats');
assert.equal(blocks[0].props.autoplayMs, 9100);
assert.equal(blocks[0].props.adminFlag, 'keep-me');
assert.strictEqual(blocks[1], original[1]);

const second = applyRetailCampaignHeroSlidesToBlocks(blocks);
assert.equal(second.changed, false);

assert.equal(isRetailCampaignHeroAsset(RETAIL_CAMPAIGN_HERO_SLIDES[0].imageUrl), true);
assert.equal(isRetailCampaignHeroAsset('/banners/hero-product-2026-v2/retail-01.webp'), false);

console.log('retail-campaign-hero.util.spec.ts: ok');
