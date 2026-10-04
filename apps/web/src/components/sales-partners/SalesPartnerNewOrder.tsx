'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { SmsResendButton } from '@/components/auth/SmsResendButton';
import { useSmsResendCooldown } from '@/hooks/useSmsResendCooldown';
import { apiClient } from '@/lib/api';
import { toman } from '@/lib/product-display';
import { extractSmsCooldown } from '@/lib/sms-cooldown';
import { SalesPartnerShell, SpAlert, SpCard, SpEmpty, SpNote, spField } from './SalesPartnerShell';
import { SpButton, SpPageSkeleton, SpStepRail } from './SpUi';

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

const LOCAL_DRAFT_KEY = 'taranom.sales-partner.order-draft.v1';
const STEPS = ['کالا', 'مشتری', 'پیامک'];

export function SalesPartnerNewOrder() {
  const params = useSearchParams();
  const presetId = params.get('productId');
  const [step, setStep] = useState(0);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
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
  const { secondsLeft, start } = useSmsResendCooldown();
  const [localReady, setLocalReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LOCAL_DRAFT_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as {
          productId?: string;
          variantId?: string;
          quantity?: number;
          phone?: string;
          name?: string;
        };
        if (!presetId && saved.productId) setProductId(saved.productId);
        if (saved.variantId) setVariantId(saved.variantId);
        if (Number.isInteger(saved.quantity) && saved.quantity >= 1 && saved.quantity <= 20) {
          setQuantity(saved.quantity);
        }
      }
    } catch {
      /* ignore broken local draft */
    } finally {
      setLocalReady(true);
    }
  }, [presetId]);

  useEffect(() => {
    if (!localReady) return;
    try {
      window.localStorage.setItem(
        LOCAL_DRAFT_KEY,
        JSON.stringify({ productId, variantId, quantity }),
      );
    } catch {
      /* private mode */
    }
  }, [localReady, productId, variantId, quantity]);

  useEffect(() => {
    apiClient
      .get<{ items: CatalogItem[] }>('/sales-partners/catalog')
      .then((res) => {
        setCatalog(res.items);
        if (!productId && res.items[0]) setProductId(res.items[0].id);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'بارگذاری محصولات ناموفق بود'))
      .finally(() => setCatalogLoading(false));
  }, []);

  useEffect(() => {
    if (!productId) return;
    let stale = false;
    apiClient
      .get<ProductDetail>(`/sales-partners/catalog/${productId}`)
      .then((row) => {
        if (stale) return;
        setDetail(row);
        setVariantId(row.variants[0]?.id || '');
      })
      .catch(() => {
        if (!stale) setDetail(null);
      });
    return () => {
      stale = true;
    };
  }, [productId]);

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
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ساخت سفارش ناموفق بود');
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
      start(extractSmsCooldown(null, sent));
      try {
        window.localStorage.removeItem(LOCAL_DRAFT_KEY);
      } catch {
        /* ignore */
      }
    } catch (err) {
      start(extractSmsCooldown(err));
      setError(err instanceof Error ? err.message : 'ارسال لینک تأیید ناموفق بود');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SalesPartnerShell title="سفارش جدید">
      <SpNote>
        تا وقتی مشتری لینک را تأیید نکند سفارشی ثبت یا مبلغی دریافت نمی‌شود. اگر ارتباط قطع شود، مقادیر همین فرم روی
        دستگاه شما می‌ماند.
      </SpNote>
      <div className="mt-4">
        <SpStepRail steps={STEPS} current={step} />
      </div>
      {error && <SpAlert>{error}</SpAlert>}
      {catalogLoading && <SpPageSkeleton cards={1} />}
      {!catalogLoading && catalog.length === 0 && (
        <SpEmpty>محصول قابل فروشی برای شما فعال نشده است.</SpEmpty>
      )}

      {!catalogLoading && catalog.length > 0 && step === 0 && (
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium" htmlFor="sp-product">
              محصول
            </label>
            <select
              id="sp-product"
              className={spField}
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              required
            >
              {catalog.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          {detail && detail.variants.length > 0 && (
            <div>
              <label className="mb-1.5 block text-sm font-medium" htmlFor="sp-variant">
                رنگ و سایز
              </label>
              <select
                id="sp-variant"
                className={spField}
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
            <SpCard className="!bg-[#f6f3ee] text-sm leading-6 text-stone-700">
              قیمت فعلی {toman(selected.priceIrr)} تومان · {variant?.stockLabel || selected.stockLabel} · پورسانت تخمینی{' '}
              {toman(selected.estimatedCommissionIrr)} تومان
            </SpCard>
          )}
          <div>
            <label className="mb-1.5 block text-sm font-medium" htmlFor="sp-qty">
              تعداد
            </label>
            <input
              id="sp-qty"
              type="number"
              min={1}
              max={20}
              className={spField}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              required
            />
          </div>
          <SpButton
            className="w-full"
            disabled={!productId || !Number.isInteger(quantity) || quantity < 1 || quantity > 20}
            onClick={() => setStep(1)}
          >
            ادامه: اطلاعات مشتری
          </SpButton>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium" htmlFor="sp-phone">
              موبایل مشتری
            </label>
            <input
              id="sp-phone"
              inputMode="numeric"
              className={spField}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              dir="ltr"
              placeholder="09xxxxxxxxx"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium" htmlFor="sp-name">
              نام مشتری (اختیاری)
            </label>
            <input id="sp-name" className={spField} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <SpButton variant="secondary" onClick={() => setStep(0)}>
              بازگشت
            </SpButton>
            <SpButton
              disabled={busy || !productId || !phone.trim()}
              onClick={() => void createDraft()}
            >
              {busy ? 'در حال آماده‌سازی…' : 'مرور و پیامک'}
            </SpButton>
          </div>
        </div>
      )}

      {step === 2 && confirmOpen && draft && (
        <SpCard className="space-y-3" role="dialog" aria-labelledby="sp-review-title">
          <h2 id="sp-review-title" className="font-bold text-stone-900">
            مرور قبل از پیامک
          </h2>
          <p className="text-sm">مبلغ کالا: {toman(draft.merchandiseIrr)} تومان</p>
          <p className="text-sm">پورسانت تخمینی: {toman(draft.estimatedCommissionIrr)} تومان</p>
          <p className="text-sm leading-6 text-stone-600">
            برای مشتری پیامک می‌شود که تا تأیید خودش سفارشی ثبت نمی‌شود و پرداخت فقط به ترنم است.
          </p>
          <div className="flex gap-2">
            <SpButton className="flex-1" disabled={busy} onClick={() => void sendLink()}>
              ارسال لینک تأیید
            </SpButton>
            <SpButton
              variant="secondary"
              onClick={() => {
                setConfirmOpen(false);
                setStep(1);
              }}
            >
              بازگشت
            </SpButton>
          </div>
        </SpCard>
      )}

      {step === 2 && draft && !confirmOpen && (
        <div className="space-y-3">
          <p className="rounded-2xl bg-emerald-50 p-4 text-sm leading-7 text-emerald-900" role="status">
            وضعیت: {draft.statusLabel}. لینک برای مشتری ارسال شد.
          </p>
          <SmsResendButton
            secondsLeft={secondsLeft}
            onResend={() => void sendLink()}
            busy={busy}
            className="w-full"
            idleLabel="ارسال دوباره پیامک"
          />
          <SpButton variant="secondary" className="w-full" onClick={() => { window.location.href = '/sales-partners/orders'; }}>
            رفتن به فهرست سفارش‌ها
          </SpButton>
        </div>
      )}
    </SalesPartnerShell>
  );
}
