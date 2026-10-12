export const CMS_HOME_PAGE_KEY = 'home';

export function isHomePageKey(pageKey: string | null | undefined): boolean {
  return String(pageKey || '').trim() === CMS_HOME_PAGE_KEY;
}

export function resolveHeroImageUrl(
  pageKey: string | null | undefined,
  imageUrl: string | undefined,
  homeFallback: string
): string {
  const url = String(imageUrl || '').trim();
  if (url) return url;
  if (isHomePageKey(pageKey) && homeFallback.trim()) return homeFallback;
  return '';
}

/** CMS order is authoritative; merchandising is saved and reordered in Admin. */
export function resolvePageHeroSlides<T>(slides: T[]): T[] {
  return slides;
}
