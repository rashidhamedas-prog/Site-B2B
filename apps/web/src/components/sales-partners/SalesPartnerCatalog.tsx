'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Copy, ExternalLink, FileText, ShoppingBag } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { mediaUrl, toman } from '@/lib/product-display';
import { SalesPartnerShell, SpAlert, SpEmpty, SpNote, spField } from './SalesPartnerShell';
import { SpButton, SpPageSkeleton, useSpToast } from './SpUi';

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
  const toast = useSpToast();
  const [data, setData] = useState<CatalogResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
      toast.show(kind === 'link' ? 'لینک فروش کپی شد' : 'متن معرفی کپی شد');
      setError(null);
    } catch {
      setError('کپی خودکار ممکن نشد. لینک را از کادر انتخاب کنید.');
    }
  }

  return (
    <SalesPartnerShell title="محصولات قابل فروش">
      <SpNote>
        هر لینک مخصوص شماست. اگر مشتری از همان لینک بخرد، پورسانت همان کالا بعد از پرداخت حساب می‌شود. هزینه ارسال و کیف
        پول داخل پورسانت نیست.
      </SpNote>
      {loading && <SpPageSkeleton cards={2} />}
      {error && (
        <div className="mt-4">
          <SpAlert>{error}</SpAlert>
        </div>
      )}
      {!loading && data && data.items.length === 0 && (
        <div className="mt-6">
          <SpEmpty>
            فعلاً محصولی برای معرفی فعال نشده است. به‌محض اضافه‌شدن توسط فروشگاه، لینک فروش اینجا می‌آید.
          </SpEmpty>
        </div>
      )}
      <ul className="mt-5 space-y-4">
        {data?.items.map((item, index) => {
          const src = mediaUrl(item.images[0]);
          return (
            <li key={item.id} className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm shadow-stone-900/5">
              <div className="relative aspect-[4/3] bg-stone-100">
                {src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={src}
                    alt={item.name}
                    className="h-full w-full object-cover"
                    loading={index === 0 ? 'eager' : 'lazy'}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-stone-500">بدون تصویر</div>
                )}
              </div>
              <div className="space-y-3 p-4">
                <div>
                  <h2 className="text-base font-bold text-stone-900">{item.name}</h2>
                  {item.blurb && <p className="mt-1 text-sm leading-6 text-stone-600">{item.blurb}</p>}
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-[#f6f3ee] px-2.5 py-1 tabular-nums text-stone-700">
                    {item.priceLabel}
                  </span>
                  <span className="rounded-full bg-[#f6f3ee] px-2.5 py-1 text-stone-700">{item.stockLabel}</span>
                </div>
                <p className="text-sm leading-6 text-stone-600">
                  {item.commissionPercent > 0
                    ? `پورسانت تخمینی این قیمت: ${toman(item.estimatedCommissionIrr)} تومان (${item.commissionPercent}٪)`
                    : 'درصد پورسانت این محصول هنوز ثبت نشده. تا آن زمان پورسانت فروش از این لینک صفر است.'}
                </p>
                <label className="block text-sm font-medium" htmlFor={`sp-link-${item.id}`}>
                  لینک فروش شما
                </label>
                <input
                  id={`sp-link-${item.id}`}
                  readOnly
                  value={item.productUrl}
                  dir="ltr"
                  className={spField}
                  onFocus={(event) => event.currentTarget.select()}
                />
                <SpButton className="w-full" onClick={() => void copyValue(item, 'link')}>
                  <Copy className="h-4 w-4" aria-hidden />
                  کپی لینک فروش
                </SpButton>
                <div className="grid grid-cols-2 gap-2">
                  <SpButton variant="secondary" onClick={() => void copyValue(item, 'text')}>
                    <FileText className="h-4 w-4" aria-hidden />
                    کپی متن
                  </SpButton>
                  <Link
                    href={`/sales-partners/orders/new?productId=${item.id}`}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-stone-300 bg-white px-3 text-sm text-stone-800 transition-[transform,border-color] duration-200 hover:border-[#1B5C4A]/40 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C9A84C]"
                  >
                    <ShoppingBag className="h-4 w-4" aria-hidden />
                    سفارش مشتری
                  </Link>
                </div>
                <a
                  href={item.productUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl text-sm text-[#1B5C4A] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C9A84C]"
                >
                  <ExternalLink className="h-4 w-4" aria-hidden />
                  باز کردن صفحه محصول
                </a>
              </div>
            </li>
          );
        })}
      </ul>
    </SalesPartnerShell>
  );
}
