'use client';

import { useEffect, useRef } from 'react';
import { trackViewItemList, type RetailAnalyticsItemInput } from '@/lib/retail-analytics';

export function CategoryListBeacon({
  channel,
  slug,
  items,
}: {
  channel: string;
  slug: string;
  items: RetailAnalyticsItemInput[];
}) {
  const seen = useRef('');
  useEffect(() => {
    if (channel !== 'RETAIL' || items.length === 0) return;
    const key = `${slug}:${items.map((item) => item.productId || item.sku || item.name).join(',')}`;
    if (seen.current === key) return;
    seen.current = key;
    trackViewItemList(items, 'category', `/category/${slug}`);
  }, [channel, slug, items]);
  return null;
}
