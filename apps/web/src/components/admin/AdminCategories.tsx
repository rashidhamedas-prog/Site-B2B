'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, Plus, Save, Trash2 } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useImageUpload } from '@/lib/hooks/useImageUpload';
import { AdminChannelTabs, type AdminChannel } from './AdminChannelTabs';
import { AdminExcelExportButtons } from './AdminExcelExportButtons';

type FaqItem = { question: string; answer: string };

type Category = {
  id: string;
  name: string;
  skuPrefix: string;
  nextSequence: number;
  bannerUrl?: string | null;
  slug?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  h1?: string | null;
  introText?: string | null;
  bottomContent?: string | null;
  isIndexable?: boolean;
  sortOrder?: number;
  faqItems?: FaqItem[] | null;
  wholesaleH1?: string | null;
  wholesaleSeoTitle?: string | null;
  wholesaleSeoDescription?: string | null;
  wholesaleIntroText?: string | null;
  wholesaleBottomContent?: string | null;
};

const EMPTY_FAQ: FaqItem[] = [
  { question: '', answer: '' },
  { question: '', answer: '' },
];

function wordCount(text: string | null | undefined): number {
  return (text ?? '').trim().split(/\s+/).filter(Boolean).length;
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

export function AdminCategories() {
  const [items, setItems] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [newPrefix, setNewPrefix] = useState('');
  const [newBanner, setNewBanner] = useState('');
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({});
  const [seoTab, setSeoTab] = useState<Record<string, AdminChannel>>({});
  const { upload, uploading } = useImageUpload();

  const patchItem = (id: string, patch: Partial<Category>) =>
    setItems((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x)));

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
  }, []);

  const create = async () => {
    if (!newName.trim()) return;
    setSavingId('new');
    setError('');
    try {
      await apiClient.post('/categories', {
        name: newName.trim(),
        slug: newSlug.trim() || undefined,
        skuPrefix: newPrefix.trim(),
        bannerUrl: newBanner.trim() || null,
      });
      setNewName('');
      setNewSlug('');
      setNewPrefix('');
      setNewBanner('');
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'ایجاد دسته‌بندی ناموفق بود');
    } finally {
      setSavingId(null);
    }
  };

  const save = async (c: Category) => {
    setSavingId(c.id);
    setError('');
    try {
      await apiClient.patch(`/categories/${c.id}`, {
        name: c.name,
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
        sortOrder: Number.isFinite(Number(c.sortOrder)) ? Number(c.sortOrder) : 0,
        faqItems: cleanFaq(c.faqItems),
        wholesaleH1: c.wholesaleH1?.trim() || null,
        wholesaleSeoTitle: c.wholesaleSeoTitle?.trim() || null,
        wholesaleSeoDescription: c.wholesaleSeoDescription?.trim() || null,
        wholesaleIntroText: c.wholesaleIntroText?.trim() || null,
        wholesaleBottomContent: c.wholesaleBottomContent?.trim() || null,
      });
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'ذخیره دسته‌بندی ناموفق بود');
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
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'حذف دسته‌بندی ناموفق بود');
    } finally {
      setSavingId(null);
    }
  };

  const onUpload = async (id: string | 'new', file: File | undefined) => {
    if (!file) return;
    const url = await upload(file);
    if (id === 'new') {
      setNewBanner(url);
      return;
    }
    patchItem(id, { bannerUrl: url });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">دسته‌بندی‌ها</h1>
          <p className="text-sm text-gray-500 mt-1">
            مدیریت دسته‌بندی‌ها، سئوی تکی/عمده، فرمول SKU، و بنر مربعی ۱:۱ برای صفحه اصلی تکی
          </p>
        </div>
        <AdminExcelExportButtons kind="categories" />
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      <div className="card p-5 space-y-3">
        <h2 className="text-sm font-bold text-gray-800">افزودن دسته‌بندی</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">نام</label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full input-base"
              placeholder="مثلاً مانتو لینن"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">اسلاگ</label>
            <input
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value)}
              className="w-full input-base"
              placeholder="manto-linen"
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">پیشوند SKU</label>
            <input
              value={newPrefix}
              onChange={(e) => setNewPrefix(e.target.value)}
              className="w-full input-base"
              placeholder="LINEN-"
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">بنر ۱:۱ (URL)</label>
            <input
              value={newBanner}
              onChange={(e) => setNewBanner(e.target.value)}
              className="w-full input-base"
              placeholder="/media/..."
              dir="ltr"
            />
            <label className="mt-1 inline-flex cursor-pointer text-xs text-primary">
              آپلود تصویر
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploading}
                onChange={(e) => onUpload('new', e.target.files?.[0])}
              />
            </label>
          </div>
          <button
            onClick={create}
            disabled={savingId === 'new'}
            className="btn btn-primary btn-md mt-6 sm:mt-0 flex items-center justify-center gap-2"
          >
            <Plus className="h-4 w-4" />
            افزودن
          </button>
        </div>
        <p className="text-xs text-gray-400">
          نمونه SKU: <span className="font-mono">LINEN-00001</span> — بنر مربعی برای شبکه ۳×۳ صفحه تکی
        </p>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-gray-900">لیست</h2>
          <button onClick={load} className="btn btn-outline btn-sm" disabled={loading}>
            بروزرسانی
          </button>
        </div>

        {loading ? (
          <div className="p-6 text-sm text-gray-500">در حال بارگذاری...</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {items.map((c) => {
              const open = !!openIds[c.id];
              const tab = seoTab[c.id] ?? 'RETAIL';
              const introWords = wordCount(tab === 'RETAIL' ? c.introText : c.wholesaleIntroText);
              return (
                <div key={c.id} className="p-4 space-y-4">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
                    <div className="lg:col-span-3">
                      <label className="block text-xs text-gray-600 mb-1">نام</label>
                      <input
                        value={c.name}
                        onChange={(e) => patchItem(c.id, { name: e.target.value })}
                        className="w-full input-base"
                      />
                    </div>
                    <div className="lg:col-span-2">
                      <label className="block text-xs text-gray-600 mb-1">اسلاگ</label>
                      <input
                        dir="ltr"
                        value={c.slug ?? ''}
                        onChange={(e) => patchItem(c.id, { slug: e.target.value })}
                        className="w-full input-base"
                        placeholder="manto"
                      />
                    </div>
                    <div className="lg:col-span-2">
                      <label className="block text-xs text-gray-600 mb-1">پیشوند SKU</label>
                      <input
                        dir="ltr"
                        value={c.skuPrefix ?? ''}
                        onChange={(e) => patchItem(c.id, { skuPrefix: e.target.value })}
                        className="w-full input-base"
                      />
                    </div>
                    <div className="lg:col-span-1">
                      <label className="block text-xs text-gray-600 mb-1">Seq</label>
                      <input
                        type="number"
                        min={1}
                        value={c.nextSequence ?? 1}
                        onChange={(e) =>
                          patchItem(c.id, { nextSequence: Number(e.target.value) || 1 })
                        }
                        className="w-full input-base"
                      />
                    </div>
                    <div className="lg:col-span-1">
                      <label className="block text-xs text-gray-600 mb-1">ترتیب</label>
                      <input
                        type="number"
                        value={c.sortOrder ?? 0}
                        onChange={(e) =>
                          patchItem(c.id, { sortOrder: Number(e.target.value) || 0 })
                        }
                        className="w-full input-base"
                      />
                    </div>
                    <div className="lg:col-span-3">
                      <label className="block text-xs text-gray-600 mb-1">بنر ۱:۱</label>
                      <div className="flex items-center gap-2">
                        {c.bannerUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={
                              c.bannerUrl.startsWith('http') || c.bannerUrl.startsWith('/')
                                ? c.bannerUrl
                                : `/media/${c.bannerUrl}`
                            }
                            alt=""
                            className="h-12 w-12 rounded object-cover ring-1 ring-gray-200"
                          />
                        ) : (
                          <div className="h-12 w-12 rounded bg-gray-100 ring-1 ring-gray-200" />
                        )}
                        <div className="min-w-0 flex-1">
                          <input
                            dir="ltr"
                            value={c.bannerUrl ?? ''}
                            onChange={(e) => patchItem(c.id, { bannerUrl: e.target.value })}
                            className="w-full input-base text-xs"
                            placeholder="/media/..."
                          />
                          <label className="mt-1 inline-flex cursor-pointer text-xs text-primary">
                            آپلود
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              disabled={uploading}
                              onChange={(e) => onUpload(c.id, e.target.files?.[0])}
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={c.isIndexable !== false}
                        onChange={(e) => patchItem(c.id, { isIndexable: e.target.checked })}
                      />
                      قابل ایندکس (isIndexable)
                    </label>
                    <button
                      type="button"
                      onClick={() => setOpenIds((p) => ({ ...p, [c.id]: !p[c.id] }))}
                      className="btn btn-outline btn-sm inline-flex items-center gap-1.5"
                    >
                      <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
                      سئو تکی / عمده
                    </button>
                    <button
                      onClick={() => save(c)}
                      disabled={savingId === c.id}
                      className={cn(
                        'btn btn-primary btn-sm flex items-center gap-1.5',
                        savingId === c.id && 'opacity-60',
                      )}
                    >
                      <Save className="h-4 w-4" /> ذخیره
                    </button>
                    <button
                      onClick={() => remove(c.id)}
                      disabled={savingId === c.id}
                      className="btn btn-outline btn-sm text-error flex items-center gap-1.5"
                    >
                      <Trash2 className="h-4 w-4" /> حذف
                    </button>
                  </div>

                  {open ? (
                    <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-4 space-y-4">
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
                            <Field
                              label="متن مقدمه (حدود ۸۰ تا ۱۵۰ کلمه)"
                              value={c.introText ?? ''}
                              onChange={(v) => patchItem(c.id, { introText: v })}
                              multiline
                              rows={5}
                              hint={`${introWords.toLocaleString('fa-IR')} کلمه`}
                              hintTone={introWords >= 80 && introWords <= 150 ? 'ok' : 'warn'}
                            />
                          </div>
                          <div className="lg:col-span-2">
                            <Field
                              label="محتوای پایین صفحه"
                              value={c.bottomContent ?? ''}
                              onChange={(v) => patchItem(c.id, { bottomContent: v })}
                              multiline
                              rows={6}
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
                            <Field
                              label="متن مقدمه عمده (حدود ۸۰ تا ۱۵۰ کلمه)"
                              value={c.wholesaleIntroText ?? ''}
                              onChange={(v) => patchItem(c.id, { wholesaleIntroText: v })}
                              multiline
                              rows={5}
                              hint={`${introWords.toLocaleString('fa-IR')} کلمه`}
                              hintTone={introWords >= 80 && introWords <= 150 ? 'ok' : 'warn'}
                            />
                          </div>
                          <div className="lg:col-span-2">
                            <Field
                              label="محتوای پایین صفحه عمده"
                              value={c.wholesaleBottomContent ?? ''}
                              onChange={(v) => patchItem(c.id, { wholesaleBottomContent: v })}
                              multiline
                              rows={6}
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
            {items.length === 0 && (
              <div className="p-6 text-sm text-gray-500">هیچ دسته‌بندی‌ای ثبت نشده است.</div>
            )}
          </div>
        )}
      </div>
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
          className="input-base w-full min-h-[6rem]"
        />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} dir={dir} className="input-base w-full" />
      )}
      {hint ? (
        <p className={cn('mt-1 text-[11px]', hintTone === 'ok' ? 'text-emerald-600' : hintTone === 'warn' ? 'text-amber-600' : 'text-gray-400')}>
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
      <p className="text-xs text-gray-400">جفت سؤال/جواب — به صورت آرایه JSON برای اسکیما ذخیره می‌شود.</p>
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
                className="btn btn-outline btn-sm text-error self-start"
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
