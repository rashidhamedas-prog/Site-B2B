'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { SmsResendButton } from '@/components/auth/SmsResendButton';
import { useSmsResendCooldown } from '@/hooks/useSmsResendCooldown';
import { apiClient } from '@/lib/api';
import { mediaUrl, toman } from '@/lib/product-display';
import { extractSmsCooldown } from '@/lib/sms-cooldown';
import { trackAffiliateEvent } from '@/lib/retail-analytics';
import { SalesPartnerShell, SpAlert, SpCard, SpEmpty, SpNote, spField } from './SalesPartnerShell';
import { SalesPartnerSmsIdentity } from './SalesPartnerSmsIdentity';
import { SpButton, SpPageSkeleton, SpStepRail, spChipClass } from './SpUi';

type CatalogItem = {
  id: string;
  name: string;
  priceIrr: number;
  stockBand: string;
  stockLabel: string;
  estimatedCommissionIrr: number;
  images?: string[];
  categoryName?: string;
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

const LEGACY_DRAFT_KEY = 'taranom.sales-partner.order-draft.v1';
const SESSION_SELECTION_KEY = 'taranom.sales-partner.order-selection.v1';
const STEPS = ['کالا', 'مشتری', 'پیامک'];

export function SalesPartnerNewOrder() {
  const params = useSearchParams();
  const presetId = params.get('productId');
  const [step, setStep] = useState(0);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [query, setQuery] = useState('');
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
  const [smsDirty, setSmsDirty] = useState(false);
  const { secondsLeft, start } = useSmsResendCooldown();
  const [localReady, setLocalReady] = useState(false);

  useEffect(() => {
    try {
      window.localStorage.removeItem(LEGACY_DRAFT_KEY);
      const raw = window.sessionStorage.getItem(SESSION_SELECTION_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as {
          productId?: string;
          variantId?: string;
          quantity?: number;
        };
        if (!presetId && saved.productId) setProductId(saved.productId);
        if (saved.variantId) setVariantId(saved.variantId);
        if (Number.isInteger(saved.quantity) && Number(saved.quantity) > 0) setQuantity(Number(saved.quantity));
      }
    } catch {
      /* ignore broken tab selection */
    } finally {
      setLocalReady(true);
    }
  }, [presetId]);

  useEffect(() => {
    if (!localReady) return;
    try {
      window.sessionStorage.setItem(
        SESSION_SELECTION_KEY,
        JSON.stringify({ productId, variantId, quantity }),
      );
    } catch {
      /* private mode */
    }
  }, [localReady, productId, variantId, quantity]);

  useEffect(() => {
    let cancelled = false;
    const handle = window.setTimeout(() => {
      const search = new URLSearchParams({ stock: 'available', scope: 'order', pageSize: '200', sort: 'priority' });
      if (query.trim()) search.set('q', query.trim());
      apiClient
        .get<{ items: CatalogItem[]; page: number; pageSize: number; total: number }>(`/sales-partners/catalog?${search.toString()}`)
        .then(async (first) => {
          const pages = Math.min(50, Math.ceil(first.total / Math.max(1, first.pageSize)));
          const rest = pages > 1
            ? await Promise.all(
              Array.from({ length: pages - 1 }, (_, index) => {
                const next = new URLSearchParams(search);
                next.set('page', String(index + 2));
                return apiClient.get<{ items: CatalogItem[] }>(`/sales-partners/catalog?${next.toString()}`);
              }),
            )
            : [];
          const seen = new Set<string>();
          const items = [first, ...rest].flatMap((page) => page.items).filter((item) => {
            if (seen.has(item.id)) return false;
            seen.add(item.id);
            return true;
          });
          if (!cancelled) setCatalog(items);
        })
        .catch((err: unknown) => {
          if (!cancelled) setError(err instanceof Error ? err.message : 'بارگذاری محصولات ناموفق بود');
        })
        .finally(() => {
          if (!cancelled) setCatalogLoading(false);
        });
    }, query.trim() ? 300 : 0);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [query]);

  useEffect(() => {
    if (!productId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    const requestedId = productId;
    apiClient
      .get<ProductDetail>(`/sales-partners/catalog/${requestedId}`)
      .then((row) => {
        if (cancelled || row.id !== requestedId) return;
        setDetail(row);
        setVariantId((current) =>
          current && row.variants.some((item) => item.id === current) ? current : row.variants[0]?.id || '',
        );
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setDetail(null);
          setError(err instanceof Error ? err.message : 'این کالا برای سفارش در دسترس نیست');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [productId]);

  const selected = useMemo(
    () => detail || catalog.find((item) => item.id === productId) || null,
    [catalog, detail, productId],
  );
  const variant = detail?.variants.find((row) => row.id === variantId);
  const colors = useMemo(
    () => [...new Set((detail?.variants || []).map((row) => row.color).filter(Boolean))],
    [detail],
  );
  const activeColor = variant?.color || colors[0] || '';
  const sizes = (detail?.variants || []).filter((row) => !activeColor || row.color === activeColor);

  function chooseColor(color: string) {
    const next = detail?.variants.find((row) => row.color === color);
    if (next) setVariantId(next.id);
  }

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
      trackAffiliateEvent('affiliate_order_created', created?.id);
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
      trackAffiliateEvent('affiliate_payment_link_sent', draft.id);
      start(extractSmsCooldown(null, sent));
      try {
        window.localStorage.removeItem(LEGACY_DRAFT_KEY);
        window.sessionStorage.removeItem(SESSION_SELECTION_KEY);
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

  const canContinueProduct = detail ? detail.variants.length === 0 || Boolean(variantId) : false;

  return (
    <SalesPartnerShell title="سفارش جدید">
      <SpNote>
        تا وقتی مشتری لینک را تأیید نکند سفارشی ثبت یا مبلغی دریافت نمی‌شود. انتخاب کالا فقط تا بستن همین زبانه می‌ماند؛
        شماره و نام مشتری روی دستگاه ذخیره نمی‌شود.
      </SpNote>
      <div className="mt-4">
        <SpStepRail steps={STEPS} current={step} />
      </div>
      {error && <SpAlert>{error}</SpAlert>}
      {catalogLoading && <SpPageSkeleton cards={1} />}
      {!catalogLoading && catalog.length === 0 && !query.trim() && !productId && (
        <SpEmpty>الان کالای موجودی برای فروش نیست.</SpEmpty>
      )}

      {!catalogLoading && step === 0 && (catalog.length > 0 || query.trim() || productId) && (
        <div className="space-y-4">
          {selected && (
            <SpCard className="flex gap-3">
              {mediaUrl(selected.images?.[0]) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={mediaUrl(selected.images?.[0])}
                  alt=""
                  width={72}
                  height={72}
                  className="h-[72px] w-[72px] shrink-0 rounded-2xl object-cover"
                />
              ) : null}
              <div className="min-w-0">
                <p className="text-xs text-[#1B5C4A]">{selected.categoryName}</p>
                <h2 className="truncate text-base font-bold">{selected.name}</h2>
                <p className="mt-1 text-sm leading-6 text-stone-600">
                  {toman(selected.priceIrr)} تومان · {variant?.stockLabel || selected.stockLabel}
                  {selected.estimatedCommissionIrr > 0
                    ? ` · پورسانت تخمینی ${toman(selected.estimatedCommissionIrr)} تومان`
                    : ''}
                </p>
              </div>
            </SpCard>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium" htmlFor="sp-product-q">
              جستجوی کالای موجود
            </label>
            <input
              id="sp-product-q"
              className={spField}
              value={query}
              placeholder="نام کالا"
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <p className="text-sm text-stone-600" role="status">
            {query.trim()
              ? `${catalog.length.toLocaleString('fa-IR')} نتیجه در موجودی زنده`
              : `${catalog.length.toLocaleString('fa-IR')} کالای موجود`}
          </p>
          <ul className="max-h-[32rem] space-y-2 overflow-auto rounded-3xl" aria-label="موجودی زنده">
            {catalog.length === 0 ? (
              <li className="px-1 text-sm text-stone-600">با این نام کالای موجودی نیست.</li>
            ) : catalog.map((item) => {
              const active = item.id === productId;
              const src = mediaUrl(item.images?.[0]);
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-pressed={active}
                    className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-2 text-right ${active ? 'border-[#1B5C4A] bg-[#1B5C4A]/5' : 'border-stone-200 bg-white'}`}
                    onClick={() => setProductId(item.id)}
                  >
                    {src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={src} alt="" width={48} height={48} loading="lazy" decoding="async" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
                    ) : (
                      <span className="h-12 w-12 shrink-0 rounded-xl bg-stone-100" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{item.name}</span>
                      <span className="block text-xs text-stone-500">
                        {toman(item.priceIrr)} تومان · {item.stockLabel}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {colors.length > 0 && (
            <div>
              <p className="mb-1.5 text-sm font-medium" id="sp-color-label">رنگ</p>
              <div className="flex flex-wrap gap-2" role="group" aria-labelledby="sp-color-label">
                {colors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={spChipClass(color === activeColor)}
                    aria-pressed={color === activeColor}
                    onClick={() => chooseColor(color)}
                  >
                    {color}
                  </button>
                ))}
              </div>
            </div>
          )}
          {sizes.length > 0 && (
            <div>
              <p className="mb-1.5 text-sm font-medium" id="sp-size-label">سایز</p>
              <div className="flex flex-wrap gap-2" role="group" aria-labelledby="sp-size-label">
                {sizes.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    className={spChipClass(row.id === variantId)}
                    aria-pressed={row.id === variantId}
                    onClick={() => setVariantId(row.id)}
                  >
                    {row.size} · {row.stockLabel}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="mb-1.5 text-sm font-medium" id="sp-qty-label">تعداد</p>
            <div className="flex w-fit items-center gap-2" role="group" aria-labelledby="sp-qty-label">
              <button type="button" className={spChipClass(false)} aria-label="کم کردن تعداد" onClick={() => setQuantity((current) => Math.max(1, current - 1))}>−</button>
              <span className="min-w-8 text-center tabular-nums" aria-live="polite">{quantity.toLocaleString('fa-IR')}</span>
              <button type="button" className={spChipClass(false)} aria-label="افزودن تعداد" onClick={() => setQuantity((current) => Math.min(20, current + 1))}>+</button>
            </div>
          </div>
          <SpButton className="w-full" disabled={!canContinueProduct} onClick={() => setStep(1)}>
            ادامه: اطلاعات مشتری
          </SpButton>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          {selected ? (
            <p className="text-sm text-stone-600">
              {selected.name}
              {variant ? ` · ${variant.color} / ${variant.size}` : ''} · {quantity.toLocaleString('fa-IR')} عدد
            </p>
          ) : null}
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
              autoComplete="tel"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium" htmlFor="sp-name">
              نام مشتری (اختیاری)
            </label>
            <input id="sp-name" className={spField} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
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
        <div className="space-y-4">
          <SpCard className="space-y-2" role="region" aria-labelledby="sp-review-title">
            <h2 id="sp-review-title" className="font-bold text-stone-900">مرور قبل از پیامک</h2>
            <p className="text-sm">محصول: {selected?.name || '—'}</p>
            <p className="text-sm">رنگ و سایز: {variant ? `${variant.color} / ${variant.size}` : '—'}</p>
            <p className="text-sm">تعداد: {quantity.toLocaleString('fa-IR')}</p>
            <p className="text-sm">
              موبایل مشتری: <span dir="ltr" className="inline-block">{phone}</span>
            </p>
            {name.trim() ? <p className="text-sm">نام مشتری: {name.trim()}</p> : null}
            <p className="text-sm">مبلغ کالا: {toman(draft.merchandiseIrr)} تومان</p>
            <p className="text-sm">پورسانت تخمینی: {toman(draft.estimatedCommissionIrr)} تومان</p>
            <p className="text-sm leading-6 text-stone-600">
              برای مشتری پیامک می‌شود که تا تأیید خودش سفارشی ثبت نمی‌شود و پرداخت فقط به ترنم است.
            </p>
          </SpCard>
          <SalesPartnerSmsIdentity onDirty={setSmsDirty} />
          <div className="flex gap-2">
            <SpButton className="flex-1" disabled={busy || smsDirty} onClick={() => void sendLink()}>
              {smsDirty ? 'اول معرفی را ذخیره کنید' : 'ارسال لینک تأیید'}
            </SpButton>
            <SpButton
              variant="secondary"
              onClick={() => {
                setConfirmOpen(false);
                setStep(1);
              }}
            >
              ویرایش
            </SpButton>
          </div>
        </div>
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
