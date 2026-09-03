export type HeroOverlayTone = 'dark' | 'light';

export type HeroSlide = {
  brandEyebrow?: string;
  headline: string;
  headlineAccent?: string;
  body?: string;
  imageUrl: string;
  mobileImageUrl?: string;
  imageAlt?: string;
  presentation?: 'overlay' | 'artwork';
  overlayTone?: HeroOverlayTone;
  ctaLabel?: string;
  ctaHref?: string;
  ctaSecondaryLabel?: string;
  ctaSecondaryHref?: string;
};

export type HeroFlatProps = {
  brandEyebrow?: string;
  headline?: string;
  headlineAccent?: string;
  body?: string;
  imageUrl?: string;
  mobileImageUrl?: string;
  imageAlt?: string;
  presentation?: 'overlay' | 'artwork';
  overlayTone?: HeroOverlayTone;
  ctaLabel?: string;
  ctaHref?: string;
  ctaSecondaryLabel?: string;
  ctaSecondaryHref?: string;
  slides?: HeroSlide[] | unknown;
  autoplayMs?: number;
};

export const DIGIPAY_RETAIL_HERO_IMAGE = '/banners/digipay-installment-2026/retail-desktop.webp';
export const DIGIPAY_RETAIL_HERO_IMAGE_MOBILE =
  '/banners/digipay-installment-2026/retail-mobile.webp';

export const DIGIPAY_RETAIL_HERO_SLIDE: HeroSlide = {
  brandEyebrow: 'پرداخت با دیجی‌پی',
  headline: 'خرید قسطی با دیجی‌پی در ترنم فعال شد',
  headlineAccent: 'ترنم',
  body: 'مدل دلخواهت را انتخاب کن و موقع پرداخت، دیجی‌پی را بزن — برای خریدی راحت‌تر و برنامه‌ریزی‌شده‌تر.',
  imageUrl: DIGIPAY_RETAIL_HERO_IMAGE,
  mobileImageUrl: DIGIPAY_RETAIL_HERO_IMAGE_MOBILE,
  imageAlt:
    'زن جوان با مانتو و کلاه کرمی در فروشگاه پوشاک، در حال نگاه به گوشی؛ کنار تصویر گوشی و کارت پرداخت سه‌بعدی بدون نوشته',
  presentation: 'overlay',
  overlayTone: 'light',
  ctaLabel: 'مشاهده محصولات',
  ctaHref: '/products',
};

function parseOverlayTone(value: unknown): HeroOverlayTone | undefined {
  return value === 'light' ? 'light' : value === 'dark' ? 'dark' : undefined;
}

const DEFAULT_AUTOPLAY_MS = 5500;

function trimUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function asSlide(raw: unknown): HeroSlide | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const headline = typeof o.headline === 'string' ? o.headline.trim() : '';
  if (!headline) return null;
  return {
    brandEyebrow: typeof o.brandEyebrow === 'string' ? o.brandEyebrow : undefined,
    headline,
    headlineAccent: typeof o.headlineAccent === 'string' ? o.headlineAccent : undefined,
    body: typeof o.body === 'string' ? o.body : undefined,
    imageUrl: trimUrl(o.imageUrl) || '',
    mobileImageUrl: trimUrl(o.mobileImageUrl),
    imageAlt: typeof o.imageAlt === 'string' ? o.imageAlt : undefined,
    presentation: o.presentation === 'artwork' ? 'artwork' : 'overlay',
    overlayTone: parseOverlayTone(o.overlayTone),
    ctaLabel: typeof o.ctaLabel === 'string' ? o.ctaLabel : undefined,
    ctaHref: typeof o.ctaHref === 'string' ? o.ctaHref : undefined,
    ctaSecondaryLabel: typeof o.ctaSecondaryLabel === 'string' ? o.ctaSecondaryLabel : undefined,
    ctaSecondaryHref: typeof o.ctaSecondaryHref === 'string' ? o.ctaSecondaryHref : undefined,
  };
}

/** Prefer `slides[]`; fall back to flat CMS props as a single slide. */
export function normalizeHeroSlides(props: HeroFlatProps, fallback?: HeroSlide): HeroSlide[] {
  if (Array.isArray(props.slides)) {
    const fromArray = props.slides.map(asSlide).filter((s): s is HeroSlide => Boolean(s));
    if (fromArray.length > 0) return fromArray;
  }

  const flatHeadline = props.headline?.trim();
  if (flatHeadline) {
    return [
      {
        brandEyebrow: props.brandEyebrow,
        headline: flatHeadline,
        headlineAccent: props.headlineAccent,
        body: props.body,
        imageUrl: trimUrl(props.imageUrl) || '',
        mobileImageUrl: trimUrl(props.mobileImageUrl),
        imageAlt: props.imageAlt,
        presentation: props.presentation === 'artwork' ? 'artwork' : 'overlay',
        overlayTone: props.overlayTone,
        ctaLabel: props.ctaLabel,
        ctaHref: props.ctaHref,
        ctaSecondaryLabel: props.ctaSecondaryLabel,
        ctaSecondaryHref: props.ctaSecondaryHref,
      },
    ];
  }

  return fallback ? [fallback] : [];
}

export function prependUniqueHeroSlide(existing: HeroSlide[], slide: HeroSlide): HeroSlide[] {
  if (existing.some((item) => item.imageUrl === slide.imageUrl)) return existing;
  return [slide, ...existing];
}

export function isLightHeroOverlay(slide: HeroSlide): boolean {
  return slide.presentation !== 'artwork' && slide.overlayTone === 'light';
}

export function resolveAutoplayMs(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return DEFAULT_AUTOPLAY_MS;
}

export { DEFAULT_AUTOPLAY_MS };
