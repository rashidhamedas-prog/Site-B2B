'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../api';

export interface Customer {
  id: string;
  code: string;
  businessName: string;
  ownerName: string;
  phone: string;
  phone2?: string;
  email?: string;
  city: string;
  province: string;
  address?: string;
  postalCode?: string;
  nationalId?: string;
  segment: string;
  status: string;
  type: string;
  businessType: string;
  channel?: 'RETAIL' | 'WHOLESALE';
  balance: number;
  creditLimit: number;
  notes?: string;
  savedAddresses?: Array<{
    id: string;
    recipient: string;
    mobile: string;
    province: string;
    city: string;
    street: string;
    postalCode?: string;
    isDefault?: boolean;
  }>;
  createdAt: string;
}

interface CustomersResult {
  data: Customer[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export function useCustomers(params?: {
  page?: number;
  search?: string;
  segment?: string;
  channel?: string;
  status?: string;
}) {
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
      if (params?.channel) query.set('channel', params.channel);
      if (params?.status) query.set('status', params.status);
      const res = await apiClient.get<CustomersResult>(`/customers?${query}`);
      setCustomers(res.data);
      setMeta(res.meta);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'خطا');
    } finally {
      setLoading(false);
    }
  }, [params?.page, params?.search, params?.segment, params?.channel, params?.status]);

  useEffect(() => { fetch(); }, [fetch]);

  return { customers, meta, loading, error, refetch: fetch };
}

export function useCustomer(id: string) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      setCustomer(await apiClient.get<Customer>(`/customers/${id}`));
    } catch (e: unknown) {
      setCustomer(null);
      setError(e instanceof Error ? e.message : 'خطا');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void reload(); }, [reload]);
  return { customer, loading, error, reload };
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
