'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { toman } from '@/lib/product-display';
import { SalesPartnerShell } from './SalesPartnerShell';

type CatalogItem = {
  id: string;
  name: string;
  priceIrr: number;
  stockBand: string;
  stockLabel: string;
  estimatedCommissionIrr: number;
};

type Variant = { id: string; color: string; size: string; stockBand: string; stockLabel: string };

type ProductDetail = CatalogItem & { variants: Variant[] };

type Draft = {
  id: string;
  status: string;
  statusLabel: string;
  merchandiseIrr: number;
  estimatedCommissionIrr: number;
  cooldownSeconds?: number;
};

export function SalesPartnerNewOrder() {
  const params = useSearchParams();
  const presetId = params.get('productId');
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [detail, setDetail] = useState<ProductDetail | null>(null);
  const [productId, setProductId] = useState(presetId || '');
  const [variantId, setVariantId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    apiClient
      .get<{ items: CatalogItem[] }>('/sales-partners/catalog')
      .then((res) => {
        setCatalog(res.items);
        if (!productId && res.items[0]) setProductId(res.items[0].id);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'بارگذاری محصولات ناموفق بود'));
  }, []);

  useEffect(() => {
    if (!productId) return;
    apiClient
      .get<ProductDetail>(`/sales-partners/catalog/${productId}`)
      .then((row) => {
        setDetail(row);
        setVariantId(row.variants[0]?.id || '');
      })
      .catch(() => setDetail(null));
  }, [productId]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((n) => n - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  const selected = useMemo(
    () => detail || catalog.find((item) => item.id === productId) || null,
    [catalog, detail, productId],
  );
  const variant = detail?.variants.find((row) => row.id === variantId);

  async function createDraft() {
    setError(null);
    setBusy(true);
    try {
      const created = await apiClient.post<Draft>('/sales-partners/order-drafts', {
        items: [{ productId, variantId: variantId || undefined, quantity }],
        customerPhone: phone,
        customerName: name || undefined,
      });
      setDraft(created);
      setConfirmOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ساخت پیش‌سفارش ناموفق بود');
    } finally {
      setBusy(false);
    }
  }

  async function sendLink() {
    if (!draft) return;
    setError(null);
    setBusy(true);
    try {
      const sent = await apiClient.post<Draft>(`/sales-partners/order-drafts/${draft.id}/request-confirmation`, {});
      setDraft(sent);
      setConfirmOpen(false);
      setCooldown(sent.cooldownSeconds || 60);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ارسال لینک تأیید ناموفق بود');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SalesPartnerShell title="سفارش جدید">
      <p className="text-sm text-stone-600">
        تا وقتی مشتری لینک را تأیید نکند سفارشی ثبت یا مبلغی دریافت نمی‌شود. قیمت از سرور خوانده می‌شود.
      </p>
      {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
      {catalog.length === 0 && (
        <p className="mt-6 text-sm text-stone-600">محصول قابل فروشی برای شما فعال نشده است.</p>
      )}

      <form
        className="mt-5 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void createDraft();
        }}
      >
        <div>
          <label className="mb-1 block text-sm" htmlFor="sp-product">محصول</label>
          <select
            id="sp-product"
            className="min-h-11 w-full rounded-xl border px-3"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            required
          >
            {catalog.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </div>
        {detail && detail.variants.length > 0 && (
          <div>
            <label className="mb-1 block text-sm" htmlFor="sp-variant">رنگ و سایز</label>
            <select
              id="sp-variant"
              className="min-h-11 w-full rounded-xl border px-3"
              value={variantId}
              onChange={(e) => setVariantId(e.target.value)}
            >
              {detail.variants.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.color} / {row.size} — {row.stockLabel}
                </option>
              ))}
            </select>
          </div>
        )}
        {selected && (
          <p className="text-sm text-stone-600">
            قیمت فعلی {toman(selected.priceIrr)} تومان · {variant?.stockLabel || selected.stockLabel} · پورسانت تخمینی {toman(selected.estimatedCommissionIrr)} تومان
          </p>
        )}
        <div>
          <label className="mb-1 block text-sm" htmlFor="sp-qty">تعداد</label>
          <input
            id="sp-qty"
            type="number"
            min={1}
            max={20}
            className="min-h-11 w-full rounded-xl border px-3"
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm" htmlFor="sp-phone">موبایل مشتری</label>
          <input
            id="sp-phone"
            inputMode="numeric"
            className="min-h-11 w-full rounded-xl border px-3"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm" htmlFor="sp-name">نام مشتری (اختیاری)</label>
          <input
            id="sp-name"
            className="min-h-11 w-full rounded-xl border px-3"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <button
          type="submit"
          className="min-h-11 w-full rounded-xl bg-[#1B5C4A] text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B5C4A]"
          disabled={busy || !productId}
        >
          مرور و ارسال لینک تأیید
        </button>
      </form>

      {confirmOpen && draft && (
        <section className="mt-6 rounded-2xl border p-4" role="dialog" aria-labelledby="sp-review-title">
          <h2 id="sp-review-title" className="font-bold">مرور قبل از پیامک</h2>
          <p className="mt-2 text-sm">مبلغ کالا: {toman(draft.merchandiseIrr)} تومان</p>
          <p className="text-sm">پورسانت تخمینی: {toman(draft.estimatedCommissionIrr)} تومان</p>
          <p className="mt-2 text-sm text-stone-600">برای مشتری پیامک می‌شود که تا تأیید خودش سفارشی ثبت نمی‌شود.</p>
          <div className="mt-3 flex gap-2">
            <button type="button" className="min-h-11 flex-1 rounded-xl bg-[#1B5C4A] text-white" disabled={busy} onClick={() => void sendLink()}>
              ارسال لینک تأیید
            </button>
            <button type="button" className="min-h-11 rounded-xl border px-4" onClick={() => setConfirmOpen(false)}>بازگشت</button>
          </div>
        </section>
      )}

      {draft && !confirmOpen && (
        <div className="mt-6 space-y-3">
          <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900" role="status">
            وضعیت: {draft.statusLabel}.
          </p>
          <button
            type="button"
            className="min-h-11 w-full rounded-xl border"
            disabled={busy || cooldown > 0}
            onClick={() => void sendLink()}
          >
            {cooldown > 0 ? `ارسال دوباره تا ${cooldown} ثانیه دیگر` : 'ارسال دوباره پیامک'}
          </button>
        </div>
      )}
    </SalesPartnerShell>
  );
}
