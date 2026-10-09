/** Shared catalog-card image knobs — keep LCP bytes small on Slow 4G / CrUX. */
export const CATALOG_CARD_IMAGE_QUALITY = 65 as const;

/** Two-column mobile cards ≈ 46vw; desktop grid cells stay under ~288px. */
export const CATALOG_CARD_IMAGE_SIZES =
  '(max-width:767px) 46vw, (max-width:1280px) 24vw, 288px' as const;

export function catalogHydrationKey(filtered: boolean, serializedParams: string): string {
  return filtered ? serializedParams : 'default';
}

export function isLeadCatalogImage({
  index,
  embedded = false,
  page = 1,
}: {
  index: number;
  embedded?: boolean;
  page?: number;
}): boolean {
  return !embedded && page === 1 && index === 0;
}
