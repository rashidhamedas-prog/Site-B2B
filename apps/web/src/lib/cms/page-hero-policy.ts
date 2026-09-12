export const CMS_HOME_PAGE_KEY = 'home';

export function isHomePageKey(pageKey: string | null | undefined): boolean {
  return String(pageKey || '').trim() === CMS_HOME_PAGE_KEY;
}

/** Home campaign plates are merchandising for `pageKey=home` only. */
export function shouldInjectHomeCampaign(pageKey: string | null | undefined): boolean {
  return isHomePageKey(pageKey);
}

export function resolveHeroImageUrl(
  pageKey: string | null | undefined,
  imageUrl: string | undefined,
  homeFallback: string,
): string {
  const url = String(imageUrl || '').trim();
  if (url) return url;
  if (isHomePageKey(pageKey) && homeFallback.trim()) return homeFallback;
  return '';
}

export function resolvePageHeroSlides<T>(
  pageKey: string | null | undefined,
  slides: T[],
  injectHomeCampaign: (slides: T[]) => T[],
): T[] {
  if (!shouldInjectHomeCampaign(pageKey)) return slides;
  return injectHomeCampaign(slides);
}
