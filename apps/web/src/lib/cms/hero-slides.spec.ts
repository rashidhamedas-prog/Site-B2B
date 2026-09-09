import {
  DIGIPAY_RETAIL_HERO_SLIDE,
  PRIMA_NEGIN_RETAIL_HERO_SLIDE,
  applyRetailCampaignHeroSlides,
  isLightHeroOverlay,
  isRetailCampaignHeroAsset,
  normalizeHeroSlides,
  prependUniqueHeroSlide,
} from './hero-slides';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const parsed = normalizeHeroSlides({ slides: [DIGIPAY_RETAIL_HERO_SLIDE] });
assert(parsed.length === 1, 'digipay slide parses');
assert(parsed[0]?.overlayTone === 'light', 'light overlay tone');
assert(parsed[0]?.presentation === 'artwork', 'artwork presentation');
assert((parsed[0]?.imageAlt || '').length > 20, 'descriptive alt');
assert(parsed[0]?.ctaHref === '/products', 'digipay stays on retail catalog');
assert(!parsed[0]?.headline || parsed[0].imageUrl !== parsed[0].headline, 'text is not the image url');
assert(isLightHeroOverlay(parsed[0]!), 'artwork light still uses light overlay on mobile');
assert(
  parsed[0]?.imageUrl === '/banners/digipay-installment-2026/retail-desktop-ece15c60d7c8.webp',
  'desktop plate path',
);

const coats = normalizeHeroSlides({ slides: [PRIMA_NEGIN_RETAIL_HERO_SLIDE] });
assert(coats[0]?.ctaHref === '/category/women-coats', 'prima/negin stay on retail coats');
assert(coats[0]?.presentation === 'artwork', 'prima/negin artwork');
assert((coats[0]?.imageAlt || '').includes('پریما'), 'alt names the models');
assert(!isLightHeroOverlay(coats[0]!), 'dark artwork is not light');

const product = {
  headline: 'آبیِ آرام برای هر روز شما',
  imageUrl: '/banners/hero-product-2026-v2/retail-01.webp',
  presentation: 'overlay' as const,
};
const prepended = prependUniqueHeroSlide(
  normalizeHeroSlides({ slides: [product] }),
  DIGIPAY_RETAIL_HERO_SLIDE,
);
assert(prepended.length === 2, 'prepends ahead of product slides');
assert(prepended[0]?.imageUrl === DIGIPAY_RETAIL_HERO_SLIDE.imageUrl, 'digipay is first');
assert(
  prependUniqueHeroSlide(prepended, DIGIPAY_RETAIL_HERO_SLIDE).length === 2,
  'idempotent prepend',
);

const replaced = applyRetailCampaignHeroSlides(
  normalizeHeroSlides({
    slides: [
      {
        headline: 'قدیمی',
        imageUrl: '/banners/digipay-installment-2026/retail-desktop.webp',
        presentation: 'overlay',
      },
      product,
    ],
  }),
);
assert(replaced.length === 3, 'campaign pair plus remaining product slide');
assert(replaced[0]?.imageUrl === DIGIPAY_RETAIL_HERO_SLIDE.imageUrl, 'hashed digipay first');
assert(replaced[1]?.imageUrl === PRIMA_NEGIN_RETAIL_HERO_SLIDE.imageUrl, 'prima second');
assert(replaced[2]?.imageUrl === product.imageUrl, 'product kept');
assert(isRetailCampaignHeroAsset(DIGIPAY_RETAIL_HERO_SLIDE.imageUrl), 'digipay asset match');
assert(!isRetailCampaignHeroAsset(product.imageUrl), 'product is not campaign asset');

const dark = normalizeHeroSlides({
  slides: [{ headline: 'x', imageUrl: '/a.webp', presentation: 'overlay' }],
});
assert(dark[0]?.overlayTone === undefined, 'missing tone stays unset');
assert(!isLightHeroOverlay(dark[0]!), 'default overlay is not light');

console.log('hero-slides.spec.ts: OK');
