export const WHOLESALE_PROMO_HERO_SLIDES = [
  {
    brandEyebrow: 'پوشاک ترنم',
    headline: 'برای بوتیکت، از ترنم شروع کن',
    headlineAccent: 'از ترنم شروع کن',
    body: 'درخواست همکاری بده؛ پس از تأیید، قیمت عمده را ببین. تولیدی پوشاک زنانه در مشهد.',
    imageUrl: '/banners/wholesale-promo-2026/partnership-d8771aca17fe.webp',
    mobileImageUrl: '/banners/wholesale-promo-2026/partnership-mobile-ecf1c65e857b.webp',
    imageAlt:
      'مدل با کت چهارخانه، کلاه بره و چکمه در فضای داخلی روشن؛ بنر درخواست همکاری عمده پوشاک ترنم مشهد',
    presentation: 'artwork',
    ctaLabel: 'درخواست همکاری',
    ctaHref: '/portal/register',
  },
  {
    brandEyebrow: 'پوشاک ترنم',
    headline: 'کت بعدی‌ات را از نزدیک ببین',
    headlineAccent: 'از نزدیک ببین',
    body: 'عکس، جنس و سایز را بررسی کن.',
    imageUrl: '/banners/wholesale-promo-2026/jackets-19fc4bd8d65a.webp',
    mobileImageUrl: '/banners/wholesale-promo-2026/jackets-mobile-b38e5ccce891.webp',
    imageAlt: 'مدل با کت کرم دکمه‌دار و شلوار جین؛ بنر مشاهده کت زنانه پوشاک ترنم',
    presentation: 'artwork',
    ctaLabel: 'کت‌ها را ببین',
    ctaHref: '/category/women-coats',
  },
] as const;

export function isWholesalePromoHeroAsset(imageUrl: unknown): boolean {
  const url = typeof imageUrl === 'string' ? imageUrl : '';
  return url.includes('/banners/wholesale-promo-2026/');
}

type HeroBlock = {
  type?: unknown;
  props?: Record<string, unknown> | null;
  [key: string]: unknown;
};

export function applyWholesalePromoHeroSlidesToBlocks(blocks: unknown): {
  blocks: unknown;
  changed: boolean;
} {
  if (!Array.isArray(blocks)) return { blocks, changed: false };

  let changed = false;
  const next = blocks.map((block) => {
    if (!block || typeof block !== 'object') return block;
    const hero = block as HeroBlock;
    if (hero.type !== 'hero' || !hero.props || typeof hero.props !== 'object') return block;

    const props = { ...hero.props };
    const slides = Array.isArray(props.slides) ? [...props.slides] : [];
    const rest = slides.filter(
      (slide) =>
        !slide ||
        typeof slide !== 'object' ||
        !isWholesalePromoHeroAsset((slide as { imageUrl?: unknown }).imageUrl),
    );
    const alreadyCurrent =
      rest.length === slides.length - WHOLESALE_PROMO_HERO_SLIDES.length &&
      (slides[0] as { imageUrl?: string } | undefined)?.imageUrl ===
        WHOLESALE_PROMO_HERO_SLIDES[0].imageUrl &&
      (slides[1] as { imageUrl?: string } | undefined)?.imageUrl ===
        WHOLESALE_PROMO_HERO_SLIDES[1].imageUrl;

    if (alreadyCurrent) return block;

    props.slides = [...WHOLESALE_PROMO_HERO_SLIDES, ...rest];
    if (typeof props.autoplayMs !== 'number') props.autoplayMs = 6500;
    changed = true;
    return { ...hero, props };
  });

  return { blocks: next, changed };
}
