/** Strip wholesale catalog SSR payload so /products HTML stays small. */
export function slimWholesaleCatalogProduct(raw: Record<string, unknown>): Record<string, unknown> {
  const images = Array.isArray(raw.images)
    ? (raw.images as unknown[]).filter((u) => typeof u === 'string').slice(0, 2)
    : [];
  const variants = Array.isArray(raw.variants)
    ? (raw.variants as Array<Record<string, unknown>>).map((v) => ({
        id: v.id,
        color: v.color,
        colorHex: v.colorHex,
        size: v.size,
        wholesaleStock: v.wholesaleStock,
      }))
    : [];
  return {
    id: raw.id,
    name: raw.name,
    slug: raw.slug,
    sku: raw.sku,
    fabric: raw.fabric,
    wholesalePrice: raw.wholesalePrice,
    images,
    wholesaleStock: raw.wholesaleStock,
    status: raw.status,
    isNew: raw.isNew,
    isPreOrder: raw.isPreOrder,
    sale: raw.sale,
    sizeType: raw.sizeType,
    minOrderQty: raw.minOrderQty,
    variants,
  };
}
