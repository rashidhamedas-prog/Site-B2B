'use client';

import { useState, useEffect, useCallback } from 'react';
import { emptyStatusCounts } from '@taranom/shared-types';
import { apiClient } from '../api';

export interface OrderCustomer {
  id?: string;
  businessName?: string;
  ownerName?: string;
  phone?: string;
  city?: string;
  province?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerId: string;
  status: string;
  type?: string;
  subtotal: number;
  shippingFee: number;
  total: number;
  paymentMethod: string;
  shippingMethod: string;
  trackingCode?: string;
  notes?: string;
  createdAt: string;
  customer?: OrderCustomer;
  items: Array<{
    id: string;
    productName: string;
    sku: string;
    color: string;
    size: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
}

interface OrdersResult {
  data: Order[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export function useOrders(params?: { page?: number; customerId?: string; status?: string; type?: string }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (params?.page) query.set('page', String(params.page));
      if (params?.customerId) query.set('customerId', params.customerId);
      if (params?.status) query.set('status', params.status);
      if (params?.type) query.set('type', params.type);
      const res = await apiClient.get<OrdersResult>(`/orders?${query}`);
      setOrders(res.data);
      setMeta(res.meta);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'خطا');
    } finally {
      setLoading(false);
    }
  }, [params?.page, params?.customerId, params?.status, params?.type]);

  useEffect(() => { fetch(); }, [fetch]);

  return { orders, meta, loading, error, refetch: fetch };
}

export function useOrderStatusCounts(type?: string) {
  const [counts, setCounts] = useState<Record<string, number>>(emptyStatusCounts);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const query = type ? `?type=${encodeURIComponent(type)}` : '';
      const res = await apiClient.get<Record<string, number>>(`/orders/status-counts${query}`);
      setCounts({ ...emptyStatusCounts(), ...res });
    } catch {
      setCounts(emptyStatusCounts());
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => { fetch(); }, [fetch]);

  return { counts, loading, refetch: fetch };
}

export function useCreateOrder() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createOrder = async (data: {
    customerId: string;
    items: Array<{ productVariantId: string; quantity: number; unitPrice: number; productName: string; sku: string; color: string; size: string }>;
    shippingMethod?: string;
    paymentMethod?: string;
    notes?: string;
  }) => {
    setLoading(true);
    setError(null);
    try {
      const order = await apiClient.post<Order>('/orders', data);
      return order;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'خطا در ثبت سفارش');
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { createOrder, loading, error };
}
