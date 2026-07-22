'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { DEFAULT_MENUS, type MenusSettings } from '@/lib/menus';

export function useMenus() {
  const [menus, setMenus] = useState<MenusSettings>(DEFAULT_MENUS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<{ menus?: MenusSettings }>('/settings/public')
      .then((res) => {
        if (cancelled || !res?.menus) return;
        setMenus({
          ...DEFAULT_MENUS,
          ...res.menus,
          main: res.menus.main?.length ? res.menus.main : DEFAULT_MENUS.main,
          footer: res.menus.footer?.length ? res.menus.footer : DEFAULT_MENUS.footer,
          mobile: res.menus.mobile?.length ? res.menus.mobile : res.menus.main?.length ? res.menus.main : DEFAULT_MENUS.main,
          legal: res.menus.legal?.length ? res.menus.legal : DEFAULT_MENUS.legal,
        });
      })
      .catch(() => { /* defaults */ })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { menus, loading };
}
