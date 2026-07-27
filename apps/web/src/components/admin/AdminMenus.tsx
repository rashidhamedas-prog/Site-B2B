'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Save, Loader2, AlertCircle, CheckCircle, Plus, Trash2,
  ChevronUp, ChevronDown, GripVertical, Menu,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/cn';
import { DEFAULT_MENUS, DEFAULT_RETAIL_MENUS, type MenuItem, type MenusSettings } from '@/lib/menus';
import { AdminChannelTabs, channelLabel, type AdminChannel } from './AdminChannelTabs';

type MenuKey = 'main' | 'footer' | 'mobile' | 'legal';

const TABS: { id: MenuKey; label: string }[] = [
  { id: 'main', label: 'منوی اصلی' },
  { id: 'mobile', label: 'منوی موبایل' },
  { id: 'footer', label: 'منوی فوتر' },
  { id: 'legal', label: 'لینک‌های حقوقی' },
];

function newId() {
  return `m_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function isMenusSettings(v: unknown): v is MenusSettings {
  return !!v && typeof v === 'object' && Array.isArray((v as MenusSettings).main);
}

function defaultsFor(channel: AdminChannel): MenusSettings {
  return channel === 'RETAIL' ? DEFAULT_RETAIL_MENUS : DEFAULT_MENUS;
}

function normalizeMenus(raw: MenusSettings | undefined, channel: AdminChannel): MenusSettings {
  const base = defaultsFor(channel);
  if (!raw) return { ...base };
  return {
    ...base,
    ...raw,
    main: raw.main?.length ? raw.main : base.main,
    footer: raw.footer?.length ? raw.footer : base.footer,
    mobile: raw.mobile?.length ? raw.mobile : base.main,
    legal: raw.legal?.length ? raw.legal : base.legal,
  };
}

function pickChannelMenus(
  menus: unknown,
  channel: AdminChannel,
): MenusSettings {
  if (!menus || typeof menus !== 'object') {
    return normalizeMenus(undefined, channel);
  }
  const obj = menus as Record<string, unknown>;
  const nestedKey = channel === 'RETAIL' ? 'retail' : 'wholesale';
  if (isMenusSettings(obj[nestedKey])) {
    return normalizeMenus(obj[nestedKey] as MenusSettings, channel);
  }
  // Flat legacy menus = wholesale; retail falls back to DEFAULT_RETAIL_MENUS
  if (isMenusSettings(menus) && Array.isArray((menus as MenusSettings).main)) {
    if (channel === 'WHOLESALE') return normalizeMenus(menus as MenusSettings, channel);
    return normalizeMenus(undefined, 'RETAIL');
  }
  return normalizeMenus(undefined, channel);
}

export function AdminMenus() {
  const [channel, setChannel] = useState<AdminChannel>('WHOLESALE');
  const [tab, setTab] = useState<MenuKey>('main');
  const [data, setData] = useState<MenusSettings | null>(null);
  const [rawMenus, setRawMenus] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const load = useCallback(async (ch: AdminChannel) => {
    setLoading(true);
    try {
      const res = await apiClient.get<{ menus?: unknown }>('/settings/admin');
      setRawMenus(res.menus ?? null);
      setData(pickChannelMenus(res.menus, ch));
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(channel); }, [channel, load]);

  const save = async () => {
    if (!data) return;
    setSaving(true);
    try {
      // Prefer channel-aware body; also keep nested { wholesale, retail } for dual-site
      const nested: Record<string, MenusSettings> = {};
      if (rawMenus && typeof rawMenus === 'object') {
        const r = rawMenus as Record<string, unknown>;
        if (isMenusSettings(r.wholesale)) nested.wholesale = r.wholesale;
        if (isMenusSettings(r.retail)) nested.retail = r.retail;
        // Migrate flat → wholesale if needed
        if (!nested.wholesale && isMenusSettings(rawMenus) && 'main' in (rawMenus as object)) {
          nested.wholesale = rawMenus as MenusSettings;
        }
      }
      nested[channel === 'RETAIL' ? 'retail' : 'wholesale'] = data;

      await apiClient.put('/settings/admin/menus', {
        channel,
        ...data,
        wholesale: nested.wholesale,
        retail: nested.retail,
      });
      setRawMenus(nested);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      alert(e?.message ?? 'خطا در ذخیره منو');
    } finally {
      setSaving(false);
    }
  };

  const setList = (key: MenuKey, list: MenuItem[]) => {
    setData((prev) => (prev ? { ...prev, [key]: list } : prev));
  };

  const move = (key: MenuKey, from: number, to: number) => {
    if (!data) return;
    const list = [...data[key]];
    if (to < 0 || to >= list.length) return;
    const [item] = list.splice(from, 1);
    list.splice(to, 0, item);
    setList(key, list);
  };

  const onDrop = (key: MenuKey, to: number) => {
    if (dragIndex === null || dragIndex === to) {
      setDragIndex(null);
      return;
    }
    move(key, dragIndex, to);
    setDragIndex(null);
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="card p-8 text-center">
        <AlertCircle className="mx-auto mb-3 h-10 w-10 text-error" />
        <p className="font-medium text-gray-700">بارگذاری منو ناموفق بود</p>
        <button type="button" onClick={() => load(channel)} className="btn btn-primary btn-sm mt-4 cursor-pointer">تلاش مجدد</button>
      </div>
    );
  }

  const list = data[tab];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-900">مدیریت منوها</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            منوهای سایت {channelLabel(channel)} — با کشیدن و رها کردن مرتب کنید
          </p>
        </div>
        <AdminChannelTabs value={channel} onChange={setChannel} />
      </div>

      <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-gray-100 p-4">
        <div>
          <p className="text-sm font-medium text-gray-800">فعال‌سازی مگا‌منو</p>
          <p className="mt-0.5 text-[11px] text-gray-400">نمایش زیرمجموعه‌ها با تصویر بندانگشتی در دسکتاپ</p>
        </div>
        <button
          type="button"
          onClick={() => setData((p) => (p ? { ...p, megaEnabled: !p.megaEnabled } : p))}
          className={cn(
            'relative h-6 w-11 flex-shrink-0 cursor-pointer rounded-full transition-colors',
            data.megaEnabled ? 'bg-primary' : 'bg-gray-200',
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
              data.megaEnabled ? 'right-0.5' : 'right-[calc(100%-1.375rem)]',
            )}
          />
        </button>
      </label>

      <div className="flex flex-wrap gap-1 border-b border-gray-100">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'cursor-pointer -mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
              tab === t.id
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:border-gray-200 hover:text-gray-800',
            )}
          >
            <Menu className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      <div className="card max-w-3xl space-y-3 p-4">
        <div className="flex justify-end">
          <button
            type="button"
            className="btn btn-outline btn-sm cursor-pointer"
            onClick={() =>
              setList(tab, [
                ...list,
                { id: newId(), label: 'لینک جدید', href: channel === 'RETAIL' ? '/retail/' : '/', highlight: false, children: [] },
              ])
            }
          >
            <Plus className="h-3.5 w-3.5" />
            افزودن آیتم
          </button>
        </div>

        {list.map((item, index) => (
          <div
            key={item.id}
            draggable
            onDragStart={() => setDragIndex(index)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => onDrop(tab, index)}
            className="rounded-xl border border-gray-100 bg-white p-3"
          >
            <div className="flex items-start gap-2">
              <button type="button" className="mt-2 cursor-grab text-gray-300 active:cursor-grabbing" aria-label="جابه‌جایی">
                <GripVertical className="h-5 w-5" />
              </button>
              <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
                <input
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  value={item.label}
                  onChange={(e) => {
                    const next = [...list];
                    next[index] = { ...item, label: e.target.value };
                    setList(tab, next);
                  }}
                  placeholder="عنوان"
                />
                <input
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono"
                  dir="ltr"
                  value={item.href}
                  onChange={(e) => {
                    const next = [...list];
                    next[index] = { ...item, href: e.target.value };
                    setList(tab, next);
                  }}
                  placeholder="/path"
                />
              </div>
              <div className="flex flex-col gap-1">
                <button type="button" className="btn btn-ghost btn-sm cursor-pointer px-2" onClick={() => move(tab, index, index - 1)}>
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button type="button" className="btn btn-ghost btn-sm cursor-pointer px-2" onClick={() => move(tab, index, index + 1)}>
                  <ChevronDown className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm cursor-pointer px-2 text-error"
                  onClick={() => setList(tab, list.filter((_, i) => i !== index))}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {tab === 'main' && (
              <div className="mt-3 space-y-2 border-t border-gray-50 pt-3">
                <label className="flex items-center gap-2 text-xs text-gray-600">
                  <input
                    type="checkbox"
                    checked={!!item.highlight}
                    onChange={(e) => {
                      const next = [...list];
                      next[index] = { ...item, highlight: e.target.checked };
                      setList(tab, next);
                    }}
                  />
                  دکمه برجسته (مثل کلکسیون لینن)
                </label>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-gray-500">زیرمنو / مگا‌منو</p>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm cursor-pointer text-xs"
                    onClick={() => {
                      const next = [...list];
                      next[index] = {
                        ...item,
                        children: [
                          ...(item.children ?? []),
                          {
                            id: newId(),
                            label: 'زیرمنو',
                            href: channel === 'RETAIL' ? '/retail/products' : '/products',
                            imageUrl: '',
                            description: '',
                          },
                        ],
                      };
                      setList(tab, next);
                    }}
                  >
                    <Plus className="h-3 w-3" /> زیرمنو
                  </button>
                </div>
                {(item.children ?? []).map((child, ci) => (
                  <div key={child.id} className="grid grid-cols-1 gap-2 rounded-lg bg-gray-50 p-2 sm:grid-cols-3">
                    <input
                      className="rounded border border-gray-200 px-2 py-1.5 text-xs"
                      value={child.label}
                      onChange={(e) => {
                        const next = [...list];
                        const children = [...(item.children ?? [])];
                        children[ci] = { ...child, label: e.target.value };
                        next[index] = { ...item, children };
                        setList(tab, next);
                      }}
                      placeholder="عنوان"
                    />
                    <input
                      className="rounded border border-gray-200 px-2 py-1.5 text-xs font-mono"
                      dir="ltr"
                      value={child.href}
                      onChange={(e) => {
                        const next = [...list];
                        const children = [...(item.children ?? [])];
                        children[ci] = { ...child, href: e.target.value };
                        next[index] = { ...item, children };
                        setList(tab, next);
                      }}
                      placeholder="/href"
                    />
                    <div className="flex gap-1">
                      <input
                        className="flex-1 rounded border border-gray-200 px-2 py-1.5 text-xs font-mono"
                        dir="ltr"
                        value={child.imageUrl ?? ''}
                        onChange={(e) => {
                          const next = [...list];
                          const children = [...(item.children ?? [])];
                          children[ci] = { ...child, imageUrl: e.target.value };
                          next[index] = { ...item, children };
                          setList(tab, next);
                        }}
                        placeholder="image URL"
                      />
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm cursor-pointer text-error px-2"
                        onClick={() => {
                          const next = [...list];
                          next[index] = {
                            ...item,
                            children: (item.children ?? []).filter((_, i) => i !== ci),
                          };
                          setList(tab, next);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="sticky bottom-0 flex items-center gap-4 border-t border-gray-100 bg-white/95 py-3 backdrop-blur">
        <button type="button" onClick={save} disabled={saving} className="btn btn-primary btn-md flex cursor-pointer items-center gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          ذخیره منوها
        </button>
        {saved && (
          <p className="flex items-center gap-1.5 text-sm font-medium text-success">
            <CheckCircle className="h-4 w-4" />
            ذخیره شد
          </p>
        )}
      </div>
    </div>
  );
}
