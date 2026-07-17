'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, ShoppingCart, Trash2, CheckCircle, AlertCircle } from 'lucide-react';
import { ProductImage } from '@/components/ui/ProductImage';
import { useCart } from '@/lib/cart';
import { apiClient } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { cn } from '@/lib/cn';

function toman(n: number) { return Math.round(n / 10).toLocaleString('fa-IR'); }

type ShippingCompany = { id: string; label: string };
type InstallmentRule = {
  id: string;
  minDownPaymentPercent: number;
  maxMonths: number;
  categoryId: string | null;
};
type InstallmentsCfg = {
  minDownPaymentPercent: number;
  minDownPaymentAmount: number;
  maxMonths: number;
  rules?: InstallmentRule[];
  minActiveInvoices?: number;
};
type PublicSettings = { installments: InstallmentsCfg };
type Eligibility = {
  eligible: boolean;
  activeInvoiceCount?: number;
  required?: number;
  rules?: InstallmentRule[];
  minDownPaymentPercent?: number;
  maxMonths?: number;
  message?: string | null;
};

function getCustomerIdFromToken(): string | null {
  try {
    const token = getToken();
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1] ?? ''));
    return typeof payload?.customerId === 'string' && payload.customerId
      ? payload.customerId
      : null;
  } catch {
    return null;
  }
}

function pickInstallmentRule(
  cfg: InstallmentsCfg | null,
  categoryIds: string[],
): { minDownPaymentPercent: number; minDownPaymentAmount: number; maxMonths: number } {
  if (!cfg) {
    return { minDownPaymentPercent: 0, minDownPaymentAmount: 0, maxMonths: 12 };
  }
  const rules = cfg.rules ?? [];
  const matched =
    rules.find((r) => r.categoryId && categoryIds.includes(r.categoryId))
    ?? rules.find((r) => !r.categoryId)
    ?? null;
  if (matched) {
    return {
      minDownPaymentPercent: matched.minDownPaymentPercent,
      minDownPaymentAmount: cfg.minDownPaymentAmount || 0,
      maxMonths: matched.maxMonths,
    };
  }
  return {
    minDownPaymentPercent: cfg.minDownPaymentPercent,
    minDownPaymentAmount: cfg.minDownPaymentAmount || 0,
    maxMonths: cfg.maxMonths,
  };
}

export default function CheckoutPage() {
  const router = useRouter();
  const { items, total, updateQty, removeItem, clear } = useCart();
  const [shippingMethod, setShippingMethod] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'INSTALLMENT'>('CASH');
  const [downPaymentAmount, setDownPaymentAmount] = useState<number>(0);
  const [installmentMonths, setInstallmentMonths] = useState<number>(1);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');
  const [shippingCompanies, setShippingCompanies] = useState<ShippingCompany[]>([]);
  const [installmentsCfg, setInstallmentsCfg] = useState<InstallmentsCfg | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerIdReady, setCustomerIdReady] = useState(false);
  const [eligibility, setEligibility] = useState<Eligibility | null>(null);
  const [eligibilityLoading, setEligibilityLoading] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/portal/login?redirect=/checkout');
    }
  }, [router]);

  useEffect(() => {
    if (!getToken()) return;
    apiClient.get<ShippingCompany[]>('/shipping/methods')
      .then((m) => {
        setShippingCompanies(m ?? []);
        if (!shippingMethod && m?.length) setShippingMethod(m[0].id);
      })
      .catch(() => undefined);
    apiClient.get<PublicSettings>('/settings/public')
      .then((s) => {
        if (s?.installments) {
          setInstallmentsCfg(s.installments);
          setInstallmentMonths((prev) => Math.min(Math.max(1, prev), s.installments.maxMonths));
        }
      })
      .catch(() => undefined);

    // Resolve customerId: JWT → profile → first order
    const fromToken = getCustomerIdFromToken();
    if (fromToken) {
      setCustomerId(fromToken);
      setCustomerIdReady(true);
    } else {
      Promise.allSettled([
        apiClient.get<{ customerId?: string; id?: string }>('/auth/me/profile'),
        apiClient.get<{ data?: Array<{ customerId?: string }> }>('/orders?limit=1'),
      ]).then(([profileRes, ordersRes]) => {
        if (profileRes.status === 'fulfilled') {
          const p = profileRes.value as { customerId?: string };
          if (p?.customerId) {
            setCustomerId(p.customerId);
            return;
          }
        }
        if (ordersRes.status === 'fulfilled') {
          const cid = ordersRes.value?.data?.[0]?.customerId;
          if (cid) setCustomerId(cid);
        }
      }).finally(() => setCustomerIdReady(true));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (paymentMethod !== 'INSTALLMENT') {
      setEligibility(null);
      return;
    }
    if (!customerIdReady) {
      setEligibilityLoading(true);
      return;
    }
    if (!customerId) {
      setEligibilityLoading(false);
      setEligibility({
        eligible: false,
        message: 'برای پرداخت اقساطی باید با حساب تأییدشده وارد شوید.',
      });
      return;
    }
    let cancelled = false;
    setEligibilityLoading(true);
    apiClient
      .get<Eligibility>(`/orders/installment-eligibility/${customerId}`)
      .then((res) => {
        if (!cancelled) {
          setEligibility(res);
          if (res.rules?.length || res.maxMonths) {
            setInstallmentsCfg((prev) => ({
              minDownPaymentPercent: res.minDownPaymentPercent ?? prev?.minDownPaymentPercent ?? 0,
              minDownPaymentAmount: prev?.minDownPaymentAmount ?? 0,
              maxMonths: res.maxMonths ?? prev?.maxMonths ?? 6,
              rules: res.rules ?? prev?.rules,
              minActiveInvoices: res.required ?? prev?.minActiveInvoices,
            }));
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setEligibility({
            eligible: false,
            message: 'بررسی واجد شرایط بودن اقساط ممکن نشد. لطفاً دوباره تلاش کنید.',
          });
        }
      })
      .finally(() => {
        if (!cancelled) setEligibilityLoading(false);
      });
    return () => { cancelled = true; };
  }, [paymentMethod, customerId, customerIdReady]);

  const shippingFee = total >= 50_000_000 ? 0 : 1_500_000;
  const finalTotal = total + shippingFee;

  // Cart items currently lack categoryId; match global (null) rule or legacy fields
  const activeRule = useMemo(
    () => pickInstallmentRule(installmentsCfg, []),
    [installmentsCfg],
  );

  const installmentMinDownPayment = useMemo(() => {
    const byPercent = activeRule.minDownPaymentPercent > 0
      ? Math.ceil((finalTotal * activeRule.minDownPaymentPercent) / 100)
      : 0;
    return Math.max(byPercent, activeRule.minDownPaymentAmount || 0);
  }, [finalTotal, activeRule]);

  const installmentBlocked =
    paymentMethod === 'INSTALLMENT'
    && (eligibilityLoading || !eligibility?.eligible);

  if (!getToken()) return null;

  const handleSubmit = async () => {
    if (!getToken()) { router.push('/portal/login?redirect=/checkout'); return; }
    if (items.length === 0) { setError('سبد خرید خالی است'); return; }
    if (!shippingMethod) { setError('لطفاً روش ارسال را انتخاب کنید'); return; }
    if (paymentMethod === 'INSTALLMENT') {
      if (!customerId) {
        setError('برای پرداخت اقساطی باید با حساب تأییدشده وارد شوید.');
        return;
      }
      if (!eligibility?.eligible) {
        setError(eligibility?.message || 'شما واجد شرایط پرداخت اقساطی نیستید');
        return;
      }
      if (!installmentsCfg) { setError('تنظیمات اقساط هنوز آماده نیست'); return; }
      if (installmentMonths < 1 || installmentMonths > activeRule.maxMonths) {
        setError(`حداکثر اقساط مجاز: ${activeRule.maxMonths} ماه`);
        return;
      }
      if (downPaymentAmount < installmentMinDownPayment) {
        setError(`حداقل پیش‌پرداخت: ${toman(installmentMinDownPayment)} تومان`);
        return;
      }
    }
    setLoading(true); setError('');
    try {
      const orderItems = items.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        productName: i.productName,
        sku: i.sku,
      }));
      const res = await apiClient.post<{ orderNumber: string; id: string }>('/orders', {
        items: orderItems,
        shippingMethod,
        paymentMethod,
        installment: paymentMethod === 'INSTALLMENT'
          ? { downPaymentAmount, months: installmentMonths }
          : undefined,
        notes,
      });
      setOrderNumber(res.orderNumber);
      clear();
      setDone(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'خطا در ثبت سفارش');
    } finally { setLoading(false); }
  };

  if (done) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="card p-10 max-w-md w-full text-center space-y-5">
        <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
          <CheckCircle className="h-8 w-8 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">سفارش ثبت شد!</h2>
        <p className="text-gray-500">شماره سفارش شما: <span className="font-mono font-bold text-primary">{orderNumber}</span></p>
        <p className="text-sm text-gray-400">تیم فروش ما به زودی با شما تماس خواهد گرفت.</p>
        <div className="flex flex-col gap-3">
          <Link href="/portal/dashboard/orders" className="btn btn-primary btn-md">مشاهده سفارش‌ها</Link>
          <Link href="/products" className="btn btn-outline btn-md">ادامه خرید</Link>
        </div>
      </div>
    </div>
  );

  if (items.length === 0) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="card p-10 max-w-sm w-full text-center space-y-4">
        <ShoppingCart className="h-12 w-12 text-gray-200 mx-auto" />
        <h2 className="text-lg font-bold text-gray-900">سبد خرید خالی است</h2>
        <Link href="/products" className="btn btn-primary btn-md block">مشاهده محصولات</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100">
        <div className="container-site py-3 flex items-center gap-3">
          <Link href="/products" className="text-gray-400 hover:text-primary"><ArrowRight className="h-5 w-5" /></Link>
          <h1 className="text-lg font-bold text-gray-900">تکمیل سفارش</h1>
        </div>
      </div>

      <div className="container-site py-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Cart items */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="font-bold text-gray-900">اقلام سبد خرید</h2>
            <div className="card divide-y divide-gray-50">
              {items.map((item) => (
                <div key={item.productId} className="flex items-start gap-4 p-4">
                  <div className="relative h-16 w-12 flex-shrink-0 rounded-xl overflow-hidden bg-primary-50">
                    <ProductImage src={item.imageUrl} alt={item.productName} sizes="48px" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 line-clamp-1">{item.productName}</p>
                    <p className="text-xs text-gray-400 font-mono">{item.sku}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden text-sm">
                      <button onClick={() => updateQty(item.productId, item.quantity - Math.max(1, item.minOrderQty))}
                        className="w-8 h-8 flex items-center justify-center hover:bg-gray-100">−</button>
                      <span className="w-8 text-center font-bold">{item.quantity}</span>
                      <button onClick={() => updateQty(item.productId, item.quantity + Math.max(1, item.minOrderQty))}
                        className="w-8 h-8 flex items-center justify-center hover:bg-gray-100">+</button>
                    </div>
                    <div className="text-left min-w-[80px]">
                      <p className="text-sm font-bold text-gray-900">{toman(item.unitPrice * item.quantity)} ت</p>
                      <p className="text-[10px] text-gray-400">{toman(item.unitPrice)}/عدد</p>
                    </div>
                    <button onClick={() => removeItem(item.productId)} className="text-gray-300 hover:text-error">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Shipping & payment */}
            <div className="card p-5 space-y-4">
              <h3 className="font-bold text-gray-900">روش ارسال</h3>
              <div className="grid grid-cols-2 gap-3">
                {shippingCompanies.map((m) => (
                  <button key={m.id} onClick={() => setShippingMethod(m.id)}
                    className={cn('px-4 py-2.5 rounded-xl text-sm font-medium border-2 transition-all text-right',
                      shippingMethod === m.id ? 'bg-primary text-white border-primary' : 'border-gray-200 text-gray-700 hover:border-primary')}>
                    {m.label}
                  </button>
                ))}
              </div>

              <h3 className="font-bold text-gray-900 pt-2">روش پرداخت</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'CASH' as const, label: 'پرداخت نقدی' },
                  { value: 'INSTALLMENT' as const, label: 'پرداخت اقساطی' },
                ].map((m) => (
                  <button key={m.value} onClick={() => setPaymentMethod(m.value)}
                    className={cn('px-4 py-2.5 rounded-xl text-sm font-medium border-2 transition-all text-right',
                      paymentMethod === m.value ? 'bg-primary text-white border-primary' : 'border-gray-200 text-gray-700 hover:border-primary')}>
                    {m.label}
                  </button>
                ))}
              </div>

              {paymentMethod === 'INSTALLMENT' && (
                <div className="rounded-2xl border border-primary/10 bg-primary/5 p-4 space-y-3">
                  {eligibilityLoading && (
                    <p className="text-xs text-gray-500">در حال بررسی واجد شرایط بودن اقساط...</p>
                  )}
                  {!eligibilityLoading && eligibility && !eligibility.eligible && (
                    <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-100 px-3 py-2.5 text-sm text-amber-800">
                      <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                      <p>{eligibility.message || 'شما واجد شرایط پرداخت اقساطی نیستید'}</p>
                    </div>
                  )}
                  {!eligibilityLoading && eligibility?.eligible && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">پیش‌پرداخت (ریال)</label>
                        <input
                          type="number"
                          value={downPaymentAmount}
                          onChange={(e) => setDownPaymentAmount(Number(e.target.value) || 0)}
                          className="w-full rounded-xl border border-gray-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                        <p className="text-[11px] text-gray-500 mt-1">
                          حداقل: {toman(installmentMinDownPayment)} تومان
                          {activeRule.minDownPaymentPercent > 0 && (
                            <> ({activeRule.minDownPaymentPercent}٪)</>
                          )}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">تعداد اقساط (ماه)</label>
                        <input
                          type="number"
                          value={installmentMonths}
                          min={1}
                          max={activeRule.maxMonths}
                          onChange={(e) => setInstallmentMonths(Number(e.target.value) || 1)}
                          className="w-full rounded-xl border border-gray-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                        <p className="text-[11px] text-gray-500 mt-1">
                          حداکثر: {activeRule.maxMonths} ماه
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">یادداشت (اختیاری)</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                  placeholder="آدرس دقیق، نوع بسته‌بندی یا هر توضیح دیگری..."
                  className="w-full rounded-xl border border-gray-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="space-y-4">
            <div className="card p-5 space-y-3 sticky top-24">
              <h2 className="font-bold text-gray-900">خلاصه سفارش</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">جمع اقلام ({items.length})</span>
                  <span className="font-medium">{toman(total)} ت</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">هزینه ارسال</span>
                  <span className={cn('font-medium', shippingFee === 0 && 'text-success')}>
                    {shippingFee === 0 ? 'رایگان' : `${toman(shippingFee)} ت`}
                  </span>
                </div>
                {total >= 50_000_000 && (
                  <p className="text-xs text-success">✓ ارسال رایگان برای سفارش‌های بالای ۵ میلیون تومان</p>
                )}
              </div>
              <div className="border-t border-gray-100 pt-3 flex justify-between font-bold text-base">
                <span>مجموع</span>
                <span className="text-primary">{toman(finalTotal)} تومان</span>
              </div>
              {error && <p className="text-xs text-error">{error}</p>}
              <button
                onClick={handleSubmit}
                disabled={loading || installmentBlocked}
                className="w-full btn btn-primary btn-lg mt-2 disabled:opacity-50"
              >
                {loading ? 'در حال ثبت سفارش...' : 'ثبت نهایی سفارش'}
              </button>
              <p className="text-xs text-gray-400 text-center">
                با ثبت سفارش، <Link href="/terms" className="text-primary hover:underline">شرایط و قوانین</Link> را می‌پذیرید
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
