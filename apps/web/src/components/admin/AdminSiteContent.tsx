'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Save, Loader2, CheckCircle, Image as ImageIcon } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { AdminChannelTabs, channelLabel, type AdminChannel } from './AdminChannelTabs';
import { AdminBlockEditor, type ContentBlock } from './AdminBlockEditor';
import { cn } from '@/lib/cn';

const PAGE_KEYS_BASE = [
  { key: 'home', label: 'صفحه اصلی' },
  { key: 'about', label: 'درباره ما' },
  { key: 'contact', label: 'تماس با ما' },
  { key: 'shipping', label: 'شرایط ارسال' },
  { key: 'returns', label: 'مرجوعی' },
  { key: 'products', label: 'محصولات' },
  { key: 'collections', label: 'کالکشن‌ها' },
  { key: 'privacy', label: 'حریم خصوصی' },
  { key: 'terms', label: 'شرایط و قوانین' },
] as const;

const WHOLESALE_ONLY = { key: 'wholesale', label: 'شرایط عمده' } as const;

interface SiteContent {
  id?: string;
  channel: string;
  pageKey: string;
  title: string;
  blocks: ContentBlock[];
  seo?: Record<string, string> | null;
  isPublished?: boolean;
}

export function AdminSiteContent() {
  const [channel, setChannel] = useState<AdminChannel>('WHOLESALE');
  const pageKeys = useMemo(
    () => (channel === 'WHOLESALE' ? [...PAGE_KEYS_BASE, WHOLESALE_ONLY] : [...PAGE_KEYS_BASE]),
    [channel],
  );
  const [pageKey, setPageKey] = useState<string>('home');
  const [title, setTitle] = useState('');
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!pageKeys.some((p) => p.key === pageKey)) {
      setPageKey('home');
    }
  }, [pageKeys, pageKey]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let data: SiteContent | null = null;
      try {
        data = await apiClient.get<SiteContent>(
          `/cms/admin/site-content/${channel}/${pageKey}`,
        );
      } catch {
        const list = await apiClient.get<SiteContent[]>(
          `/cms/admin/site-content?channel=${channel}`,
        ).catch(() => [] as SiteContent[]);
        data = (Array.isArray(list) ? list : []).find((x) => x.pageKey === pageKey) ?? null;
      }
      const label = pageKeys.find((p) => p.key === pageKey)?.label ?? pageKey;
      setTitle(data?.title || label);
      setBlocks(Array.isArray(data?.blocks) ? (data!.blocks as ContentBlock[]) : []);
    } catch {
      const label = pageKeys.find((p) => p.key === pageKey)?.label ?? pageKey;
      setTitle(label);
      setBlocks([]);
    } finally {
      setLoading(false);
    }
  }, [channel, pageKey, pageKeys]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      await apiClient.put('/cms/admin/site-content', {
        channel,
        pageKey,
        title,
        blocks,
        isPublished: true,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'خطا در ذخیره محتوا');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-900">محتوای بصری</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            هیرو، بنر و بلوک‌های محتوا — {channelLabel(channel)}
          </p>
        </div>
        <AdminChannelTabs value={channel} onChange={setChannel} />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {pageKeys.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setPageKey(p.key)}
            className={cn(
              'cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
              pageKey === p.key
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="card max-w-3xl space-y-4 p-5">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <ImageIcon className="h-4 w-4" />
            ویرایش محتوای صفحه «{pageKeys.find((p) => p.key === pageKey)?.label}»
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">عنوان صفحه</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <AdminBlockEditor blocks={blocks} onChange={setBlocks} />

          <div className="sticky bottom-0 flex items-center gap-4 border-t border-gray-100 bg-white/95 py-3 backdrop-blur">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="btn btn-primary btn-md flex cursor-pointer items-center gap-2"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              ذخیره محتوا
            </button>
            {saved && (
              <p className="flex items-center gap-1.5 text-sm font-medium text-success">
                <CheckCircle className="h-4 w-4" />
                ذخیره شد
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
