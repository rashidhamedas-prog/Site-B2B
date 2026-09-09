'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Save, Loader2, CheckCircle, Image as ImageIcon, RotateCcw, Sparkles } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { AdminChannelTabs, channelLabel, type AdminChannel } from './AdminChannelTabs';
import { AdminBlockEditor, type ContentBlock } from './AdminBlockEditor';
import { CMS_PAGE_KEYS_BASE, CMS_WHOLESALE_ONLY, getDefaultBlocks } from '@/lib/cms/defaults';
import { productsBlockPropsForSave } from '@/lib/cms/products-block';
import { revalidateStorefrontAfterSave } from '@/lib/cms/revalidate-client';
import { cn } from '@/lib/cn';

interface SiteContent {
  id?: string;
  channel: string;
  pageKey: string;
  title: string;
  blocks: ContentBlock[];
  seo?: Record<string, string> | null;
  isPublished?: boolean;
  updatedAt?: string;
}

const CHANNEL_STORAGE_KEY = 'admin.cms.channel';

function isAdminChannel(value: unknown): value is AdminChannel {
  return value === 'RETAIL' || value === 'WHOLESALE';
}

function readInitialChannel(): AdminChannel {
  if (typeof window === 'undefined') return 'WHOLESALE';
  const fromUrl = new URLSearchParams(window.location.search).get('channel');
  if (isAdminChannel(fromUrl)) return fromUrl;
  try {
    const stored = window.localStorage.getItem(CHANNEL_STORAGE_KEY);
    if (isAdminChannel(stored)) return stored;
  } catch {
    /* ignore */
  }
  return 'WHOLESALE';
}

function prepareBlocksForSave(list: ContentBlock[], channel: AdminChannel): ContentBlock[] {
  return list.map((block) => {
    if (block.type !== 'products') return block;
    return {
      ...block,
      props: productsBlockPropsForSave(block.props || {}, channel),
    };
  });
}

export function AdminSiteContent() {
  const [channel, setChannel] = useState<AdminChannel>(readInitialChannel);
  const pageKeys = useMemo(
    () => (channel === 'WHOLESALE' ? [...CMS_PAGE_KEYS_BASE, CMS_WHOLESALE_ONLY] : [...CMS_PAGE_KEYS_BASE]),
    [channel],
  );
  const [pageKey, setPageKey] = useState<string>('home');
  const [title, setTitle] = useState('');
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [saved, setSaved] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!pageKeys.some((p) => p.key === pageKey)) {
      setPageKey('home');
    }
  }, [pageKeys, pageKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem(CHANNEL_STORAGE_KEY, channel);
    } catch {
      /* ignore */
    }
    const url = new URL(window.location.href);
    if (url.searchParams.get('channel') !== channel) {
      url.searchParams.set('channel', channel);
      window.history.replaceState({}, '', `${url.pathname}${url.search}`);
    }
  }, [channel]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let data: SiteContent | null = null;
      try {
        data = await apiClient.get<SiteContent>(
          `/cms/admin/site-content/${channel}/${pageKey}`,
        );
      } catch {
        const list = await apiClient
          .get<SiteContent[]>(`/cms/admin/site-content?channel=${channel}`)
          .catch(() => [] as SiteContent[]);
        data = (Array.isArray(list) ? list : []).find((x) => x.pageKey === pageKey) ?? null;
      }
      const label = pageKeys.find((p) => p.key === pageKey)?.label ?? pageKey;
      setTitle(data?.title || label);
      setBlocks(Array.isArray(data?.blocks) ? (data!.blocks as ContentBlock[]) : []);
      setLastSavedAt(data?.updatedAt || null);
    } catch {
      const label = pageKeys.find((p) => p.key === pageKey)?.label ?? pageKey;
      setTitle(label);
      setBlocks([]);
      setLastSavedAt(null);
    } finally {
      setLoading(false);
    }
  }, [channel, pageKey, pageKeys]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const prepared = prepareBlocksForSave(blocks, channel);
      const payload = {
        channel,
        pageKey,
        title,
        blocks: prepared,
        isPublished: true,
      };
      const savedRow = await apiClient.put<SiteContent>(
        `/cms/admin/site-content?channel=${encodeURIComponent(channel)}`,
        payload,
      );
      if (!isAdminChannel(savedRow?.channel) || savedRow.channel !== channel) {
        throw new Error(
          `ذخیره روی کانال اشتباه برگشت (انتظار ${channelLabel(channel)}، دریافت ${savedRow?.channel || 'نامشخص'})`,
        );
      }
      if (savedRow.pageKey && savedRow.pageKey !== pageKey) {
        throw new Error(`ذخیره روی صفحه اشتباه برگشت (${savedRow.pageKey})`);
      }

      // Prove persistence from DB, not just the PUT echo.
      const verified = await apiClient.get<SiteContent>(
        `/cms/admin/site-content/${channel}/${pageKey}`,
      );
      if (!verified || verified.channel !== channel) {
        throw new Error(`بعد از ذخیره، محتوای ${channelLabel(channel)} از سرور خوانده نشد`);
      }

      setBlocks(Array.isArray(verified.blocks) ? (verified.blocks as ContentBlock[]) : prepared);
      setTitle(verified.title || title);
      setLastSavedAt(verified.updatedAt || savedRow.updatedAt || null);

      const bust = await revalidateStorefrontAfterSave(channel, pageKey);
      if (!bust.ok) {
        alert(
          `محتوای ${channelLabel(channel)} در دیتابیس ذخیره شد، ولی تازه‌سازی ویترین ناموفق بود` +
            (bust.error ? ` (${bust.error})` : '') +
            '. یک‌بار دیگر ذخیره کنید یا تا ۶۰ ثانیه صبر کنید.',
        );
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'خطا در ذخیره محتوا');
    } finally {
      setSaving(false);
    }
  };

  const loadDefaults = () => {
    if (blocks.length > 0 && !confirm('محتوای فعلی جایگزین پیش‌فرض‌ها می‌شود. ادامه؟')) return;
    const defaults = getDefaultBlocks(channel, pageKey);
    setBlocks(defaults);
    const label = pageKeys.find((p) => p.key === pageKey)?.label ?? pageKey;
    if (!title) setTitle(label);
  };

  const seedAllPages = async () => {
    if (
      !confirm(
        `تمام صفحات ${channelLabel(channel)} با محتوای پیش‌فرض ذخیره شوند؟ (صفحات موجود بازنویسی می‌شوند)`,
      )
    ) {
      return;
    }
    setSeeding(true);
    try {
      for (const p of pageKeys) {
        const defaults = getDefaultBlocks(channel, p.key);
        const savedRow = await apiClient.put<SiteContent>(
          `/cms/admin/site-content?channel=${encodeURIComponent(channel)}`,
          {
            channel,
            pageKey: p.key,
            title: p.label,
            blocks: prepareBlocksForSave(defaults as ContentBlock[], channel),
            isPublished: true,
          },
        );
        if (savedRow?.channel !== channel) {
          throw new Error(`ذخیره ${p.label} روی کانال اشتباه برگشت`);
        }
      }
      await load();
      const bust = await revalidateStorefrontAfterSave(channel, '*');
      if (!bust.ok) {
        alert(
          `پیش‌فرض‌های ${channelLabel(channel)} ذخیره شد، ولی تازه‌سازی ویترین ناموفق بود` +
            (bust.error ? ` (${bust.error})` : '') +
            '.',
        );
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'خطا در بارگذاری پیش‌فرض‌ها');
    } finally {
      setSeeding(false);
    }
  };

  const pageLabel = pageKeys.find((p) => p.key === pageKey)?.label ?? pageKey;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">تنظیمات محتوای سایت</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            ویرایش / حذف / افزودن تمام متن‌ها، لینک‌ها، تصاویر و شمارنده‌ها — در حال ویرایش:{' '}
            <strong className={channel === 'RETAIL' ? 'text-amber-700' : 'text-primary'}>
              {channelLabel(channel)}
            </strong>
          </p>
        </div>
        <AdminChannelTabs value={channel} onChange={setChannel} />
      </div>

      <div
        className={cn(
          'rounded-xl border px-4 py-3 text-sm',
          channel === 'RETAIL'
            ? 'border-amber-200 bg-amber-50 text-amber-950'
            : 'border-primary/20 bg-primary/5 text-gray-800',
        )}
      >
        {channel === 'RETAIL' ? (
          <>
            الان محتوای <strong>سایت تکی</strong> (poshaktaranom.ir) را ویرایش می‌کنید. ذخیره فقط همین
            کانال را عوض می‌کند؛ سایت عمده جداست.
          </>
        ) : (
          <>
            الان محتوای <strong>سایت عمده</strong> (poshaktaranom.com) را ویرایش می‌کنید. برای ویترین
            .ir حتماً تب «سایت تکی» را بزنید.
          </>
        )}
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
                ? channel === 'RETAIL'
                  ? 'bg-amber-600 text-white'
                  : 'bg-primary text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="text-primary h-8 w-8 animate-spin" />
        </div>
      ) : (
        <div className="card max-w-4xl space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-500">
            <div className="flex flex-wrap items-center gap-2">
              <ImageIcon className="h-4 w-4" />
              ویرایش «{pageLabel}» — {channelLabel(channel)}
              {lastSavedAt ? (
                <span className="text-[11px] text-gray-400" dir="ltr">
                  آخرین ذخیره DB: {new Date(lastSavedAt).toLocaleString('fa-IR')}
                </span>
              ) : (
                <span className="text-[11px] text-amber-700">هنوز ردیفی برای این صفحه در DB نیست</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={loadDefaults}
                className="btn btn-outline btn-sm flex cursor-pointer items-center gap-1.5"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                پیش‌فرض این صفحه
              </button>
              <button
                type="button"
                onClick={seedAllPages}
                disabled={seeding}
                className="btn btn-outline btn-sm flex cursor-pointer items-center gap-1.5"
              >
                {seeding ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                ذخیره پیش‌فرض همه صفحات
              </button>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">عنوان صفحه</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="focus:ring-primary/30 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2"
            />
          </div>

          <AdminBlockEditor blocks={blocks} onChange={setBlocks} channel={channel} />

          <div className="sticky bottom-0 flex flex-wrap items-center gap-4 border-t border-gray-100 bg-white/95 py-3 backdrop-blur">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className={cn(
                'btn btn-md flex cursor-pointer items-center gap-2 text-white',
                channel === 'RETAIL' ? 'bg-amber-600 hover:bg-amber-700' : 'btn-primary',
              )}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              ذخیره روی سایت {channelLabel(channel)}
            </button>
            {saved && (
              <p className="text-success flex items-center gap-1.5 text-sm font-medium">
                <CheckCircle className="h-4 w-4" />
                ذخیره و تأیید شد ({channelLabel(channel)} / {pageLabel})
              </p>
            )}
            <span className="hidden text-[11px] text-gray-500 sm:inline">
              اگر ویترین فوری عوض نشد تا ۶۰ ثانیه صبر کنید یا یک‌بار hard refresh بزنید.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
