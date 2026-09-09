import {
  DIGIPAY_RETAIL_HERO_SLIDE,
  isLightHeroOverlay,
  normalizeHeroSlides,
  prependUniqueHeroSlide,
} from './hero-slides';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const parsed = normalizeHeroSlides({ slides: [DIGIPAY_RETAIL_HERO_SLIDE] });
assert(parsed.length === 1, 'digipay slide parses');
assert(parsed[0]?.overlayTone === 'light', 'light overlay tone');
assert(parsed[0]?.presentation === 'overlay', 'overlay presentation');
assert((parsed[0]?.imageAlt || '').length > 20, 'descriptive alt');
assert(!parsed[0]?.headline || parsed[0].imageUrl !== parsed[0].headline, 'text is not the image url');
assert(isLightHeroOverlay(parsed[0]!), 'isLightHeroOverlay');
assert(
  parsed[0]?.imageUrl === '/banners/digipay-installment-2026/retail-desktop.webp',
  'desktop plate path',
);

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

const dark = normalizeHeroSlides({
  slides: [{ headline: 'x', imageUrl: '/a.webp', presentation: 'overlay' }],
});
assert(dark[0]?.overlayTone === undefined, 'missing tone stays unset');
assert(!isLightHeroOverlay(dark[0]!), 'default overlay is not light');

console.log('hero-slides.spec.ts: OK');
