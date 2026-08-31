import { resolveChannelSale } from './product-sale';

export type SalesChannel = 'RETAIL' | 'WHOLESALE';

export interface ChannelStockSource {
  stock?: number | string | null;
  wholesaleStock?: number | string | null;
  retailStock?: number | string | null;
}

export interface ChannelProductSource extends ChannelStockSource {
  status?: string | null;
  showOnRetail?: boolean | null;
  showOnWholesale?: boolean | null;
  retailPrice?: number | string | null;
  wholesalePrice?: number | string | null;
  variants?: ChannelStockSource[] | null;
}

export function normalizeSalesChannel(channel?: string | null): SalesChannel {
  return String(channel || 'WHOLESALE').toUpperCase() === 'RETAIL' ? 'RETAIL' : 'WHOLESALE';
}

/** Projection stock: channel column only. Legacy `stock` is forbidden. */
export function channelUnitStock(item: ChannelStockSource | null | undefined, channel: SalesChannel): number {
  if (!item) return 0;
  if (channel === 'RETAIL') return Math.max(0, Number(item.retailStock) || 0);
  return Math.max(0, Number(item.wholesaleStock) || 0);
}

export function isChannelVisible(product: ChannelProductSource, channel: SalesChannel): boolean {
  if (String(product.status || '').toUpperCase() !== 'ACTIVE') return false;
  if (channel === 'RETAIL') return product.showOnRetail !== false && Number(product.retailPrice) > 0;
  return product.showOnWholesale !== false && Number(product.wholesalePrice) > 0;
}

export function channelAvailability(product: ChannelProductSource, channel: SalesChannel): {
  stock: number;
  available: boolean;
} {
  const variants = product.variants || [];
  const stock = variants.length
    ? variants.reduce((sum, variant) => sum + channelUnitStock(variant, channel), 0)
    : channelUnitStock(product, channel);
  return { stock, available: stock > 0 };
}

export function projectChannelProduct(product: ChannelProductSource, channel: SalesChannel) {
  const visible = isChannelVisible(product, channel);
  const availability = channelAvailability(product, channel);
  const sale = resolveChannelSale(product as any, channel);
  return {
    channel,
    visible,
    stock: availability.stock,
    available: visible && availability.available,
    payable: sale.payable,
    listPrice: sale.active && sale.original ? sale.original : sale.payable,
    salePrice: sale.active ? sale.payable : null,
  };
}
