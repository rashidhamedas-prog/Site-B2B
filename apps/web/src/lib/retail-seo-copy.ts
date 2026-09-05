/** Retail SERP copy: never leak wholesale intent onto .ir product pages. */

const WHOLESALE_MARK =
  /خرید\s*عمده|عمده\s*فروش[ی]?|عمده‌فروش[ی]?|قیمت\s*دست\s*اول|حاشیه\s*سود/i;

const SLUG_ALIASES: Record<string, string> = {
  'winter-wear00014': 'kapshan-bamber-65',
};

const BY_SLUG: Record<string, { title: string; description: string; focusKeyword: string }> = {
  'kapshan-bamber-65': {
    title: 'خرید کاپشن بامبری زنانه',
    description:
      'کاپشن بامبری زنانه با رویه مموری و قد حدود ۶۵ سانت؛ برای روزهای سرد، خرید تکی از فروشگاه ترنم در مشهد.',
    focusKeyword: 'کاپشن بامبری زنانه',
  },
};

export function looksWholesaleIntent(text: string | null | undefined): boolean {
  return WHOLESALE_MARK.test(String(text || ''));
}

export function toRetailIntent(text: string): string {
  return String(text || '')
    .replace(/خرید\s*عمده/g, 'خرید')
    .replace(/عمده‌فروشی\s*/g, '')
    .replace(/عمده\s*فروشی\s*/g, '')
    .replace(/\s*\|\s*قیمت دست اول تولیدی/g, '')
    .replace(/قیمت دست اول تولیدی/g, '')
    .replace(/حاشیه سود[^.]*\.?/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function resolveRetailProductSeo(input: {
  slug?: string | null;
  name?: string | null;
  seo?: Record<string, string | undefined> | null;
  description?: string | null;
}): { title: string; description: string; focusKeyword?: string } {
  const slug = SLUG_ALIASES[String(input.slug || '')] || String(input.slug || '');
  const override = BY_SLUG[slug];
  const seo = input.seo || {};
  const name = String(input.name || 'محصول');

  if (override) {
    return { ...override };
  }

  const rawTitle = seo.retailTitle || seo.title || name;
  const rawDescription =
    seo.retailDescription ||
    seo.description ||
    (input.description ? String(input.description).slice(0, 160) : '') ||
    `خرید تکی «${name}» از فروشگاه ترنم — مستقیم از کارگاه مشهد.`;
  const rawFocus = seo.retailFocusKeyword || seo.focusKeyword || undefined;

  const title = looksWholesaleIntent(rawTitle) ? toRetailIntent(rawTitle) || name : rawTitle;
  const description = looksWholesaleIntent(rawDescription)
    ? toRetailIntent(rawDescription) || `خرید تکی «${name}» از فروشگاه ترنم.`
    : rawDescription;
  const focusKeyword =
    rawFocus && looksWholesaleIntent(rawFocus) ? toRetailIntent(rawFocus) : rawFocus;

  return { title, description, focusKeyword };
}
