'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { DEFAULT_MENUS, type MenusSettings } from '@/lib/menus';

const TTL_MS = 60_000;

type CacheEntry = { at: number; data: MenusSettings };
let cache: CacheEntry | null = null;
let inflight: Promise<MenusSettings> | null = null;

function normalizeMenus(raw: MenusSettings | undefined | null): MenusSettings {
  if (!raw) return DEFAULT_MENUS;
  return {
    ...DEFAULT_MENUS,
    ...raw,
    main: raw.main?.length ? raw.main : DEFAULT_MENUS.main,
    footer: raw.footer?.length ? raw.footer : DEFAULT_MENUS.footer,
    mobile: raw.mobile?.length
      ? raw.mobile
      : raw.main?.length
        ? raw.main
        : DEFAULT_MENUS.main,
    legal: raw.legal?.length ? raw.legal : DEFAULT_MENUS.legal,
  };
}

/** Seed module cache from SSR so Header+Footer share one client fetch if needed. */
export function seedMenusCache(menus: MenusSettings): void {
  cache = { at: Date.now(), data: normalizeMenus(menus) };
}

async function loadMenus(): Promise<MenusSettings> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;
  if (inflight) return inflight;

  inflight = apiClient
    .get<{ menus?: MenusSettings }>('/settings/public')
    .then((res) => {
      const next = normalizeMenus(res?.menus);
      cache = { at: Date.now(), data: next };
      return next;
    })
    .catch(() => cache?.data ?? DEFAULT_MENUS)
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

export function useMenus(options?: {
  initial?: MenusSettings | null;
  skipNetwork?: boolean;
}) {
  const skip = Boolean(options?.skipNetwork || options?.initial);
  const [menus, setMenus] = useState<MenusSettings>(() =>
    options?.initial ? normalizeMenus(options.initial) : (cache?.data ?? DEFAULT_MENUS),
  );
  const [loading, setLoading] = useState(!skip && !cache);

  useEffect(() => {
    if (options?.initial) {
      const next = normalizeMenus(options.initial);
      seedMenusCache(next);
      setMenus(next);
      setLoading(false);
      return;
    }
    if (options?.skipNetwork) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void loadMenus().then((next) => {
      if (cancelled) return;
      setMenus(next);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [options?.initial, options?.skipNetwork, skip]);

  return { menus, loading };
}
