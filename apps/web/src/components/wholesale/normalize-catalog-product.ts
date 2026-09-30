/**
 * Normalize wholesale catalog rows for ProductCatalog (SSR seed + client refetch).
 * Must keep card/quick-order fields that slimWholesaleCatalogProduct already forwards.
 */
export type WholesaleCatalogProduct = {
  id: string;
  slug: string;
  sku: string;
  name: string;
  fabric: string;
  wholesalePrice: number;
  sale?: {
    active?: boolean;
    payable?: number;
    original?: number | null;
    badgePercent?: number;
  };
  status: string;
  stock?: number;
  wholesaleStock?: number;
  totalStock?: number;
  images: string[];
  sizeType?: string;
  minOrderQty?: number;
  /** Free-text chip next to سفارش; empty → resolveWholesaleOrderBadge fallback */
  orderBadgeLabel?: string | null;
  allowWholesaleColorSelect?: boolean;
  minWholesaleColors?: number;
  variants: {
    id: string;
    color: string;
    colorHex?: string;
    stock: number;
    wholesaleStock?: number;
    size?: string;
  }[];
};

export function normalizeCatalogProduct(
  raw: Record<string, unknown> | WholesaleCatalogProduct,
): WholesaleCatalogProduct {
  const variants = Array.isArray(raw.variants) ? raw.variants : [];
  const orderBadgeLabel =
    typeof raw.orderBadgeLabel === 'string'
      ? raw.orderBadgeLabel
      : raw.orderBadgeLabel === null
        ? null
        : undefined;
  return {
    id: String(raw.id ?? ''),
    slug: String(raw.slug ?? ''),
    sku: String(raw.sku ?? ''),
    name: String(raw.name ?? ''),
    fabric: String(raw.fabric ?? ''),
    wholesalePrice: Number(raw.wholesalePrice ?? 0),
    sale: raw.sale && typeof raw.sale === 'object' ? (raw.sale as WholesaleCatalogProduct['sale']) : undefined,
    status: String(raw.status ?? 'ACTIVE'),
    wholesaleStock: typeof raw.wholesaleStock === 'number' ? raw.wholesaleStock : undefined,
    stock: typeof raw.wholesaleStock === 'number' ? raw.wholesaleStock : undefined,
    totalStock: typeof raw.wholesaleStock === 'number' ? raw.wholesaleStock : undefined,
    images: Array.isArray(raw.images) ? (raw.images as string[]) : [],
    sizeType: typeof raw.sizeType === 'string' ? raw.sizeType : undefined,
    minOrderQty: typeof raw.minOrderQty === 'number' ? raw.minOrderQty : undefined,
    orderBadgeLabel,
    allowWholesaleColorSelect:
      typeof raw.allowWholesaleColorSelect === 'boolean' ? raw.allowWholesaleColorSelect : undefined,
    minWholesaleColors:
      typeof raw.minWholesaleColors === 'number' ? raw.minWholesaleColors : undefined,
    variants: variants.map((v) => {
      const row = v as {
        id?: string;
        color?: string;
        colorHex?: string;
        stock?: number;
        wholesaleStock?: number;
        size?: string;
      };
      const wholesale = Number(row.wholesaleStock ?? 0);
      return {
        id: String(row.id ?? ''),
        color: String(row.color ?? ''),
        colorHex: row.colorHex,
        wholesaleStock: wholesale,
        stock: wholesale,
        size: row.size,
      };
    }),
  };
}
