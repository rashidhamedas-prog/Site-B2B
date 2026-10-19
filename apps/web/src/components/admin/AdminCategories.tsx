'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ImagePlus,
  Plus,
  Save,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import {
  categoryCtaFromUnknown,
  defaultCategoryCta,
  serializeCategoryCta,
  type CategoryCtaConfig,
} from '@/lib/catalog/category-cta';
import { cn } from '@/lib/cn';
import { revalidateStorefrontAfterSave } from '@/lib/cms/revalidate-client';
import { useImageUpload } from '@/lib/hooks/useImageUpload';
import { AdminChannelTabs, type AdminChannel } from './AdminChannelTabs';
import { AdminExcelExportButtons } from './AdminExcelExportButtons';

const CategoryCopyEditor = dynamic(
  () => import('./CategoryCopyEditor').then((m) => m.CategoryCopyEditor),
  { ssr: false, loading: () => <div className="min-h-[6rem] rounded-lg bg-gray-100" /> },
);

type FaqItem = { question: string; answer: string };

type Category = {
  id: string;
  name: string;
  skuPrefix: string;
  nextSequence: number;
  bannerUrl?: string | null;
  slug?: string | null;
  nameEn?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  h1?: string | null;
  introText?: string | null;
  bottomContent?: string | null;
  isIndexable?: boolean;
  showOnHome?: boolean;
  sortOrder?: number;
  faqItems?: FaqItem[] | null;
  cta?: CategoryCtaConfig | null;
  wholesaleH1?: string | null;
  wholesaleSeoTitle?: string | null;
  wholesaleSeoDescription?: string | null;
  wholesaleIntroText?: string | null;
  wholesaleBottomContent?: string | null;
  wholesaleCta?: CategoryCtaConfig | null;
  status?: string;
};

const EMPTY_FAQ: FaqItem[] = [
  { question: '', answer: '' },
  { question: '', answer: '' },
];

function wordCount(text: string | null | undefined): number {
  const plain = (text ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ');
  return plain.trim().split(/\s+/).filter(Boolean).length;
}

function retailTitlePreview(name: string, seoTitle?: string | null) {
  const custom = seoTitle?.trim();
  return custom || `خرید ${name.trim() || '…'} زنانه | پوشاک ترنم`;
}

function wholesaleTitlePreview(name: string, seoTitle?: string | null) {
  const custom = seoTitle?.trim();
  return custom || `خرید عمده ${name.trim() || '…'} زنانه | تولیدی ترنم مشهد`;
}

function defaultFaq(channel: AdminChannel): FaqItem[] {
  if (channel === 'WHOLESALE') {
    return [
      {
        question: 'حداقل سفارش چقدر است؟',
        answer:
          'حداقل سفارش در محصول از 6 عدد به بالا می باشد. مقدار دقیق هر مدل هنگام ثبت سفارش نمایش داده می‌شود.',
      },
      {
        question: 'ارسال به شهرستان دارید؟',
        answer:
          'بله، سفارش‌های عمده پس از آماده‌سازی و بسته‌بندی برای مشتریان شهرهای مختلف ایران ارسال می‌شوند.',
      },
      {
        question: 'رنگ و سایز هر مدل را از کجا ببینم؟',
        answer: 'رنگ‌بندی و سایزبندی فعال هر محصول در کارت و صفحه جزئیات همان مدل نمایش داده می‌شود.',
      },
    ];
  }
  return [
    {
      question: 'آیا رنگ محصول دقیقاً مشابه عکس است؟',
      answer:
        'تلاش می‌شود تصاویر با نور و رنگ نزدیک به محصول واقعی ثبت شوند؛ با این حال نمایش رنگ ممکن است در صفحه‌نمایش‌های مختلف کمی متفاوت باشد.',
    },
    {
      question: 'چگونه سایز مناسب را انتخاب کنم؟',
      answer:
        'اندازه‌های درج‌شده در صفحه همان محصول را با یکی از لباس‌های مناسب خود مقایسه کنید. مبنای انتخاب، جدول اندازه هر مدل است.',
    },
    {
      question: 'نحوه شستشو چگونه است؟',
      answer:
        'دستور مراقبت هر محصول براساس جنس پارچه در بخش توضیحات و مراقبت همان مدل درج می‌شود.',
    },
  ];
}

function faqList(items?: FaqItem[] | null): FaqItem[] {
  return items && items.length > 0 ? items : EMPTY_FAQ;
}

function cleanFaq(items?: FaqItem[] | null): FaqItem[] {
  return (items ?? []).filter((f) => f.question.trim() || f.answer.trim());
}

function bannerSrc(url?: string | null) {
  if (!url) return '';
  if (url.startsWith('http') || url.startsWith('/')) return url;
  return `/media/${url}`;
}

export function AdminCategories() {
  const [items, setItems] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [rowError, setRowError] = useState<Record<string, string>>({});
  const [okFlash, setOkFlash] = useState<Record<string, string>>({});
  const [query, setQuery] = useState('');
  const [homeFilter, setHomeFilter] = useState<'all' | 'on' | 'off'>('all');
  const [newName, setNewName] = useState('');
  const [newNameEn, setNewNameEn] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [newPrefix, setNewPrefix] = useState('');
  const [newBanner, setNewBanner] = useState('');
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({});
  const [seoTab, setSeoTab] = useState<Record<string, AdminChannel>>({});
  const { upload, uploading } = useImageUpload('categoryBanner');
  const flashTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const patchItem = (id: string, patch: Partial<Category>) =>
    setItems((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const flashOk = (id: string, message: string) => {
    setOkFlash((p) => ({ ...p, [id]: message }));
    if (flashTimers.current[id]) clearTimeout(flashTimers.current[id]);
    flashTimers.current[id] = setTimeout(() => {
      setOkFlash((p) => {
        const next = { ...p };
        delete next[id];
        return next;
      });
    }, 2200);
  };

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiClient.get<Category[]>('/categories/admin');
      setItems(res ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'بارگذاری دسته‌بندی‌ها ناموفق بود');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => undefined);
    return () => {
      Object.values(flashTimers.current).forEach(clearTimeout);
    };
  }, []);

  const bustCatalogStorefront = async () => {
    await Promise.all([
      revalidateStorefrontAfterSave('RETAIL', 'home'),
      revalidateStorefrontAfterSave('WHOLESALE', 'home'),
    ]);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((c) => {
      if (homeFilter === 'on' && c.showOnHome === false) return false;
      if (homeFilter === 'off' && c.showOnHome !== false) return false;
      if (!q) return true;
      const hay = [c.name, c.nameEn, c.slug, c.skuPrefix]
        .map((s) => (s || '').toLowerCase())
        .join(' ');
      return hay.includes(q);
    });
  }, [items, query, homeFilter]);

  const homeOnCount = items.filter((c) => c.showOnHome !== false).length;

  const create = async () => {
    if (!newName.trim()) return;
    setSavingId('new');
    setError('');
    try {
      await apiClient.post('/categories', {
        name: newName.trim(),
        nameEn: newNameEn.trim() || null,
        slug: newSlug.trim() || undefined,
        skuPrefix: newPrefix.trim(),
        bannerUrl: newBanner.trim() || null,
        showOnHome: true,
      });
      setNewName('');
      setNewNameEn('');
      setNewSlug('');
      setNewPrefix('');
      setNewBanner('');
      await load();
      void bustCatalogStorefront();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'ایجاد دسته‌بندی ناموفق بود');
    } finally {
      setSavingId(null);
    }
  };

  const save = async (c: Category) => {
    setSavingId(c.id);
    setError('');
    setRowError((p) => {
      const next = { ...p };
      delete next[c.id];
      return next;
    });
    try {
      await apiClient.patch(`/categories/${c.id}`, {
        name: c.name,
        nameEn: c.nameEn?.trim() || null,
        skuPrefix: c.skuPrefix,
        nextSequence: c.nextSequence,
        bannerUrl: c.bannerUrl?.trim() || null,
        slug: c.slug?.trim() || null,
        h1: c.h1?.trim() || null,
        seoTitle: c.seoTitle?.trim() || null,
        seoDescription: c.seoDescription?.trim() || null,
        introText: c.introText?.trim() || null,
        bottomContent: c.bottomContent?.trim() || null,
        isIndexable: c.isIndexable !== false,
        showOnHome: c.showOnHome !== false,
        sortOrder: Number.isFinite(Number(c.sortOrder)) ? Number(c.sortOrder) : 0,
        faqItems: cleanFaq(c.faqItems),
        cta: serializeCategoryCta(categoryCtaFromUnknown(c.cta)),
        wholesaleH1: c.wholesaleH1?.trim() || null,
        wholesaleSeoTitle: c.wholesaleSeoTitle?.trim() || null,
        wholesaleSeoDescription: c.wholesaleSeoDescription?.trim() || null,
        wholesaleIntroText: c.wholesaleIntroText?.trim() || null,
        wholesaleBottomContent: c.wholesaleBottomContent?.trim() || null,
        wholesaleCta: serializeCategoryCta(categoryCtaFromUnknown(c.wholesaleCta)),
      });
      await load();
      void bustCatalogStorefront();
      flashOk(c.id, 'ذخیره شد');
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'ذخیره دسته‌بندی ناموفق بود';
      setError(message);
      setRowError((p) => ({ ...p, [c.id]: message }));
    } finally {
      setSavingId(null);
    }
  };

  const toggleFlag = async (
    c: Category,
    key: 'showOnHome' | 'isIndexable',
    checked: boolean,
  ) => {
    const previous = c[key];
    patchItem(c.id, { [key]: checked });
    setSavingId(c.id);
    setRowError((p) => {
      const next = { ...p };
      delete next[c.id];
      return next;
    });
    try {
      await apiClient.patch(`/categories/${c.id}`, { [key]: checked });
      void bustCatalogStorefront();
      flashOk(
        c.id,
        key === 'showOnHome'
          ? checked
            ? 'در صفحه اول نمایش داده می‌شود'
            : 'از صفحه اول برداشته شد'
          : checked
            ? 'قابل ایندکس'
            : 'noindex شد',
      );
    } catch (e: unknown) {
      patchItem(c.id, { [key]: previous });
      const message = e instanceof Error ? e.message : 'به‌روزرسانی ناموفق بود';
      setRowError((p) => ({ ...p, [c.id]: message }));
    } finally {
      setSavingId(null);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('حذف دسته‌بندی؟')) return;
    setSavingId(id);
    setError('');
    try {
      await apiClient.delete(`/categories/${id}`);
      await load();
      void bustCatalogStorefront();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'حذف دسته‌بندی ناموفق بود');
    } finally {
      setSavingId(null);
    }
  };

  const onUpload = async (id: string | 'new', file: File | undefined) => {
    if (!file) return;
    setError('');
    try {
      const url = await upload(file);
      if (id === 'new') {
        setNewBanner(url);
        return;
      }
      patchItem(id, { bannerUrl: url });
      setSavingId(id);
      await apiClient.patch(`/categories/${id}`, { bannerUrl: url });
      void bustCatalogStorefront();
      flashOk(id, 'بنر بهینه شد و ذخیره شد');
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'آپلود بنر ناموفق بود';
      setError(message);
      if (id !== 'new') setRowError((p) => ({ ...p, [id]: message }));
    } finally {
      if (id !== 'new') setSavingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">دسته‌بندی‌ها</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            تیک «نمایش در صفحه اول» بلافاصله روی شبکهٔ هوم تکی و عمده اعمال می‌شود. منو و ناو همچنان همهٔ
            دسته‌های فعال را نشان می‌دهند. بنر مربعی ۱:۱ هنگام آپلود فشرده و به ۱۲۰۰×۱۲۰۰ WebP تبدیل
            می‌شود.
          </p>
          <p className="mt-2 text-xs text-gray-400">
            {items.length.toLocaleString('fa-IR')} دسته ·{' '}
            {homeOnCount.toLocaleString('fa-IR')} تا روی صفحه اول
          </p>
        </div>
        <AdminExcelExportButtons kind="categories" />
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="card space-y-3 p-5">
        <h2 className="text-sm font-bold text-gray-800">افزودن دسته‌بندی</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div>
            <label className="mb-1 block text-xs text-gray-600">نام فارسی</label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="input-base w-full"
              placeholder="مثلاً کت زنانه"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-600">نام انگلیسی (آدرس)</label>
            <input
              value={newNameEn}
              onChange={(e) => setNewNameEn(e.target.value)}
              className="input-base w-full"
              placeholder="women coats"
              dir="ltr"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-600">اسلاگ</label>
            <input
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value)}
              className="input-base w-full"
              placeholder="manto-linen"
              dir="ltr"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-600">پیشوند SKU</label>
            <input
              value={newPrefix}
              onChange={(e) => setNewPrefix(e.target.value)}
              className="input-base w-full"
              placeholder="LINEN-"
              dir="ltr"
            />
          </div>
          <BannerDropzone
            url={newBanner}
            uploading={uploading}
            onUrlChange={setNewBanner}
            onFile={(file) => onUpload('new', file)}
          />
          <button
            type="button"
            onClick={create}
            disabled={savingId === 'new' || !newName.trim()}
            className="btn btn-primary btn-md mt-6 flex items-center justify-center gap-2 sm:mt-0"
          >
            <Plus className="h-4 w-4" />
            افزودن
          </button>
        </div>
      </div>

      <div className="card overflow-hidden p-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 p-4">
          <h2 className="font-bold text-gray-900">لیست</h2>
          <div className="relative min-w-[12rem] flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="input-base w-full pe-3 ps-9 text-sm"
              placeholder="جستجو نام، اسلاگ، SKU…"
            />
          </div>
          <div className="flex rounded-lg border border-gray-200 p-0.5 text-xs">
            {(
              [
                ['all', 'همه'],
                ['on', 'روی هوم'],
                ['off', 'مخفی از هوم'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setHomeFilter(id)}
                className={cn(
                  'rounded-md px-2.5 py-1.5 transition-colors',
                  homeFilter === id
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-600 hover:bg-gray-50',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <button type="button" onClick={load} className="btn btn-outline btn-sm" disabled={loading}>
            بروزرسانی
          </button>
        </div>

        {loading ? (
          <div className="p-6 text-sm text-gray-500">در حال بارگذاری...</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map((c) => {
              const open = !!openIds[c.id];
              const tab = seoTab[c.id] ?? 'RETAIL';
              const introWords = wordCount(tab === 'RETAIL' ? c.introText : c.wholesaleIntroText);
              const busy = savingId === c.id;
              return (
                <div key={c.id} className="space-y-3 p-4">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-start">
                    <BannerDropzone
                      url={c.bannerUrl}
                      uploading={uploading && busy}
                      compact
                      onUrlChange={(v) => patchItem(c.id, { bannerUrl: v })}
                      onFile={(file) => onUpload(c.id, file)}
                    />

                    <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-6">
                      <div className="sm:col-span-2">
                        <label className="mb-1 block text-[11px] text-gray-500">نام فارسی</label>
                        <input
                          value={c.name}
                          onChange={(e) => patchItem(c.id, { name: e.target.value })}
                          className="input-base w-full"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] text-gray-500">انگلیسی</label>
                        <input
                          dir="ltr"
                          value={c.nameEn ?? ''}
                          onChange={(e) => patchItem(c.id, { nameEn: e.target.value })}
                          className="input-base w-full"
                          placeholder="crop"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] text-gray-500">اسلاگ</label>
                        <input
                          dir="ltr"
                          value={c.slug ?? ''}
                          onChange={(e) => patchItem(c.id, { slug: e.target.value })}
                          className="input-base w-full"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] text-gray-500">SKU</label>
                        <input
                          dir="ltr"
                          value={c.skuPrefix ?? ''}
                          onChange={(e) => patchItem(c.id, { skuPrefix: e.target.value })}
                          className="input-base w-full"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="mb-1 block text-[11px] text-gray-500">Seq</label>
                          <input
                            type="number"
                            min={1}
                            value={c.nextSequence ?? 1}
                            onChange={(e) =>
                              patchItem(c.id, { nextSequence: Number(e.target.value) || 1 })
                            }
                            className="input-base w-full"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] text-gray-500">ترتیب</label>
                          <input
                            type="number"
                            value={c.sortOrder ?? 0}
                            onChange={(e) =>
                              patchItem(c.id, { sortOrder: Number(e.target.value) || 0 })
                            }
                            className="input-base w-full"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <label
                      className={cn(
                        'inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors',
                        c.showOnHome !== false
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                          : 'border-gray-200 bg-white text-gray-600',
                      )}
                    >
                      <input
                        type="checkbox"
                        className="rounded border-gray-300"
                        checked={c.showOnHome !== false}
                        disabled={busy}
                        onChange={(e) => toggleFlag(c, 'showOnHome', e.target.checked)}
                      />
                      نمایش در صفحه اول
                    </label>
                    <label className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300"
                        checked={c.isIndexable !== false}
                        disabled={busy}
                        onChange={(e) => toggleFlag(c, 'isIndexable', e.target.checked)}
                      />
                      قابل ایندکس
                    </label>
                    <button
                      type="button"
                      onClick={() => setOpenIds((p) => ({ ...p, [c.id]: !p[c.id] }))}
                      className="btn btn-outline btn-sm inline-flex items-center gap-1.5"
                    >
                      <ChevronDown
                        className={cn('h-4 w-4 transition-transform', open && 'rotate-180')}
                      />
                      سئو تکی / عمده
                    </button>
                    <button
                      type="button"
                      onClick={() => save(c)}
                      disabled={busy}
                      className={cn(
                        'btn btn-primary btn-sm flex items-center gap-1.5',
                        busy && 'opacity-60',
                      )}
                    >
                      <Save className="h-4 w-4" /> ذخیره فیلدها
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(c.id)}
                      disabled={busy}
                      className="btn btn-outline btn-sm flex items-center gap-1.5 text-error"
                    >
                      <Trash2 className="h-4 w-4" /> حذف
                    </button>
                    {okFlash[c.id] ? (
                      <span className="text-xs font-medium text-emerald-700">{okFlash[c.id]}</span>
                    ) : null}
                  </div>

                  {rowError[c.id] ? (
                    <p className="text-sm text-red-700" role="alert">
                      {rowError[c.id]}
                    </p>
                  ) : null}

                  {open ? (
                    <div className="space-y-4 rounded-xl border border-gray-100 bg-gray-50/70 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <AdminChannelTabs
                          value={tab}
                          onChange={(ch) => setSeoTab((p) => ({ ...p, [c.id]: ch }))}
                        />
                        <p className="text-xs text-gray-500">
                          پیش‌نمایش عنوان:{' '}
                          <span className="font-medium text-gray-800">
                            {tab === 'RETAIL'
                              ? retailTitlePreview(c.name, c.seoTitle)
                              : wholesaleTitlePreview(c.name, c.wholesaleSeoTitle)}
                          </span>
                        </p>
                      </div>

                      {tab === 'RETAIL' ? (
                        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                          <Field
                            label="H1 تکی"
                            value={c.h1 ?? ''}
                            onChange={(v) => patchItem(c.id, { h1: v })}
                          />
                          <Field
                            label="عنوان سئو تکی"
                            value={c.seoTitle ?? ''}
                            onChange={(v) => patchItem(c.id, { seoTitle: v })}
                            hint={`اگر خالی باشد: ${retailTitlePreview(c.name, '')}`}
                          />
                          <div className="lg:col-span-2">
                            <Field
                              label="توضیح متا تکی"
                              value={c.seoDescription ?? ''}
                              onChange={(v) => patchItem(c.id, { seoDescription: v })}
                              multiline
                              rows={3}
                            />
                          </div>
                          <div className="lg:col-span-2">
                            <CategoryCopyEditor
                              label="متن مقدمه (حدود ۸۰ تا ۱۵۰ کلمه)"
                              value={c.introText ?? ''}
                              onChange={(v) => patchItem(c.id, { introText: v })}
                              hint={`${introWords.toLocaleString('fa-IR')} کلمه`}
                              hintTone={introWords >= 80 && introWords <= 150 ? 'ok' : 'warn'}
                            />
                          </div>
                          <div className="lg:col-span-2">
                            <CategoryCopyEditor
                              label="محتوای پایین صفحه"
                              value={c.bottomContent ?? ''}
                              onChange={(v) => patchItem(c.id, { bottomContent: v })}
                            />
                          </div>
                          <div className="lg:col-span-2">
                            <CategoryCtaEditor
                              channel="RETAIL"
                              value={categoryCtaFromUnknown(c.cta)}
                              onChange={(cta) => patchItem(c.id, { cta })}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                          <Field
                            label="H1 عمده"
                            value={c.wholesaleH1 ?? ''}
                            onChange={(v) => patchItem(c.id, { wholesaleH1: v })}
                          />
                          <Field
                            label="عنوان سئو عمده"
                            value={c.wholesaleSeoTitle ?? ''}
                            onChange={(v) => patchItem(c.id, { wholesaleSeoTitle: v })}
                            hint={`اگر خالی باشد: ${wholesaleTitlePreview(c.name, '')}`}
                          />
                          <div className="lg:col-span-2">
                            <Field
                              label="توضیح متا عمده"
                              value={c.wholesaleSeoDescription ?? ''}
                              onChange={(v) => patchItem(c.id, { wholesaleSeoDescription: v })}
                              multiline
                              rows={3}
                            />
                          </div>
                          <div className="lg:col-span-2">
                            <CategoryCopyEditor
                              label="متن مقدمه عمده (حدود ۸۰ تا ۱۵۰ کلمه)"
                              value={c.wholesaleIntroText ?? ''}
                              onChange={(v) => patchItem(c.id, { wholesaleIntroText: v })}
                              hint={`${introWords.toLocaleString('fa-IR')} کلمه`}
                              hintTone={introWords >= 80 && introWords <= 150 ? 'ok' : 'warn'}
                            />
                          </div>
                          <div className="lg:col-span-2">
                            <CategoryCopyEditor
                              label="محتوای پایین صفحه عمده"
                              value={c.wholesaleBottomContent ?? ''}
                              onChange={(v) => patchItem(c.id, { wholesaleBottomContent: v })}
                            />
                          </div>
                          <div className="lg:col-span-2">
                            <CategoryCtaEditor
                              channel="WHOLESALE"
                              value={categoryCtaFromUnknown(c.wholesaleCta)}
                              onChange={(wholesaleCta) => patchItem(c.id, { wholesaleCta })}
                            />
                          </div>
                        </div>
                      )}

                      <FaqEditor
                        items={faqList(c.faqItems)}
                        onChange={(faqItems) => patchItem(c.id, { faqItems })}
                        onFillDefaults={() => patchItem(c.id, { faqItems: defaultFaq(tab) })}
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="p-6 text-sm text-gray-500">
                {items.length === 0
                  ? 'هیچ دسته‌بندی‌ای ثبت نشده است.'
                  : 'نتیجه‌ای برای این فیلتر نیست.'}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function BannerDropzone({
  url,
  uploading,
  onUrlChange,
  onFile,
  compact,
}: {
  url?: string | null;
  uploading?: boolean;
  onUrlChange: (v: string) => void;
  onFile: (file: File | undefined) => void;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const src = bannerSrc(url);
  const size = compact ? 'h-20 w-20' : 'h-16 w-16';

  return (
    <div className={cn(compact ? 'shrink-0' : '')}>
      {!compact ? (
        <label className="mb-1 block text-xs text-gray-600">بنر ۱:۱</label>
      ) : null}
      <div
        className={cn(
          'flex items-center gap-2 rounded-xl border border-dashed border-gray-300 bg-gray-50/80 p-2',
          compact && 'flex-col border-solid bg-white p-1.5',
        )}
      >
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={cn(
            'relative overflow-hidden rounded-lg bg-gray-100 ring-1 ring-gray-200',
            size,
            uploading && 'opacity-60',
          )}
          aria-label="آپلود بنر دسته"
        >
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full flex-col items-center justify-center gap-0.5 text-gray-400">
              <ImagePlus className="h-5 w-5" />
              <span className="text-[10px]">۱:۱</span>
            </span>
          )}
        </button>
        <div className={cn('min-w-0', compact ? 'w-full' : 'flex-1')}>
          {!compact ? (
            <input
              dir="ltr"
              value={url ?? ''}
              onChange={(e) => onUrlChange(e.target.value)}
              className="input-base w-full text-xs"
              placeholder="/media/..."
            />
          ) : null}
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className={cn(
              'inline-flex items-center gap-1 text-xs font-medium text-primary',
              compact ? 'mt-1 w-full justify-center' : 'mt-1',
            )}
          >
            <Upload className="h-3.5 w-3.5" />
            {uploading ? 'در حال بهینه‌سازی…' : 'آپلود و بهینه‌سازی'}
          </button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          disabled={uploading}
          onChange={(e) => {
            onFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
}

function CategoryCtaEditor({
  channel,
  value,
  onChange,
}: {
  channel: AdminChannel;
  value: CategoryCtaConfig;
  onChange: (next: CategoryCtaConfig) => void;
}) {
  const patch = (partial: Partial<CategoryCtaConfig>) => onChange({ ...value, ...partial });
  const title =
    channel === 'WHOLESALE' ? 'تنظیمات دکمه CTA — سایت عمده' : 'تنظیمات دکمه CTA — سایت تک';
  const sampleLabel =
    channel === 'WHOLESALE' ? 'مشاهده مدل‌ها و خرید عمده' : 'مشاهده مدل‌ها و خرید آنلاین';

  return (
    <div className="space-y-3 rounded-xl border border-dashed border-primary/30 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-gray-800">{title}</h3>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            className="rounded border-gray-300"
            checked={value.enabled}
            onChange={(e) => patch({ enabled: e.target.checked })}
          />
          فعال
        </label>
      </div>
      <p className="text-xs text-gray-500">
        وقتی غیرفعال باشد هیچ دکمه‌ای در صفحه دسته نمایش داده نمی‌شود. مقصد «لیست محصولات» به{' '}
        <code className="rounded bg-gray-100 px-1" dir="ltr">
          #category-listing
        </code>{' '}
        وصل می‌شود.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field
          label="متن دکمه"
          value={value.label}
          onChange={(label) => patch({ label })}
          hint={!value.label.trim() ? `نمونه: ${sampleLabel}` : undefined}
        />
        <div>
          <label className="mb-1 block text-xs text-gray-600">مقصد دکمه</label>
          <select
            className="input-base w-full"
            value={value.destination}
            onChange={(e) =>
              patch({
                destination: e.target.value === 'custom' ? 'custom' : 'listing',
                customUrl: e.target.value === 'custom' ? value.customUrl : null,
              })
            }
          >
            <option value="listing">لیست محصولات همین صفحه</option>
            <option value="custom">لینک سفارشی</option>
          </select>
        </div>
        {value.destination === 'custom' ? (
          <div className="sm:col-span-2">
            <Field
              label="آدرس لینک سفارشی"
              value={value.customUrl ?? ''}
              onChange={(customUrl) => patch({ customUrl: customUrl.trim() || null })}
              dir="ltr"
              hint="مسیر داخلی مثل /products یا آدرس https معتبر"
            />
          </div>
        ) : null}
        <div>
          <label className="mb-1 block text-xs text-gray-600">محل نمایش</label>
          <select
            className="input-base w-full"
            value={value.placement}
            onChange={(e) =>
              patch({
                placement: e.target.value === 'below_bottom' ? 'below_bottom' : 'below_intro',
              })
            }
          >
            <option value="below_intro">زیر مقدمه (قبل از محصولات)</option>
            <option value="below_bottom">پایین صفحه (بعد از محتوا و FAQ)</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-600">ظاهر دکمه</label>
          <select
            className="input-base w-full"
            value={value.variant}
            onChange={(e) =>
              patch({ variant: e.target.value === 'secondary' ? 'secondary' : 'primary' })
            }
          >
            <option value="primary">اصلی</option>
            <option value="secondary">ثانویه</option>
          </select>
        </div>
      </div>
      <button
        type="button"
        className="btn btn-outline btn-sm"
        onClick={() => onChange(defaultCategoryCta())}
      >
        بازنشانی به غیرفعال
      </button>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  multiline,
  rows = 3,
  hint,
  hintTone,
  dir,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  rows?: number;
  hint?: string;
  hintTone?: 'ok' | 'warn';
  dir?: 'ltr' | 'rtl';
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-gray-600">{label}</label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          dir={dir}
          className="input-base min-h-[6rem] w-full"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          dir={dir}
          className="input-base w-full"
        />
      )}
      {hint ? (
        <p
          className={cn(
            'mt-1 text-[11px]',
            hintTone === 'ok'
              ? 'text-emerald-600'
              : hintTone === 'warn'
                ? 'text-amber-600'
                : 'text-gray-400',
          )}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function FaqEditor({
  items,
  onChange,
  onFillDefaults,
}: {
  items: FaqItem[];
  onChange: (items: FaqItem[]) => void;
  onFillDefaults: () => void;
}) {
  const update = (idx: number, patch: Partial<FaqItem>) =>
    onChange(items.map((item, i) => (i === idx ? { ...item, ...patch } : item)));

  return (
    <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-gray-800">سؤالات متداول (FAQ)</h3>
        <div className="flex gap-2">
          <button type="button" className="btn btn-outline btn-sm" onClick={onFillDefaults}>
            ۳ سؤال پیش‌فرض
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => onChange([...items, { question: '', answer: '' }])}
          >
            افزودن سؤال
          </button>
        </div>
      </div>
      <p className="text-xs text-gray-400">
        جفت سؤال/جواب — به صورت آرایه JSON برای اسکیما ذخیره می‌شود.
      </p>
      <div className="space-y-3">
        {items.map((item, idx) => (
          <div key={idx} className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            <input
              className="input-base w-full"
              value={item.question}
              onChange={(e) => update(idx, { question: e.target.value })}
              placeholder={`سؤال ${idx + 1}`}
            />
            <div className="flex gap-2">
              <textarea
                className="input-base min-h-[2.5rem] w-full"
                rows={2}
                value={item.answer}
                onChange={(e) => update(idx, { answer: e.target.value })}
                placeholder="جواب"
              />
              <button
                type="button"
                className="btn btn-outline btn-sm self-start text-error"
                onClick={() => onChange(items.filter((_, i) => i !== idx))}
                aria-label="حذف سؤال"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
