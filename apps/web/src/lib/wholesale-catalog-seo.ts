/**
 * Wholesale /products listing SEO helpers.
 * Filtered and page>1 URLs are client overlays on the same shell — keep them
 * out of the index and point canonical at the clean listing.
 */

export type WholesaleCatalogQuery = {
  q?: string;
  fabric?: string;
  color?: string;
  size?: string;
  sort?: string;
  page?: string;
  inStock?: string;
  categoryId?: string;
};

export function wholesaleCatalogQueryIsUtility(sp: WholesaleCatalogQuery): boolean {
  const page = Number(sp.page || '1');
  if (Number.isFinite(page) && page > 1) return true;
  if (sp.q?.trim()) return true;
  if (sp.fabric?.trim()) return true;
  if (sp.color?.trim()) return true;
  if (sp.size?.trim()) return true;
  if (sp.inStock?.trim()) return true;
  if (sp.categoryId?.trim()) return true;
  if (sp.sort?.trim() && sp.sort.trim() !== 'newest') return true;
  return false;
}
