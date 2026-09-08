'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../api';

export type MarketingChannel = 'RETAIL' | 'WHOLESALE';

export function useMarketingBoard(channel: MarketingChannel) {
  const [data, setData] = useState<{ stages: Array<{ stage: string; count: number }>; settings: { enabled: boolean; mode: string } } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await apiClient.get(`/marketing/board?channel=${channel}`));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'خطا');
    } finally {
      setLoading(false);
    }
  }, [channel]);
  useEffect(() => { void reload(); }, [reload]);
  return { data, loading, error, reload };
}

export function useMarketingQueue(channel?: MarketingChannel) {
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const q = channel ? `?channel=${channel}` : '';
      const res = await apiClient.get<{ items: Array<Record<string, unknown>> }>(`/marketing/queue${q}`);
      setItems(res.items || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [channel]);
  useEffect(() => { void reload(); }, [reload]);
  return { items, loading, reload };
}

export function useMarketingHub(channel: MarketingChannel) {
  const [templates, setTemplates] = useState<Array<Record<string, unknown>>>([]);
  const [automations, setAutomations] = useState<{ global: { enabled: boolean; mode: string }; scenarios: Array<Record<string, unknown>> } | null>(null);
  const [settings, setSettings] = useState<Record<string, unknown> | null>(null);
  const [dispatches, setDispatches] = useState<Array<Record<string, unknown>>>([]);
  const reload = useCallback(async () => {
    const [t, a, s, d] = await Promise.all([
      apiClient.get<{ data: Array<Record<string, unknown>> }>(`/marketing/templates?channel=${channel}`),
      apiClient.get<{ global: { enabled: boolean; mode: string }; scenarios: Array<Record<string, unknown>> }>('/marketing/automations'),
      apiClient.get<Record<string, unknown>>('/marketing/settings'),
      apiClient.get<{ data: Array<Record<string, unknown>> }>(`/marketing/dispatches?channel=${channel}`),
    ]);
    setTemplates(t.data || []);
    setAutomations(a);
    setSettings(s);
    setDispatches(d.data || []);
  }, [channel]);
  useEffect(() => { void reload().catch(() => undefined); }, [reload]);
  return { templates, automations, settings, dispatches, reload };
}

export function useCustomerDossier(id: string) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await apiClient.get(`/customers/${id}/marketing`));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'خطا');
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => { void reload(); }, [reload]);
  return { data, loading, error, reload };
}
