'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toman, useRetailCart } from '@/lib/retail-cart';
import { apiClient } from '@/lib/api';
import { clearToken, getToken } from '@/lib/auth';
import { getRetailAddresses, saveRetailAddress, type RetailAddress } from '@/lib/retail-addresses';
import { RetailConversion } from '@/components/retail/RetailConversion';
import {
  stashPendingRetailPurchase,
  toGa4Item,
  trackAddPaymentInfo,
  trackAddShippingInfo,
  trackBeginCheckout,
  type RetailAnalyticsItemInput,
} from '@/lib/retail-analytics';
import { readTorobClid } from '@/components/retail/RetailAffiliateCapture';
import { CheckoutChoiceList } from '@/components/checkout/CheckoutChoiceList';
import { CheckoutPanel, CheckoutStepRail } from '@/components/checkout/CheckoutPanel';
import { CheckoutPlaceOrderBar } from '@/components/checkout/CheckoutPlaceOrderBar';
import { ShippingAddressForm } from '@/components/checkout/ShippingAddressForm';
import {
  checkoutCtaHint,
  checkoutCtaLabel,
  parseRetailPaymentChoice,
  retailPaymentOptions,
  retailSelectedPaymentId,
  retailTorobpayAddressError,
  type RetailPaymentGateway,
} from '@/lib/checkout-payment-ui';
import { FALLBACK_RETAIL_SHIPPING_METHODS, isInPersonShipping, resolveShippingMethods, shippingChoiceDescription } from '@/lib/shipping-methods';
import { pulseCheckoutIntent } from '@/lib/checkout-intent';
import {
  emptyShippingAddress,
  firstAddressError,
  finalizeShippingAddress,
  validateShippingAddress,
  type ShippingAddress,
} from '@/lib/shipping-address';

type AddressForm = ShippingAddress;

function readAff(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const q = new URLSearchParams(window.location.search);
    const torob = q.get('torob_clid') || q.get('torobClid');
    if (torob?.trim()) {
      sessionStorage.setItem('taranom_torob_clid', torob.trim());
      sessionStorage.setItem('taranom_aff', `torob|${torob.trim()}`);
    }
    const aff = q.get('aff');
    if (aff) {
      sessionStorage.setItem('taranom_aff', aff);
      return aff;
    }
    return sessionStorage.getItem('taranom_aff') || undefined;
  } catch {
    return undefined;
  }
}

export default function RetailCheckoutPage() {
  const items = useRetailCart((s) => s.items);
  const clear = useRetailCart((s) => s.clear);
  const subtotal = useMemo(() => items.reduce((n, i) => n + i.unitPrice * i.quantity, 0), [items]);
  const pieces = useMemo(() => items.reduce((n, i) => n + i.quantity, 0), [items]);

  const [paymentMethod, setPaymentMethod] = useState<'ONLINE' | 'CASH'>('ONLINE');
  const [paymentGateway, setPaymentGateway] = useState<RetailPaymentGateway>('ZARINPAL');
  const [digipayAvailable, setDigipayAvailable] = useState(false);
  const [torobpayAvailable, setTorobpayAvailable] = useState(false);
  const [pendingPayOrderId, setPendingPayOrderId] = useState<string | null>(null);
  const [shippingMethod, setShippingMethod] = useState('PISHTAZ');
  const [shipMethods, setShipMethods] = useState(FALLBACK_RETAIL_SHIPPING_METHODS);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<string | null>(null);
  const [doneMeta, setDoneMeta] = useState<{
    amount: number;
    skus: string[];
    items: RetailAnalyticsItemInput[];
    shipping: number;
  }>({ amount: 0, skus: [], items: [], shipping: 0 });
  const [shipFee, setShipFee] = useState(0);
  const [shipMeta, setShipMeta] = useState<{ freeShipping?: boolean; estimatedDays?: string }>({});
  const [useWallet, setUseWallet] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [savedAddresses, setSavedAddresses] = useState<RetailAddress[]>([]);
  const [address, setAddress] = useState<AddressForm>(emptyShippingAddress());
  const [showAddressErrors, setShowAddressErrors] = useState(false);
  const beganCheckout = useRef(false);

  useEffect(() => {
    if (beganCheckout.current || items.length === 0) return;
    beganCheckout.current = true;
    trackBeginCheckout(
      items.map((i) => ({
        productId: i.productId,
        sku: i.sku,
        name: i.productName,
        color: i.color,
        size: i.size,
        unitPrice: i.unitPrice,
        quantity: i.quantity,
      })),
      subtotal,
    );
  }, [items, subtotal]);

  useEffect(() => {
    if (items.length === 0) return;
    pulseCheckoutIntent('RETAIL');
  }, [items.length]);

  useEffect(() => {
    const saved = getRetailAddresses();
    setSavedAddresses(saved);
    if (saved[0]) {
      setAddress((a) => ({
        ...a,
        ...saved[0],
        recipient: a.recipient || saved[0]!.recipient,
        mobile: a.mobile || saved[0]!.mobile,
      }));
    }
  }, []);

  useEffect(() => {
    apiClient
      .get<{ code: string }[]>('/payments/providers/eligible', {
        headers: { 'x-taranom-channel': 'RETAIL' },
      })
      .then((rows) => {
        const codes = new Set((rows || []).map((r) => String(r.code || '').toUpperCase()));
        setDigipayAvailable(codes.has('DIGIPAY'));
        setTorobpayAvailable(codes.has('TOROBPAY'));
      })
      .catch(() => {
        setDigipayAvailable(false);
        setTorobpayAvailable(false);
      });
  }, []);

  useEffect(() => {
    if (!getToken()) return;
    apiClient
      .get<{ balance?: number; phone?: string; ownerName?: string; businessName?: string }>(
        '/auth/me/profile',
      )
      .then((me) => {
        setWalletBalance(Number(me?.balance) || 0);
        setAddress((a) => ({
          ...a,
          recipient: a.recipient || me?.ownerName || me?.businessName || '',
          mobile: a.mobile || me?.phone || '',
        }));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    apiClient
      .get<Array<{ id: string; label: string }>>('/shipping/methods?channel=RETAIL')
      .then((m) => {
        const next = resolveShippingMethods(m, FALLBACK_RETAIL_SHIPPING_METHODS);
        setShipMethods(next);
        setShippingMethod((prev) => (next.some((x) => x.id === prev) ? prev : next[0]?.id || prev));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!pieces) {
      setShipFee(0);
      return;
    }
    const params = new URLSearchParams({
      pieces: String(pieces),
      orderTotal: String(subtotal),
      method: shippingMethod,
      province: address.province,
      city: address.city,
      channel: 'RETAIL',
    });
    apiClient
      .get<{ fee?: number; freeShipping?: boolean; estimatedDays?: string }>(`/shipping/quote?${params}`)
      .then((q) => {
        setShipFee(Number(q.fee) || 0);
        setShipMeta({ freeShipping: q.freeShipping, estimatedDays: q.estimatedDays });
      })
      .catch(() => {
        setShipFee(isInPersonShipping(shippingMethod) ? 0 : 650_000);
        setShipMeta(isInPersonShipping(shippingMethod) ? { estimatedDays: 'هماهنگی برای مراجعه' } : {});
      });
  }, [pieces, subtotal, shippingMethod, address.province, address.city]);

  const walletApplied = useWallet ? Math.min(walletBalance, Math.max(0, subtotal + shipFee)) : 0;
  const payable = Math.max(0, subtotal + shipFee - walletApplied);
  const paymentOptions = retailPaymentOptions(digipayAvailable, torobpayAvailable);
  const selectedPaymentId = retailSelectedPaymentId(paymentMethod, paymentGateway);
  const ctaLabel = checkoutCtaLabel({
    kind: paymentMethod,
    channel: 'retail',
    busy,
    payableRial: payable,
  });
  const ctaHint = checkoutCtaHint(paymentMethod);

  const choosePayment = (id: string) => {
    const next = parseRetailPaymentChoice(id);
    setPaymentMethod(next.method);
    if (next.gateway) setPaymentGateway(next.gateway);
    if (next.gateway === 'TOROBPAY') setShowAddressErrors(true);
    setPendingPayOrderId(null);
    trackAddPaymentInfo(
      items.map((i) => ({
        productId: i.productId,
        sku: i.sku,
        name: i.productName,
        color: i.color,
        size: i.size,
        unitPrice: i.unitPrice,
        quantity: i.quantity,
      })),
      payable,
      next.method === 'CASH' ? 'CASH' : next.gateway ?? 'ZARINPAL',
    );
  };

  /** No account / incomplete retail customer → open account page (silent). */
  const goOpenAccount = () => {
    clearToken();
    window.location.href = '/account?redirect=/checkout';
  };

  const ensureRetailAccount = async (): Promise<boolean> => {
    if (!getToken()) {
      window.location.href = '/account?redirect=/checkout';
      return false;
    }
    try {
      const me = await apiClient.get<{ customerId?: string }>('/auth/me/profile');
      if (!me?.customerId) {
        goOpenAccount();
        return false;
      }
      return true;
    } catch {
      goOpenAccount();
      return false;
    }
  };

  const finishOnlineRedirect = (redirectUrl: string, orderIds: Array<string | undefined>) => {
    const conversionAmount = payable;
    const conversionItems = items.map((i) => ({
      productId: i.productId,
      sku: i.sku,
      name: i.productName,
      color: i.color,
      size: i.size,
      unitPrice: i.unitPrice,
      quantity: i.quantity,
    }));
    stashPendingRetailPurchase({
      transactionIds: orderIds.filter((id): id is string => Boolean(id)),
      value: conversionAmount,
      shipping: shipFee,
      items: conversionItems
        .map((it) => toGa4Item(it))
        .filter((it): it is NonNullable<ReturnType<typeof toGa4Item>> => Boolean(it)),
    });
    clear();
    window.location.href = redirectUrl;
  };

  const retryExistingOrderPay = async (orderId: string) => {
    const pay = await apiClient.post<{ redirectUrl?: string }>('/payments/start', {
      orderId,
      channel: 'RETAIL',
      providerCode: paymentGateway,
    });
    if (!pay?.redirectUrl) {
      setError('آدرس درگاه دریافت نشد؛ دوباره تلاش کنید');
      return;
    }
    finishOnlineRedirect(pay.redirectUrl, [orderId]);
  };

  const submit = async () => {
    setError('');
    if (!items.length) {
      setError('سبد خالی است');
      return;
    }
    const addressMode = paymentMethod === 'ONLINE' && paymentGateway === 'TOROBPAY' ? 'torobpay' : 'standard';
    const addressError =
      firstAddressError(validateShippingAddress(address, addressMode)) ||
      retailTorobpayAddressError(paymentMethod, paymentGateway, address);
    if (addressError) {
      setShowAddressErrors(true);
      setError(addressError);
      document.getElementById('checkout-address')?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'start',
      });
      return;
    }
    const shippingAddress = finalizeShippingAddress(address);
    setBusy(true);
    try {
      if (!(await ensureRetailAccount())) return;
      if (pendingPayOrderId && paymentMethod === 'ONLINE') {
        await retryExistingOrderPay(pendingPayOrderId);
        return;
      }
      const order = await apiClient.post<{
        orderNumber?: string;
        id?: string;
        paymentUrl?: string;
        paymentStartError?: string;
      }>('/orders', {
        type: 'RETAIL_WEBSITE',
        channel: 'RETAIL',
        paymentMethod,
        paymentGateway: paymentMethod === 'ONLINE' ? paymentGateway : undefined,
        shippingMethod,
        useWallet: useWallet && walletBalance > 0,
        affiliateId: readAff(),
        torobClid: readTorobClid(),
        shippingAddress,
        notes: notes || undefined,
        items: items.map((i) => ({
          productId: i.productId,
          productVariantId: i.variantId,
          quantity: i.quantity,
          productName: i.productName,
          sku: i.sku,
          color: i.color,
          size: i.size,
          imageUrl: i.imageUrl,
        })),
      });
      saveRetailAddress(shippingAddress);
      if (order?.paymentStartError) {
        if (order.id) setPendingPayOrderId(order.id);
        setError(order.paymentStartError);
        return;
      }
      if (order?.paymentUrl) {
        finishOnlineRedirect(order.paymentUrl, [order.orderNumber, order.id]);
        return;
      }
      const conversionSkus = items.map((i) => i.sku).filter(Boolean);
      const conversionAmount = payable;
      const conversionItems = items.map((i) => ({
        productId: i.productId,
        sku: i.sku,
        name: i.productName,
        color: i.color,
        size: i.size,
        unitPrice: i.unitPrice,
        quantity: i.quantity,
      }));
      stashPendingRetailPurchase({
        transactionIds: [order.orderNumber, order.id].filter((id): id is string => Boolean(id)),
        value: conversionAmount,
        shipping: shipFee,
        items: conversionItems
          .map((it) => toGa4Item(it))
          .filter((it): it is NonNullable<ReturnType<typeof toGa4Item>> => Boolean(it)),
      });
      clear();
      setDoneMeta({ amount: conversionAmount, skus: conversionSkus, items: conversionItems, shipping: shipFee });
      setDone(order.orderNumber ?? order.id ?? 'ثبت شد');
    } catch (e: any) {
      const msg = String(e?.message || '');
      const needsAccount =
        e?.status === 403 ||
        msg.includes('تأیید نشده') ||
        msg.includes('حساب مشتری') ||
        msg.includes('وارد شوید');
      if (needsAccount) {
        goOpenAccount();
        return;
      }
      setError(msg || 'خطا در ثبت سفارش');
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <RetailConversion
          orderNumber={done}
          amountIrr={doneMeta.amount}
          skus={doneMeta.skus}
          items={doneMeta.items}
          shippingIrr={doneMeta.shipping}
        />
        <h1 className="text-2xl font-extrabold text-[var(--retail-primary)]">سفارش ثبت شد</h1>
        <p className="mt-3 text-[var(--retail-muted)]">شماره سفارش: {done}</p>
        <Link href="/account" className="mt-8 inline-block font-bold text-[var(--retail-primary)]">
          پیگیری سفارش
        </Link>
      </div>
    );
  }

  const fieldClass =
    'w-full rounded-xl border border-[var(--retail-border)] bg-white px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--retail-gold)]';

  return (
    <div className="relative isolate min-h-[70vh] bg-[var(--retail-bg)] pb-28 lg:pb-12">
      <div className="pointer-events-none absolute inset-0 bg-atmosphere" aria-hidden />
      <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8">
          <p className="text-[11px] font-semibold tracking-[0.22em] text-[var(--retail-gold)]">CHECKOUT</p>
          <h1 className="mt-2 text-2xl font-extrabold text-[var(--retail-ink)]">تسویه حساب</h1>
          <p className="mt-1 text-sm text-[var(--retail-muted)]">خرید تکی — بدون حداقل سفارش عمده</p>
          <CheckoutStepRail appearance="retail" />
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)] lg:items-start">
          <div className="space-y-5">
            <CheckoutPanel appearance="retail" id="checkout-address" index="۰۱" title="آدرس تحویل" subtitle="گیرنده، شهر و کدپستی را دقیق بنویسید">
              <ShippingAddressForm
                appearance="retail"
                value={address}
                onChange={setAddress}
                savedAddresses={savedAddresses}
                onSelectSaved={(next) => setAddress({ ...emptyShippingAddress(), ...next })}
                mode={paymentMethod === 'ONLINE' && paymentGateway === 'TOROBPAY' ? 'torobpay' : 'standard'}
                showErrors={showAddressErrors}
              />
            </CheckoutPanel>

            <CheckoutPanel
              appearance="retail"
              id="checkout-shipping"
              index="۰۲"
              title="روش ارسال"
              subtitle={shipMeta.estimatedDays ? `زمان تقریبی: ${shipMeta.estimatedDays}` : 'انتخاب سرویس ارسال'}
            >
              <CheckoutChoiceList
                appearance="retail"
                legend="روش ارسال"
                name="retail-shipping"
                value={shippingMethod}
                onChange={(next) => {
                  setShippingMethod(next);
                  trackAddShippingInfo(
                    items.map((i) => ({
                      productId: i.productId,
                      sku: i.sku,
                      name: i.productName,
                      color: i.color,
                      size: i.size,
                      unitPrice: i.unitPrice,
                      quantity: i.quantity,
                    })),
                    subtotal + shipFee,
                    next,
                  );
                }}
                options={shipMethods.map((m) => ({
                  id: m.id,
                  title: m.label,
                  description: shippingChoiceDescription(m.id, { freeShipping: shipMeta.freeShipping }),
                  icon: 'truck' as const,
                }))}
              />
            </CheckoutPanel>

            <CheckoutPanel
              appearance="retail"
              id="checkout-payment"
              index="۰۳"
              title="روش پرداخت"
              subtitle="یک مسیر را انتخاب کنید؛ مبلغ نهایی همین‌جا دیده می‌شود"
            >
              <CheckoutChoiceList
                appearance="retail"
                legend="روش پرداخت"
                name="retail-payment"
                value={selectedPaymentId}
                onChange={choosePayment}
                options={paymentOptions}
              />

              {walletBalance > 0 ? (
                <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-2xl border border-[var(--retail-border)] bg-white px-3.5 py-3 text-sm">
                  <input
                    type="checkbox"
                    checked={useWallet}
                    onChange={(e) => setUseWallet(e.target.checked)}
                    className="h-4 w-4 accent-[var(--retail-primary)]"
                  />
                  <span>
                    استفاده از اعتبار کیف‌پول ({toman(walletBalance)} تومان)
                  </span>
                </label>
              ) : null}

              <label className="mt-4 block text-sm font-bold">توضیحات (اختیاری)</label>
              <textarea
                className={`${fieldClass} mt-1 min-h-16`}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="توضیح برای پیک یا پشتیبانی"
              />

              {error ? (
                <p className="mt-3 text-sm font-semibold text-red-600" role="alert">
                  {error}
                </p>
              ) : null}
              {pendingPayOrderId ? (
                <p className="mt-2 text-xs text-[var(--retail-muted)]">
                  سفارش ثبت شده؛ درگاه را عوض کنید یا دوباره پرداخت را بزنید. سبد خالی نشده است.
                </p>
              ) : null}

              <div className="mt-5 hidden lg:block">
                <CheckoutPlaceOrderBar
                  appearance="retail"
                  label={ctaLabel}
                  hint={ctaHint}
                  busy={busy}
                  disabled={!items.length}
                  onClick={submit}
                />
              </div>

              {!getToken() ? (
                <p className="mt-3 text-center text-sm text-[var(--retail-muted)]">
                  با زدن دکمه پرداخت، اگر حساب نداشته باشید به صفحه باز کردن حساب می‌روید.
                </p>
              ) : null}
            </CheckoutPanel>
          </div>

          <aside className="h-fit rounded-[1.6rem] bg-[var(--retail-surface)] p-6 ring-1 ring-[var(--retail-border)] lg:sticky lg:top-24">
            <h2 className="font-extrabold text-[var(--retail-ink)]">خلاصه سفارش</h2>
            {items.length === 0 ? (
              <p className="mt-4 text-sm text-[var(--retail-muted)]">سبد خالی است</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {items.map((i) => (
                  <li key={`${i.productId}-${i.variantId}-${i.color}`} className="flex items-center gap-3 text-sm">
                    {i.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={i.imageUrl}
                        alt={i.color || i.productName}
                        className="h-12 w-10 shrink-0 rounded-md object-cover ring-1 ring-[var(--retail-border)]"
                      />
                    ) : (
                      <span className="h-12 w-10 shrink-0 rounded-md bg-[var(--retail-bg)]" />
                    )}
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-semibold">{i.productName}</span>
                      {(i.color || i.size) ? (
                        <span className="block text-xs text-[var(--retail-muted)]">
                          {[i.color, i.size].filter(Boolean).join(' · ')} × {i.quantity.toLocaleString('fa-IR')}
                        </span>
                      ) : (
                        <span className="block text-xs text-[var(--retail-muted)]">
                          × {i.quantity.toLocaleString('fa-IR')}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 font-bold">{toman(i.unitPrice * i.quantity)}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-6 space-y-2 border-t border-[var(--retail-border)] pt-4 text-sm">
              <div className="flex justify-between">
                <span>جمع کالا</span>
                <span>{toman(subtotal)} تومان</span>
              </div>
              <div className="flex justify-between">
                <span>ارسال</span>
                <span>
                  {isInPersonShipping(shippingMethod)
                    ? 'بدون هزینه'
                    : shipMeta.freeShipping
                      ? 'رایگان'
                      : `${toman(shipFee)} تومان`}
                </span>
              </div>
              {walletApplied > 0 ? (
                <div className="flex justify-between text-emerald-700">
                  <span>کیف‌پول</span>
                  <span>−{toman(walletApplied)}</span>
                </div>
              ) : null}
              <div className="flex justify-between pt-2 text-base">
                <span>قابل پرداخت</span>
                <span className="text-lg font-extrabold text-[var(--retail-primary)]">{toman(payable)} تومان</span>
              </div>
            </div>
            <div className="mt-5 hidden lg:block">
              <CheckoutPlaceOrderBar
                appearance="retail"
                label={ctaLabel}
                hint={ctaHint}
                busy={busy}
                disabled={!items.length}
                onClick={submit}
              />
            </div>
          </aside>
        </div>
      </div>

      <CheckoutPlaceOrderBar
        appearance="retail"
        label={ctaLabel}
        hint={ctaHint}
        busy={busy}
        disabled={!items.length}
        onClick={submit}
        sticky
        amountLabel={`${toman(payable)} تومان`}
      />
    </div>
  );
}
