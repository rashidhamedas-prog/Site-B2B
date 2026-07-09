'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../api';

export interface Invoice {
  id: string;
  invoiceNumber: string;
  type: string;
  status: string;
  subtotal: number;
  total: number;
  paidAmount: number;
  dueDate?: string;
  createdAt: string;
  customer?: { businessName: string; phone: string };
}

interface InvoicesResult {
  data: Invoice[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export function useInvoices(params?: { page?: number; customerId?: string }) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
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
      const res = await apiClient.get<InvoicesResult>(`/invoices?${query}`);
      setInvoices(res.data);
      setMeta(res.meta);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'خطا');
    } finally {
      setLoading(false);
    }
  }, [params?.page, params?.customerId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { invoices, meta, loading, error, refetch: fetch };
}
