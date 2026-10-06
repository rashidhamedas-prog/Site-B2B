/** Home category cards: performance-first ceiling (landing, not a product list). */
export const HOME_CATEGORY_GRID_CAP = 16;

export const CATALOG_REVALIDATE_SECONDS = 60;

export function catalogFetchInit(): { next: { revalidate: number; tags: string[] } } {
  return { next: { revalidate: CATALOG_REVALIDATE_SECONDS, tags: ['catalog'] } };
}

export type CategoryLabel = {
  id: string;
  name?: string | null;
  nameEn?: string | null;
};

/** Canonical storefront label: whatever the operator saved on `name`. */
export function categoryDisplayName(c: CategoryLabel): string {
  return (c.name || '').trim() || (c.nameEn || '').trim();
}

export function resolveHomeCategoryMaxItems(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return HOME_CATEGORY_GRID_CAP;
  return Math.min(HOME_CATEGORY_GRID_CAP, Math.max(1, Math.floor(raw)));
}

export type HomeMerchCategory = {
  id: string;
  showOnHome?: boolean | null;
};

/**
 * Home grid only. Menus, mega-nav, category pages, and sitemap must not call this.
 * Missing/undefined showOnHome is treated as visible (legacy rows / pre-migration).
 */
export function categoriesVisibleOnHome<T extends HomeMerchCategory>(list: T[]): T[] {
  return list.filter((c) => c.showOnHome !== false);
}

/**
 * Pin CMS ids first (when set), then keep API order (sortOrder, newest).
 * Never reverse-then-slice — that hides new ACTIVE categories.
 * When `homeOnly` is true, apply categoriesVisibleOnHome before pin/slice.
 */
export function merchandiseCategories<T extends HomeMerchCategory>(
  list: T[],
  opts: { categoryIds?: string | null; maxItems?: unknown; homeOnly?: boolean },
): T[] {
  const source = opts.homeOnly ? categoriesVisibleOnHome(list) : list;
  const cap = resolveHomeCategoryMaxItems(opts.maxItems);
  const idFilter = (opts.categoryIds || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  let ordered = source;
  if (idFilter.length) {
    const order = new Map(idFilter.map((id, i) => [id, i]));
    const pinned = source
      .filter((c) => order.has(c.id))
      .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    const rest = source.filter((c) => !order.has(c.id));
    ordered = [...pinned, ...rest];
  }
  return ordered.slice(0, cap);
}
