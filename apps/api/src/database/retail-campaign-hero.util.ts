export const RETAIL_CAMPAIGN_HERO_SLIDES = [
  {
    brandEyebrow: 'پوشاک ترنم',
    headline: 'انتخاب با تو، پرداخت با دیجی‌پی',
    headlineAccent: 'دیجی‌پی',
    body: 'مدل دلخواهت را انتخاب کن؛ هنگام پرداخت، دیجی‌پی را بزن. طبق شرایط و اعتبار دیجی‌پی.',
    imageUrl: '/banners/digipay-installment-2026/retail-desktop-182e2ad9311d.webp',
    mobileImageUrl: '/banners/digipay-installment-2026/retail-mobile-78fce6fbea4c.webp',
    imageAlt:
      'خرید آنلاین پوشاک ترنم با دیجی‌پی: دست‌ها گوشی فروشگاه و کارت بانکی آبی را گرفته‌اند',
    presentation: 'artwork',
    overlayTone: 'light',
    ctaLabel: 'انتخاب لباس',
    ctaHref: '/products',
  },
  {
    brandEyebrow: 'پوشاک ترنم',
    headline: 'مدل بعدی ویترینت را انتخاب کن',
    headlineAccent: 'ویترینت',
    body: 'کت‌های پریما و نگین را با جزئیات ببین.',
    imageUrl: '/banners/prima-negin-2026/retail-desktop-e6ae94c783d0.webp',
    mobileImageUrl: '/banners/prima-negin-2026/retail-mobile-9c9af33ce4a9.webp',
    imageAlt:
      'دو مدل با کت چهارخانه پریما و نگین در فضای روشن؛ بنر پوشاک ترنم برای دیدن کت زنانه',
    presentation: 'artwork',
    overlayTone: 'dark',
    ctaLabel: 'دیدن کت‌ها',
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
