import {
  channelSaleDisplay,
  piecesPerPackCount,
  sizeCountForType,
  type ChannelSale,
} from './product-display';

export type WholesaleOrderVariant = {
  id?: string;
  color?: string;
  colorHex?: string;
  size?: string;
  stock?: number;
  wholesaleStock?: number;
};

export type WholesaleOrderProduct = {
  id: string;
  name: string;
  slug?: string;
  sku?: string;
  fabric?: string;
  wholesalePrice?: number | null;
  sale?: ChannelSale | null;
  minOrderQty?: number;
  minimumOrderQuantity?: number;
  allowWholesaleColorSelect?: boolean;
  minWholesaleColors?: number;
  stock?: number;
  wholesaleStock?: number;
  totalStock?: number;
  images?: string[];
  variants?: WholesaleOrderVariant[];
  sizeType?: string;
  status?: string;
  specs?: { fabricType?: string; packQty?: string };
  fullContent?: string | null;
  wholesaleFullContent?: string | null;
};

export function variantWholesale(v: WholesaleOrderVariant): number {
  return Number(v.wholesaleStock) || Number(v.stock) || 0;
}

export function wholesaleMoq(product: WholesaleOrderProduct): number {
  const raw = product.minOrderQty ?? product.minimumOrderQuantity ?? 1;
  const n = Math.floor(Number(raw));
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

export function defaultWholesaleColors(product: WholesaleOrderProduct): string[] {
  if (product.allowWholesaleColorSelect) return [];
  return Array.from(new Set((product.variants ?? []).filter((v) => v.color).map((v) => v.color as string)));
}

export function wholesaleOrderSummary(
  product: WholesaleOrderProduct,
  selectedColors: string[],
  packCount: number,
) {
  const variants = product.variants ?? [];
  const availableColors = Array.from(
    new Map(
      variants
        .filter((v) => v.color)
        .map((v) => [v.color, { name: v.color as string, hex: v.colorHex || '#ccc' }]),
    ).values(),
  );
  const availableSizes = Array.from(new Set(variants.map((v) => v.size).filter((s): s is string => !!s)));
  const allowColorSelect = !!product.allowWholesaleColorSelect;
  const minColors = Math.max(1, Number(product.minWholesaleColors) || 1);
  const colorsForOrder = allowColorSelect ? selectedColors : availableColors.map((c) => c.name);
  const typedSizeCount = sizeCountForType(product.sizeType);
  const sizeCount = typedSizeCount ?? Math.max(0, availableSizes.length);
  const packMode = availableColors.length > 0 && sizeCount > 0;
  const piecesPerPack = packMode
    ? piecesPerPackCount(colorsForOrder, product.sizeType, availableSizes)
    : 1;
  const pieces = packMode ? packCount * piecesPerPack : packCount;
  const minOrder = wholesaleMoq(product);
  const { price: unitPrice, compareAt, discount, active: saleActive } = channelSaleDisplay(
    product.sale,
    product.wholesalePrice,
  );
  const colorsReady = !allowColorSelect || selectedColors.length >= minColors;
  const isComingSoon = product.status === 'COMING_SOON';
  const totalStock =
    typeof product.wholesaleStock === 'number'
      ? product.wholesaleStock
      : typeof product.totalStock === 'number'
        ? product.totalStock
        : typeof product.stock === 'number'
          ? product.stock
          : variants.reduce((sum, v) => sum + variantWholesale(v), 0);

  const packStockOk = (() => {
    if (!packMode) return totalStock >= minOrder;
    if (allowColorSelect && selectedColors.length < minColors) return false;
    if (!colorsForOrder.length || !availableSizes.length) return false;
    for (const color of colorsForOrder) {
      for (const size of availableSizes) {
        const v = variants.find((x) => x.color === color && x.size === size);
        if (!v || variantWholesale(v) < packCount) return false;
      }
    }
    return true;
  })();

  return {
    availableColors,
    availableSizes,
    allowColorSelect,
    minColors,
    colorsForOrder,
    packMode,
    piecesPerPack,
    sizeCount,
    totalPieces: pieces,
    minOrder,
    colorsReady,
    isComingSoon,
    totalStock,
    canOrder: colorsReady && (isComingSoon || (packMode ? packStockOk : totalStock >= minOrder)),
    unitPrice,
    compareAt,
    discount,
    saleActive,
  };
}
