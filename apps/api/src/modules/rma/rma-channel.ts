export function rmaStockChannel(orderType?: string | null): 'RETAIL' | 'WHOLESALE' {
  const t = String(orderType || '').toUpperCase();
  return t === 'RETAIL' || t === 'RETAIL_WEBSITE' ? 'RETAIL' : 'WHOLESALE';
}
