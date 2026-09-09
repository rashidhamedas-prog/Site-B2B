import {
  WHOLESALE_PROMO_HERO_SLIDES,
  WHOLESALE_PROMO_JACKETS_SLIDE,
  WHOLESALE_PROMO_PARTNERSHIP_SLIDE,
  applyWholesalePromoHeroSlides,
  isWholesalePromoHeroAsset,
} from './wholesale-promo-slides';
import { normalizeHeroSlides } from './hero-slides';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const parsed = normalizeHeroSlides({ slides: WHOLESALE_PROMO_HERO_SLIDES });
assert(parsed.length === 2, 'two promo slides parse');
assert(parsed[0]?.presentation === 'artwork', 'partnership is artwork');
assert(parsed[1]?.presentation === 'artwork', 'jackets is artwork');
assert(parsed[0]?.ctaHref === '/portal/register', 'partnership stays on wholesale register');
assert(parsed[1]?.ctaHref === '/category/women-coats', 'jackets stay on wholesale category');
assert(!(parsed[0]?.ctaHref || '').includes('.ir'), 'no retail host on partnership CTA');
assert(!(parsed[1]?.ctaHref || '').includes('.ir'), 'no retail host on jackets CTA');
assert((parsed[0]?.imageAlt || '').length > 20, 'partnership alt is descriptive');
assert((parsed[1]?.imageAlt || '').length > 20, 'jackets alt is descriptive');
assert(parsed[0]?.headline.includes('بوتیکت'), 'headline matches banner offer');
assert(parsed[1]?.headline.includes('کت'), 'jackets headline matches banner offer');

const product = {
  headline: 'مدل‌های واقعی برای ویترین شما',
  imageUrl: '/banners/hero-product-2026-v2/wholesale-01.webp',
  presentation: 'overlay' as const,
};
const applied = applyWholesalePromoHeroSlides(normalizeHeroSlides({ slides: [product] }));
assert(applied.length === 3, 'prepends ahead of product slides');
assert(applied[0]?.imageUrl === WHOLESALE_PROMO_PARTNERSHIP_SLIDE.imageUrl, 'partnership is first');
assert(applied[1]?.imageUrl === WHOLESALE_PROMO_JACKETS_SLIDE.imageUrl, 'jackets is second');
assert(
  applyWholesalePromoHeroSlides(applied).length === 3,
  'idempotent apply does not duplicate',
);
assert(isWholesalePromoHeroAsset(WHOLESALE_PROMO_PARTNERSHIP_SLIDE.imageUrl), 'asset match');

console.log('wholesale-promo-slides.spec.ts: OK');
