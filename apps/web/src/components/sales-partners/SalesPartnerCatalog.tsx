'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { mediaUrl, toman } from '@/lib/product-display';
import { SalesPartnerShell } from './SalesPartnerShell';

type CatalogItem = {
  id: string;
  name: string;
  slug: string | null;
  blurb: string | null;
  priceIrr: number;
  priceLabel: string;
  stockBand: 'in_stock' | 'low' | 'out_of_stock';
  stockLabel: string;
  estimatedCommissionIrr: number;
  commissionPercent: number;
  images: string[];
  productUrl: string;
  copyText: string;
  updatedAt: string;
};

type CatalogResponse = {
  items: CatalogItem[];
  page: number;
  total?: number;
};

export function SalesPartnerCatalog() {
  const [data, setData] = useState<CatalogResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedKind, setCopiedKind] = useState<'link' | 'text' | null>(null);

  useEffect(() => {
    apiClient
      .get<CatalogResponse>('/sales-partners/catalog')
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'بارگذاری کاتالوگ ناموفق بود'))
      .finally(() => setLoading(false));
  }, []);

  async function copyValue(item: CatalogItem, kind: 'link' | 'text') {
    const value = kind === 'link' ? item.productUrl : item.copyText;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(item.id);
      setCopiedKind(kind);
      setError(null);
    } catch {
      setCopiedId(item.id);
      setCopiedKind(null);
      setError('کپی خودکار ممکن نشد. لینک را از کادر انتخاب کنید.');
    }
  }

  return (
    <SalesPartnerShell title="محصولات قابل فروش">
      <p className="text-sm text-stone-600">
        لینک هر محصول مخصوص شماست. اگر مشتری از همان لینک خرید کند، پورسانت همان کالا بعد از پرداخت برایتان محاسبه می‌شود.
        هزینه ارسال و مبلغ کیف پول داخل پورسانت نیست. مبلغ روی کارت تخمینی است و تا تحویل سفارش قابل برداشت نمی‌شود.
      </p>
      {loading && <p className="mt-6 text-sm text-stone-600" role="status">در حال بارگذاری محصولات…</p>}
      {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
      {copiedId && copiedKind && (
        <p className="mt-3 text-sm text-emerald-800" role="status" aria-live="polite">
          {copiedKind === 'link' ? 'لینک فروش کپی شد.' : 'متن معرفی کپی شد.'}
        </p>
      )}
      {!loading && data && data.items.length === 0 && (
        <p className="mt-6 rounded-2xl border border-dashed border-stone-300 p-4 text-sm text-stone-600">
          هنوز محصولی برای فروش همکاران بازاریاب فعال نشده است. بعد از تأیید ادمین اینجا دیده می‌شود.
        </p>
      )}
      <ul className="mt-5 space-y-4">
        {data?.items.map((item, index) => {
          const src = mediaUrl(item.images[0]);
          return (
            <li key={item.id} className="overflow-hidden rounded-2xl border border-stone-200">
              <div className="relative aspect-[4/3] bg-stone-100">
                {src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={src} alt={item.name} className="h-full w-full object-cover" loading={index === 0 ? 'eager' : 'lazy'} />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-stone-500">بدون تصویر مجاز</div>
                )}
              </div>
              <div className="space-y-2 p-4">
                <h2 className="text-base font-bold">{item.name}</h2>
                {item.blurb && <p className="text-sm text-stone-600">{item.blurb}</p>}
                <p className="text-sm">
                  قیمت فعلی: <span className="tabular-nums font-medium">{item.priceLabel}</span>
                </p>
                <p className="text-sm text-stone-600">{item.stockLabel}</p>
                <p className="text-sm text-stone-600">
                  {item.commissionPercent > 0
                    ? `پورسانت تخمینی این قیمت: ${toman(item.estimatedCommissionIrr)} تومان (${item.commissionPercent}٪)`
                    : 'درصد پورسانت این محصول هنوز ثبت نشده. تا آن زمان پورسانت فروش از این لینک صفر است.'}
                </p>
                <label className="block text-sm" htmlFor={`sp-link-${item.id}`}>لینک فروش شما</label>
                <input
                  id={`sp-link-${item.id}`}
                  readOnly
                  value={item.productUrl}
                  dir="ltr"
                  className="min-h-11 w-full min-w-0 rounded-xl border border-stone-300 px-3 text-sm"
                  onFocus={(event) => event.currentTarget.select()}
                />
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    className="inline-flex min-h-11 items-center rounded-xl bg-[#1B5C4A] px-3 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B5C4A]"
                    onClick={() => void copyValue(item, 'link')}
                  >
                    کپی لینک فروش
                  </button>
                  <Link
                    href={`/sales-partners/orders/new?productId=${item.id}`}
                    className="inline-flex min-h-11 items-center rounded-xl border border-stone-300 px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1B5C4A]"
                  >
                    ساخت سفارش
                  </Link>
                  <button
                    type="button"
                    className="min-h-11 rounded-xl border border-stone-300 px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1B5C4A]"
                    onClick={() => void copyValue(item, 'text')}
                  >
                    کپی متن
                  </button>
                  {item.images.slice(0, 3).map((image, imageIndex) => {
                    const href = mediaUrl(image);
                    if (!href) return null;
                    return (
                      <a
                        key={`${item.id}-${imageIndex}`}
                        href={href}
                        download
                        className="inline-flex min-h-11 items-center rounded-xl border border-stone-300 px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1B5C4A]"
                      >
                        {imageIndex === 0 ? 'دانلود تصویر' : `تصویر ${imageIndex + 1}`}
                      </a>
                    );
                  })}
                  <a
                    href={item.productUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 items-center rounded-xl border border-stone-300 px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1B5C4A]"
                  >
                    صفحه محصول
                  </a>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </SalesPartnerShell>
  );
}
