'use client';

import { useMemo, useState } from 'react';
import { apiClient } from '@/lib/api';
import { getRole } from '@/lib/auth';
import { ensureOptOutFooter } from './sms-parts';
import { PartsCounter, PhonePreview, SmsSection } from './sms-ui';

export function AdminSmsSend() {
  const role = typeof window !== 'undefined' ? getRole() : 'ADMIN';
  const promoDisabled = role === 'SMS_OPERATOR';
  const [to, setTo] = useState('');
  const [messageClass, setMessageClass] = useState<'TRANSACTIONAL' | 'PROMO'>('TRANSACTIONAL');
  const [body, setBody] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const previewBody = useMemo(
    () => ensureOptOutFooter(body, messageClass),
    [body, messageClass],
  );

  const submit = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await apiClient.post<any>('/admin/sms/send', {
        to,
        body: previewBody,
        messageClass,
        customerId: customerId || undefined,
      });
      if (res.status === 'PENDING_UNKNOWN') {
        setResult('ممکن است ارسال شده باشد؛ تکرار نکنید.');
      } else {
        setResult(`پیامک ارسال شد. شناسه: ${res.id || res.providerMessageId || '—'}`);
      }
    } catch (e: any) {
      setError(e?.message || 'ارسال ناموفق');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      <SmsSection title="ارسال تکی">
        <div className="space-y-3">
          <label className="block text-sm">
            گیرنده
            <input
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 ltr text-left"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="0912…"
              aria-invalid={!!error && error.includes('موبایل')}
            />
          </label>
          <fieldset>
            <legend className="text-sm font-medium">نوع پیام</legend>
            <div className="mt-2 flex flex-wrap gap-3">
              <label className="inline-flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={messageClass === 'TRANSACTIONAL'}
                  onChange={() => setMessageClass('TRANSACTIONAL')}
                />
                خدماتی
              </label>
              <label
                className={`inline-flex min-h-11 items-center gap-2 text-sm ${promoDisabled ? 'opacity-50' : ''}`}
                title={promoDisabled ? 'فقط بازاریاب، مدیر پیامک و مدیر کل' : undefined}
              >
                <input
                  type="radio"
                  checked={messageClass === 'PROMO'}
                  disabled={promoDisabled}
                  onChange={() => setMessageClass('PROMO')}
                />
                تبلیغاتی
              </label>
            </div>
            {promoDisabled && (
              <p className="mt-1 text-xs text-gray-500">تبلیغاتی فقط برای بازاریاب، مدیر پیامک و مدیر کل</p>
            )}
          </fieldset>
          {messageClass === 'PROMO' && (
            <label className="block text-sm">
              شناسه مشتری (برای بررسی رضایت)
              <input
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
              />
            </label>
          )}
          <label className="block text-sm">
            متن
            <textarea
              className="mt-1 min-h-[120px] w-full rounded-lg border border-gray-200 px-3 py-2 text-sm leading-7"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </label>
          <PartsCounter body={previewBody} />
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          {result && (
            <p role="status" className="text-sm text-emerald-800">
              {result}
            </p>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={submit}
            className="min-h-11 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
          >
            {busy ? 'در حال ارسال…' : 'ارسال'}
          </button>
        </div>
      </SmsSection>
      <PhonePreview body={previewBody} messageClass={messageClass} />
    </div>
  );
}
