export const RETAIL_STOREFRONT_SKINS = ['classic', 'boutique'] as const;

export type RetailStorefrontSkin = (typeof RETAIL_STOREFRONT_SKINS)[number];

export const DEFAULT_RETAIL_STOREFRONT_SKIN: RetailStorefrontSkin = 'classic';

/** Server-safe allowlist. Unknown values fall back to classic (live default). */
export function parseRetailStorefrontSkin(raw: unknown): RetailStorefrontSkin {
  return raw === 'boutique' ? 'boutique' : 'classic';
}

export function isBoutiqueRetailSkin(raw: unknown): boolean {
  return parseRetailStorefrontSkin(raw) === 'boutique';
}
