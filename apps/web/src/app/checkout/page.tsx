'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, ShoppingCart, Trash2, CheckCircle } from 'lucide-react';
import { ProductImage } from '@/components/ui/ProductImage';
import { useCart } from '@/lib/cart';
import { apiClient } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { cn } from '@/lib/cn';

function toman(n: number) { return Math.round(n / 10).toLocaleString('fa-IR'); }

const SHIPPING_METHODS = [
  { value: 'CHAPAR', label: 'چاپار' },
  { value: 'TIPAX', label: 'تیپاکس' },
  { value: 'POST', label: 'پست پیشتاز' },
  { value: 'IN_PERSON', label: 'تحویل حضوری' },
];

const PAYMENT_METHODS = [
  { value: 'CREDIT', label: 'نسیه (اعتبار حساب)' },
  { value: 'BANK_TRANSFER', label: 'کارت به کارت / انتقال بانکی' },
  { value: 'CHECK', label: 'چک' },
  { value: 'CASH', label: 'نقد' },
];

export default function CheckoutPage() {
  const router = useRouter();
  const { items, total, updateQty, removeItem, clear } = useCart();
  const [shippingMethod, setShippingMethod] = useState('CHAPAR');
  const [paymentMethod, setPaymentMethod] = useState('CREDIT');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');

  useEffect(() => {
    if (!getToken()) {
      router.replace('/portal/login?redirect=/checkout');
    }
  }, [router]);
  if (!getToken()) return null;

  const shippingFee = total >= 50_000_000 ? 0 : 1_500_000;
  const finalTotal = total + shippingFee;

  const handleSubmit = async () => {
    if (!getToken()) { router.push('/portal/login?redirect=/checkout'); return; }
    if (items.length === 0) { setError('سبد خرید خالی است'); return; }
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
                {SHIPPING_METHODS.map((m) => (
                  <button key={m.value} onClick={() => setShippingMethod(m.value)}
                    className={cn('px-4 py-2.5 rounded-xl text-sm font-medium border-2 transition-all text-right',
                      shippingMethod === m.value ? 'bg-primary text-white border-primary' : 'border-gray-200 text-gray-700 hover:border-primary')}>
                    {m.label}
                  </button>
                ))}
              </div>

              <h3 className="font-bold text-gray-900 pt-2">روش پرداخت</h3>
              <div className="grid grid-cols-2 gap-3">
                {PAYMENT_METHODS.map((m) => (
                  <button key={m.value} onClick={() => setPaymentMethod(m.value)}
                    className={cn('px-4 py-2.5 rounded-xl text-sm font-medium border-2 transition-all text-right',
                      paymentMethod === m.value ? 'bg-primary text-white border-primary' : 'border-gray-200 text-gray-700 hover:border-primary')}>
                    {m.label}
                  </button>
                ))}
              </div>

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
              <button onClick={handleSubmit} disabled={loading}
                className="w-full btn btn-primary btn-lg mt-2">
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
