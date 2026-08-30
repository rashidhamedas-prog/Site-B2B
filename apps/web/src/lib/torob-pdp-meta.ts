import {
  irrToTomanOnce,
  pageUniqueForProduct,
  pageUniqueForVariant,
  retailUnitStock,
  sanitizeGuarantee,
  selectDefaultRetailVariant,
} from '@taranom/shared-types';

export type TorobPdpVariant = {
  id: string;
  color?: string;
  size?: string;
  retailStock?: number | string | null;
  createdAt?: string | Date | null;
  imageUrl?: string | null;
};

export type TorobPdpProduct = {
  id: string;
  name?: string;
  slug?: string;
  images?: string[] | null;
  retailPrice?: number | string | null;
  sale?: { active?: boolean; payable?: number; original?: number | null } | null;
  guarantee?: string | null;
  defaultRetailVariantId?: string | null;
  retailStock?: number | string | null;
  variants?: TorobPdpVariant[] | null;
};

export function resolveRetailPdpOption(product: TorobPdpProduct, requestedVariantId?: string | null) {
  const variants = product.variants || [];
  const requested = requestedVariantId
    ? variants.find((variant) => variant.id === requestedVariantId) ?? null
    : null;
  const selected =
    requested || selectDefaultRetailVariant(variants, product.defaultRetailVariantId);
  const payable = Number(product.sale?.payable ?? product.retailPrice ?? 0);
  const stock = retailUnitStock(selected ?? product);
  const image = selected?.imageUrl || product.images?.[0] || '';
  return {
    selected,
    requestedWasValid: Boolean(requested),
    productId: selected ? pageUniqueForVariant(selected.id) : pageUniqueForProduct(product.id),
    productName: String(product.name || ''),
    productPriceToman: irrToTomanOnce(payable),
    availability: stock > 0 ? ('instock' as const) : ('outofstock' as const),
    guarantee: sanitizeGuarantee(product.guarantee),
    image,
    optionLabel: selected ? [selected.color, selected.size].filter(Boolean).join(' / ') : '',
  };
}

export function torobHeadMeta(option: ReturnType<typeof resolveRetailPdpOption>) {
  const other: Record<string, string> = {
    product_price: String(option.productPriceToman),
    availability: option.availability,
    product_name: option.productName,
    product_id: option.productId,
  };
  if (option.guarantee) other.guarantee = option.guarantee;
  return other;
}
