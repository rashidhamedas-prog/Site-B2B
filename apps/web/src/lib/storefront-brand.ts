/** Shared storefront mark. Wholesale header paints this file; retail must use the same path. */
export const STOREFRONT_LOGO_PATH = '/logo-128.png';

/** Default Persian wordmark on the wholesale header (`brandName`). */
export const WHOLESALE_BRAND_NAME_FA = 'پوشاک ترنم';

export const RETAIL_HEADER_SUBTITLE = 'فروشگاه آنلاین';

/** Single accessible name for the retail logo link and its image. */
export const RETAIL_LOGO_ALT = `${WHOLESALE_BRAND_NAME_FA} – ${RETAIL_HEADER_SUBTITLE}`;

/** Relative logo paths only. Anything else falls back to the shared mark. */
export function safeStorefrontLogoSrc(logoUrl: string | null | undefined): string {
  const value = (logoUrl ?? '').trim();
  if (value.startsWith('/') && !value.startsWith('//') && !/[\s"'()\\]/.test(value)) return value;
  return STOREFRONT_LOGO_PATH;
}
