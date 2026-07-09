'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, XCircle, Loader2, ArrowRight } from 'lucide-react';
import { apiClient } from '@/lib/api';

function toman(n: number) { return Math.round(Number(n) / 10).toLocaleString('fa-IR'); }

function CallbackContent() {
  const params = useSearchParams();
  const [state, setState] = useState<'verifying' | 'success' | 'failed' | 'cancelled'>('verifying');
  const [refId, setRefId] = useState('');
  const [amount, setAmount] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    const paymentId = params.get('paymentId');
    const authority = params.get('Authority') ?? '';
    const status = params.get('Status') ?? 'NOK';

    if (!paymentId) { setState('failed'); setError('شناسه پرداخت یافت نشد'); return; }

    apiClient
      .post<any>('/payments/verify', { paymentId, authority, status })
      .then((res) => {
        if (res.ok) {
          setState('success');
          setRefId(res.refId ?? res.payment?.refId ?? '');
          setAmount(Number(res.payment?.amount ?? 0));
        } else if (res.cancelled) {
          setState('cancelled');
        } else {
          setState('failed');
          setError(res.error ?? 'تایید پرداخت ناموفق بود');
        }
      })
      .catch((e: any) => { setState('failed'); setError(e?.message ?? 'خطا در تایید پرداخت'); });
  }, [params]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 text-center">
        {state === 'verifying' && (
          <>
            <Loader2 className="h-14 w-14 text-primary animate-spin mx-auto mb-4" />
            <h1 className="text-lg font-bold text-gray-900">در حال تایید پرداخت...</h1>
            <p className="text-sm text-gray-500 mt-2">لطفاً صفحه را نبندید</p>
          </>
        )}

        {state === 'success' && (
          <>
            <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-9 w-9 text-green-600" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">پرداخت موفق</h1>
            {amount > 0 && (
              <p className="text-2xl font-bold text-primary mt-3">{toman(amount)} تومان</p>
            )}
            {refId && (
              <p className="text-sm text-gray-500 mt-2">
                کد پیگیری: <span className="font-mono font-bold text-gray-700">{refId}</span>
              </p>
            )}
            <p className="text-xs text-gray-400 mt-4">رسید پرداخت در بخش فاکتورهای پنل شما ثبت شد</p>
          </>
        )}

        {state === 'cancelled' && (
          <>
            <div className="h-16 w-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
              <XCircle className="h-9 w-9 text-amber-600" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">پرداخت لغو شد</h1>
            <p className="text-sm text-gray-500 mt-2">شما از ادامه پرداخت انصراف دادید. مبلغی کسر نشده است.</p>
          </>
        )}

        {state === 'failed' && (
          <>
            <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <XCircle className="h-9 w-9 text-red-600" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">پرداخت ناموفق</h1>
            <p className="text-sm text-gray-500 mt-2">{error}</p>
            <p className="text-xs text-gray-400 mt-3">
              در صورت کسر مبلغ، طی ۷۲ ساعت به حساب شما بازگردانده می‌شود
            </p>
          </>
        )}

        {state !== 'verifying' && (
          <Link
            href="/portal/dashboard/payments"
            className="btn btn-primary btn-md mt-6 inline-flex items-center gap-2"
          >
            بازگشت به فاکتورها
            <ArrowRight className="h-4 w-4 rotate-180" />
          </Link>
        )}
      </div>
    </div>
  );
}

export default function PaymentCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center" dir="rtl">
          <Loader2 className="h-10 w-10 text-primary animate-spin" />
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
