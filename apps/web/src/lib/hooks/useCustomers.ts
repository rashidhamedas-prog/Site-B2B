'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../api';

export interface Customer {
  id: string;
  code: string;
  businessName: string;
  ownerName: string;
  phone: string;
  city: string;
  province: string;
  segment: string;
  status: string;
  balance: number;
  creditLimit: number;
  createdAt: string;
}

interface CustomersResult {
  data: Customer[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export function useCustomers(params?: { page?: number; search?: string; segment?: string }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (params?.page) query.set('page', String(params.page));
      if (params?.search) query.set('search', params.search);
      if (params?.segment) query.set('segment', params.segment);
      const res = await apiClient.get<CustomersResult>(`/customers?${query}`);
      setCustomers(res.data);
      setMeta(res.meta);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'خطا');
    } finally {
      setLoading(false);
    }
  }, [params?.page, params?.search, params?.segment]);

  useEffect(() => { fetch(); }, [fetch]);

  return { customers, meta, loading, error, refetch: fetch };
}

export function useUpdateCustomerSegment() {
  const [loading, setLoading] = useState(false);

  const update = async (id: string, segment: string) => {
    setLoading(true);
    try {
      await apiClient.patch(`/customers/${id}/segment`, { segment });
      return true;
    } catch {
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { update, loading };
}
