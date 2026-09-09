import type { HeroSlide } from './hero-slides';

export const WHOLESALE_PROMO_PARTNERSHIP_IMAGE =
  '/banners/wholesale-promo-2026/partnership-d8771aca17fe.webp';
export const WHOLESALE_PROMO_PARTNERSHIP_IMAGE_MOBILE =
  '/banners/wholesale-promo-2026/partnership-mobile-ecf1c65e857b.webp';
export const WHOLESALE_PROMO_JACKETS_IMAGE =
  '/banners/wholesale-promo-2026/jackets-19fc4bd8d65a.webp';
export const WHOLESALE_PROMO_JACKETS_IMAGE_MOBILE =
  '/banners/wholesale-promo-2026/jackets-mobile-b38e5ccce891.webp';

export const WHOLESALE_PROMO_PARTNERSHIP_SLIDE: HeroSlide = {
  brandEyebrow: 'پوشاک ترنم',
  headline: 'برای بوتیکت، از ترنم شروع کن',
  headlineAccent: 'از ترنم شروع کن',
  body: 'درخواست همکاری بده؛ پس از تأیید، قیمت عمده را ببین. تولیدی پوشاک زنانه در مشهد.',
  imageUrl: WHOLESALE_PROMO_PARTNERSHIP_IMAGE,
  mobileImageUrl: WHOLESALE_PROMO_PARTNERSHIP_IMAGE_MOBILE,
  imageAlt:
    'مدل با کت چهارخانه، کلاه بره و چکمه در فضای داخلی روشن؛ بنر درخواست همکاری عمده پوشاک ترنم مشهد',
  presentation: 'artwork',
  ctaLabel: 'درخواست همکاری',
  ctaHref: '/portal/register',
};

export const WHOLESALE_PROMO_JACKETS_SLIDE: HeroSlide = {
  brandEyebrow: 'پوشاک ترنم',
  headline: 'کت بعدی‌ات را از نزدیک ببین',
  headlineAccent: 'از نزدیک ببین',
  body: 'عکس، جنس و سایز را بررسی کن.',
  imageUrl: WHOLESALE_PROMO_JACKETS_IMAGE,
  mobileImageUrl: WHOLESALE_PROMO_JACKETS_IMAGE_MOBILE,
  imageAlt: 'مدل با کت کرم دکمه‌دار و شلوار جین؛ بنر مشاهده کت زنانه پوشاک ترنم',
  presentation: 'artwork',
  ctaLabel: 'کت‌ها را ببین',
  ctaHref: '/category/women-coats',
};

export const WHOLESALE_PROMO_HERO_SLIDES: HeroSlide[] = [
  WHOLESALE_PROMO_PARTNERSHIP_SLIDE,
  WHOLESALE_PROMO_JACKETS_SLIDE,
];

export function isWholesalePromoHeroAsset(imageUrl?: string): boolean {
  return (imageUrl || '').includes('/banners/wholesale-promo-2026/');
}

/** Keep current promo plates first; drop older hashes of the same campaign. */
export function applyWholesalePromoHeroSlides(existing: HeroSlide[]): HeroSlide[] {
  const rest = existing.filter((slide) => !isWholesalePromoHeroAsset(slide.imageUrl));
  return [...WHOLESALE_PROMO_HERO_SLIDES, ...rest];
}
