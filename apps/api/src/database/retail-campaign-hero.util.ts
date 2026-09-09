export const RETAIL_CAMPAIGN_HERO_SLIDES = [
  {
    brandEyebrow: 'پوشاک ترنم',
    headline: 'انتخاب با تو، پرداخت با دیجی‌پی',
    headlineAccent: 'دیجی‌پی',
    body: 'مدل دلخواهت را انتخاب کن؛ هنگام پرداخت، دیجی‌پی را بزن. طبق شرایط و اعتبار دیجی‌پی.',
    imageUrl: '/banners/digipay-installment-2026/retail-desktop-ece15c60d7c8.webp',
    mobileImageUrl: '/banners/digipay-installment-2026/retail-mobile-0fdb9791bdd5.webp',
    imageAlt:
      'خرید آنلاین پوشاک ترنم با دیجی‌پی: دست‌ها گوشی فروشگاه و کارت سپهر بانک صادرات را گرفته‌اند',
    presentation: 'artwork',
    overlayTone: 'light',
    ctaLabel: 'انتخاب لباس',
    ctaHref: '/products',
  },
  {
    brandEyebrow: 'پوشاک ترنم',
    headline: 'کت‌های پریما و نگین را با جزئیات ببین',
    headlineAccent: 'پریما و نگین',
    body: 'دو مدل کت چهارخانه زنانه برای استایل روزمره؛ از دسته کت انتخاب کن.',
    imageUrl: '/banners/prima-negin-2026/retail-desktop-9f8ee115cd93.webp',
    mobileImageUrl: '/banners/prima-negin-2026/retail-mobile-7e9068bd09ee.webp',
    imageAlt:
      'دو مدل با کت چهارخانه پریما و نگین در حیاط روشن؛ بنر پوشاک ترنم برای دیدن کت زنانه',
    presentation: 'artwork',
    overlayTone: 'dark',
    ctaLabel: 'دیدن کت‌های پریما و نگین',
    ctaHref: '/category/women-coats',
  },
] as const;

export function isRetailCampaignHeroAsset(imageUrl: unknown): boolean {
  const url = typeof imageUrl === 'string' ? imageUrl : '';
  return (
    url.includes('/banners/digipay-installment-2026/') ||
    url.includes('/banners/prima-negin-2026/')
  );
}

type HeroBlock = {
  type?: unknown;
  props?: Record<string, unknown> | null;
  [key: string]: unknown;
};

export function applyRetailCampaignHeroSlidesToBlocks(blocks: unknown): {
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
        !isRetailCampaignHeroAsset((slide as { imageUrl?: unknown }).imageUrl),
    );
    const alreadyCurrent =
      rest.length === slides.length - RETAIL_CAMPAIGN_HERO_SLIDES.length &&
      isRetailCampaignHeroAsset((slides[0] as { imageUrl?: unknown } | undefined)?.imageUrl) &&
      (slides[0] as { imageUrl?: string }).imageUrl === RETAIL_CAMPAIGN_HERO_SLIDES[0].imageUrl &&
      (slides[1] as { imageUrl?: string } | undefined)?.imageUrl ===
        RETAIL_CAMPAIGN_HERO_SLIDES[1].imageUrl;

    if (alreadyCurrent) return block;

    props.slides = [...RETAIL_CAMPAIGN_HERO_SLIDES, ...rest];
    if (typeof props.autoplayMs !== 'number') props.autoplayMs = 6500;
    changed = true;
    return { ...hero, props };
  });

  return { blocks: next, changed };
}
