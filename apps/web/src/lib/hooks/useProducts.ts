'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../api';

export interface ProductCustomField {
  key?: string;
  label: string;
  value: string;
}

export interface ProductSpecs {
  fabricType?: string;
  designDetails?: string;
  packageSpecs?: string;
  manufacturingBadge?: string;
  packQty?: string;
  length?: string;
  length2?: string;
  length3?: string;
  chestWidth?: string;
  sleeveModel?: string;
  buttonModel?: string;
  collarModel?: string;
  customFields?: ProductCustomField[];
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  fabric: string;
  status: string;
  isFeatured: boolean;
  isNew: boolean;
  wholesalePrice: number;
  retailPrice: number;
  retailCompareAtPrice?: number | null;
  wholesaleCompareAtPrice?: number | null;
  slug?: string;
  wholesaleIsDiscounted?: boolean;
  retailIsDiscounted?: boolean;
  discountType?: 'PERCENT' | 'FIXED' | null;
  discountPercent?: number | null;
  discountAmount?: number | null;
  discountStartsAt?: string | null;
  discountEndsAt?: string | null;
  wholesaleDiscountType?: 'PERCENT' | 'FIXED' | null;
  retailDiscountType?: 'PERCENT' | 'FIXED' | null;
  wholesaleDiscountPercent?: number | null;
  retailDiscountPercent?: number | null;
  wholesaleDiscountAmount?: number | null;
  retailDiscountAmount?: number | null;
  wholesaleDiscountStartsAt?: string | null;
  retailDiscountStartsAt?: string | null;
  wholesaleDiscountEndsAt?: string | null;
  retailDiscountEndsAt?: string | null;
  packQty?: number;
  retailFullContent?: string | null;
  wholesaleFullContent?: string | null;
  legacyContent?: string | null;
  relatedProductIds?: string[];
  relatedProducts?: Array<{
    id: string;
    name: string;
    sku?: string;
    images?: string[];
  }>;
  careInstructions?: Record<string, unknown> | null;
  faqItems?: Array<{ question: string; answer: string }> | null;
  sale?: {
    active: boolean;
    payable: number;
    original: number | null;
    badgePercent: number;
  };
  showOnWholesale?: boolean;
  showOnRetail?: boolean;
  retailFeatured?: boolean;
  minOrderQty: number;
  allowWholesaleColorSelect?: boolean;
  minWholesaleColors?: number;
  stock?: number;
  wholesaleStock?: number;
  retailStock?: number;
  totalStock?: number;
  images: string[];
  variants: Array<{
    id: string;
    color: string;
    colorHex: string;
    size: string;
    stock: number;
    wholesaleStock?: number;
    retailStock?: number;
    barcode?: string;
    imageUrl?: string | null;
  }>;
  specs?: ProductSpecs;
  sizeType?: 'TWO' | 'THREE' | 'FREE';
  isDiscounted?: boolean;
  isLimitedStock?: boolean;
  createdAt?: string;
  description?: string;
  seoMeta?: {
    title?: string;
    description?: string;
    focusKeyword?: string;
    canonical?: string;
    wholesaleTitle?: string;
    wholesaleDescription?: string;
    wholesaleFocusKeyword?: string;
    wholesaleCanonical?: string;
    retailTitle?: string;
    retailDescription?: string;
    retailFocusKeyword?: string;
    retailCanonical?: string;
  };
  categoryId?: string;
  collectionId?: string | null;
  isPreOrder?: boolean;
  preOrderDate?: string | null;
  modelInfo?: string | null;
  videoUrl?: string | null;
  fabricComposition?: string;
  badgeSettings?: { limitedStockMultiplier?: number; newBadgeDays?: number };
}

interface ProductsResult {
  data: Product[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export async function searchAdminProducts(search: string): Promise<Product[]> {
  const query = new URLSearchParams();
  query.set('status', 'ALL');
  query.set('limit', '20');
  if (search.trim()) query.set('search', search.trim());
  const res = await apiClient.get<ProductsResult>(`/products?${query}`);
  return Array.isArray(res?.data) ? res.data : [];
}

export function useProducts(params?: { page?: number; limit?: number; search?: string; fabric?: string; status?: string }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (params?.page) query.set('page', String(params.page));
      if (params?.limit) query.set('limit', String(params.limit));
      if (params?.search) query.set('search', params.search);
      if (params?.fabric) query.set('fabric', params.fabric);
      if (params?.status) query.set('status', params.status);
      const res = await apiClient.get<ProductsResult>(`/products?${query}`);
      setProducts(res.data);
      setMeta(res.meta);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'خطا در دریافت محصولات');
    } finally {
      setLoading(false);
    }
  }, [params?.page, params?.search, params?.fabric, params?.status]);

  useEffect(() => { fetch(); }, [fetch]);

  return { products, meta, loading, error, refetch: fetch };
}

export function useProduct(id: string) {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    apiClient.get<Product>(`/products/${id}`)
      .then(setProduct)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  return { product, loading, error };
}
