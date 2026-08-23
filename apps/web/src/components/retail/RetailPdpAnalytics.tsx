'use client';

import { useEffect, useRef } from 'react';
import { trackViewItem } from '@/lib/retail-analytics';

type ProductLike = {
  id?: string;
  sku?: string | null;
  name?: string;
  retailPrice?: number | null;
  retailCompareAtPrice?: number | null;
  sale?: { payable?: number; original?: number | null; active?: boolean } | null;
  fabric?: string | null;
};

/**
 * Fires GA4 view_item once per product id when a public retail PDP is viewed.
 * Mounted from the product page so RetailProductDetail (other task) stays untouched.
 */
export function RetailPdpAnalytics({ product }: { product: ProductLike }) {
  const sent = useRef<string>('');

  useEffect(() => {
    const id = String(product.id || product.sku || '');
    if (!id || sent.current === id) return;
    sent.current = id;
    const price = Number(product.sale?.payable ?? product.retailPrice ?? 0);
    const original = Number(product.sale?.original ?? product.retailCompareAtPrice ?? 0);
    const discount = original > price ? original - price : 0;
    trackViewItem({
      productId: product.id,
      sku: product.sku || undefined,
      name: product.name,
      unitPrice: price,
      quantity: 1,
      discount: discount || undefined,
      itemListName: 'Product Detail',
      itemListId: 'pdp',
    });
  }, [product]);

  return null;
}
