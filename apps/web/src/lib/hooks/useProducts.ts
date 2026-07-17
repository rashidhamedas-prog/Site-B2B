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
  packQty?: string;
  length?: string;
  length2?: string;
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
  minOrderQty: number;
  images: string[];
  variants: Array<{ id: string; color: string; colorHex: string; size: string; stock: number; barcode?: string }>;
  specs?: ProductSpecs;
  sizeType?: 'TWO' | 'THREE' | 'FREE';
  isDiscounted?: boolean;
  isLimitedStock?: boolean;
  createdAt?: string;
  description?: string;
  categoryId?: string;
  fabricComposition?: string;
}

interface ProductsResult {
  data: Product[];
  meta: { page: number; limit: number; total: number; totalPages: number };
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
