export const TARANOM_JSONLD_BRAND = 'پوشاک ترنم';

export function jsonLdBrandNode(opts: {
  brandName?: string | null;
  hideDefaultBrand?: boolean;
}): { '@type': 'Brand'; name: string } | undefined {
  const custom = String(opts.brandName || '').trim();
  if (custom) return { '@type': 'Brand', name: custom };
  if (opts.hideDefaultBrand) return undefined;
  return { '@type': 'Brand', name: TARANOM_JSONLD_BRAND };
}
