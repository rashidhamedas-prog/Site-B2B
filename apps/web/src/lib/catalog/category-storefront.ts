/** Home category cards: performance-first ceiling (landing, not a product list). */
export const HOME_CATEGORY_GRID_CAP = 16;

/**
 * Wholesale category index (text + tiny thumb). Higher than the image-card cap
 * so a sortOrder that puts شومیز last still shows every active category.
 * Image mosaics on retail stay on HOME_CATEGORY_GRID_CAP.
 */
export const WHOLESALE_CATEGORY_INDEX_CAP = 24;

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

export type CategoryHref = {
  id: string;
  slug?: string | null;
};

/** Public category URL. Slug pages stay canonical; id query is only a fallback. */
export function categoryStorefrontHref(c: CategoryHref): string {
  const slug = (c.slug || '').trim();
  if (slug) return `/category/${encodeURIComponent(slug)}`;
  return `/products?categoryId=${encodeURIComponent(c.id)}`;
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
  opts: {
    categoryIds?: string | null;
    maxItems?: unknown;
    homeOnly?: boolean;
    /** Override the retail image-grid ceiling. Wholesale index passes 24. */
    capCeiling?: number;
  },
): T[] {
  const source = opts.homeOnly ? categoriesVisibleOnHome(list) : list;
  const ceiling =
    typeof opts.capCeiling === 'number' && Number.isFinite(opts.capCeiling)
      ? Math.max(1, Math.floor(opts.capCeiling))
      : HOME_CATEGORY_GRID_CAP;
  const requested = opts.maxItems;
  const cap =
    typeof requested === 'number' && Number.isFinite(requested)
      ? Math.min(ceiling, Math.max(1, Math.floor(requested)))
      : ceiling;
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

/** Insert a category block after the hero unless one is already present. */
export function insertCategoryBlockAfterHero<T extends { type: string }>(blocks: T[], block: T): T[] {
  if (blocks.some((item) => item.type === 'categoryBanners')) return blocks;
  const heroAt = blocks.findIndex((item) => item.type === 'hero');
  if (heroAt < 0) return [block, ...blocks];
  return [...blocks.slice(0, heroAt + 1), block, ...blocks.slice(heroAt + 1)];
}
