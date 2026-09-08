'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Phone } from 'lucide-react';
import { Callout, Section } from '../admin-omnichannel-ui';
import { Modal } from '@/components/ui';
import { apiClient } from '@/lib/api';
import { useCustomerDossier } from '@/lib/hooks/useCustomerMarketing';

const CALL_RESULTS = [
  { id: 'CONNECTED', label: 'وصل شد' },
  { id: 'NO_ANSWER', label: 'جواب نداد' },
  { id: 'BUSY', label: 'اشغال' },
  { id: 'WRONG_NUMBER', label: 'شماره اشتباه' },
  { id: 'CALLBACK', label: 'بعداً تماس' },
];

export function AdminCustomerDossier() {
  const params = useParams<{ id: string }>();
  const id = String(params?.id || '');
  const { data, loading, error, reload } = useCustomerDossier(id);
  const [callOpen, setCallOpen] = useState(false);
  const [callResult, setCallResult] = useState('CONNECTED');
  const [callNotes, setCallNotes] = useState('');
  const [templateCode, setTemplateCode] = useState('');
  const [body, setBody] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const customer = (data?.customer || null) as Record<string, unknown> | null;
  const templates = (data?.templates || []) as Array<Record<string, unknown>>;
  const timeline = (data?.timeline || []) as Array<Record<string, unknown>>;
  const orders = (data?.orders || []) as Array<Record<string, unknown>>;
  const enrollment = data?.enrollment as Record<string, unknown> | null;
  const consent = data?.consent as Record<string, unknown> | null;
  const phone = customer ? String(customer.phone || '') : '';

  const selected = useMemo(
    () => templates.find((t) => t.code === templateCode),
    [templates, templateCode],
  );

  const applyTemplate = (code: string) => {
    setTemplateCode(code);
    const tpl = templates.find((t) => t.code === code);
    setBody(String(tpl?.body || ''));
    setPreview(null);
  };

  const sendSms = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await apiClient.post<{ preview?: boolean; body?: string; status?: string; reason?: string }>(
        `/customers/${id}/marketing/sms`,
        { templateCode: templateCode || undefined, body },
        { headers: { 'Idempotency-Key': `ui:${id}:${templateCode || 'custom'}:${Date.now()}` } },
      );
      setPreview(res.body || body);
      setNotice(res.preview
        ? `پیش‌نمایش آماده است (${res.reason || res.status}). ارسال زنده خاموش است.`
        : `وضعیت صف: ${res.status}${res.reason ? ` — ${res.reason}` : ''}`);
      await reload();
    } catch (e: unknown) {
      setNotice(e instanceof Error ? e.message : 'ارسال نشد');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p className="text-sm text-gray-500">در حال بارگذاری پرونده…</p>;
  if (error || !customer) {
    return (
      <Callout tone="danger">
        {error || 'مشتری یافت نشد'} <Link href="/admin/customers" className="underline">بازگشت به فهرست</Link>
      </Callout>
    );
  }

  const channel = String(customer.channel);
  const noPhone = !phone;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-gray-500">
            <Link href="/admin/customers" className="hover:underline">فهرست مشتریان</Link>
            {' / '}
            <Link href="/admin/customers/marketing" className="hover:underline">بازاریابی</Link>
          </p>
          <h2 className="mt-1 text-xl font-bold text-gray-900">{String(customer.businessName)}</h2>
          <p className="text-sm text-gray-500">{String(customer.ownerName)} · {String(customer.city)}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${channel === 'RETAIL' ? 'bg-amber-100 text-amber-800' : 'bg-[#1B5C4A]/10 text-[#1B5C4A]'}`}>
          {channel === 'RETAIL' ? 'تکی' : 'عمده'}
        </span>
      </div>

      {notice && <Callout tone="info">{notice}</Callout>}
      {noPhone && <Callout tone="warn">شماره موبایل ثبت نشده؛ تماس و پیامک ممکن نیست.</Callout>}
      {data?.suppressed === true && <Callout tone="danger">این شماره در فهرست لغو تبلیغ است.</Callout>}

      <div className="grid gap-4 lg:grid-cols-3">
        <Section title="هویت و قیف">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-gray-500">کد</dt><dd className="font-mono" dir="ltr">{String(customer.code)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-gray-500">وضعیت حساب</dt><dd>{String(customer.status)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-gray-500">مرحله قیف</dt><dd>{String(enrollment?.stage || 'بدون قیف')}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-gray-500">رضایت</dt><dd>{String(consent?.status || 'ثبت نشده')}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-gray-500">موبایل</dt><dd dir="ltr">{phone || '—'}</dd></div>
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={noPhone}
              onClick={() => {
                if (phone) window.location.href = `tel:${phone}`;
                setCallOpen(true);
              }}
              className="btn btn-primary btn-sm min-h-11"
            >
              <Phone className="h-4 w-4" />تماس و ثبت نتیجه
            </button>
            <button
              type="button"
              onClick={async () => {
                await apiClient.post(`/customers/${id}/marketing/opt-out`, {});
                await reload();
              }}
              className="btn btn-ghost btn-sm min-h-11"
            >
              لغو تبلیغ
            </button>
            <button
              type="button"
              onClick={async () => {
                try {
                  await apiClient.post(`/customers/${id}/marketing/opt-in`, {});
                  await reload();
                } catch (e: unknown) {
                  setNotice(e instanceof Error ? e.message : 'فقط مدیر کل می‌تواند رضایت تبلیغ بدهد');
                }
              }}
              className="btn btn-ghost btn-sm min-h-11"
            >
              رضایت تبلیغ
            </button>
          </div>
        </Section>

        <Section title="آهنگ‌ساز پیام" description="سناریو را انتخاب کنید، یک‌بار ویرایش کنید، بعد پیش‌نمایش.">
          {templates.length === 0 ? (
            <p className="text-sm text-gray-400">قالبی برای این کانال نیست.</p>
          ) : (
            <>
              <select
                value={templateCode}
                onChange={(e) => applyTemplate(e.target.value)}
                className="min-h-11 w-full rounded-lg border border-gray-200 px-3 text-sm"
              >
                <option value="">انتخاب سناریو</option>
                {templates.map((t) => (
                  <option key={String(t.code)} value={String(t.code)}>{String(t.title)}</option>
                ))}
              </select>
              {selected?.callScript ? (
                <p className="mt-2 whitespace-pre-line rounded-lg bg-gray-50 p-3 text-xs leading-6 text-gray-600">{String(selected.callScript)}</p>
              ) : null}
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={6}
                className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm leading-6"
                placeholder="متن پیامک"
              />
              <button type="button" disabled={busy || !body} onClick={sendSms} className="btn btn-primary btn-sm mt-2 min-h-11">
                پیش‌نمایش / ارسال
              </button>
              {preview && (
                <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-[#0F2F28] p-3 text-sm text-[#F6F1E8]">{preview}</pre>
              )}
            </>
          )}
        </Section>

        <Section title="سفارش‌های اخیر">
          {orders.length === 0 ? (
            <p className="text-sm text-gray-400">سفارشی نیست — اقدام بعدی تماس یا پیامک پرورشی است.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {orders.map((o) => (
                <li key={String(o.id)} className="flex justify-between gap-2">
                  <span className="font-mono" dir="ltr">{String(o.orderNumber)}</span>
                  <span>{String(o.status)}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <Section title="تایم‌لاین">
        {timeline.length === 0 ? (
          <p className="text-sm text-gray-400">هنوز تماس یا پیامکی ثبت نشده.</p>
        ) : (
          <ol className="space-y-3">
            {timeline.map((a) => (
              <li key={String(a.id)} className="rounded-xl border border-gray-100 p-3 text-sm">
                <p className="font-semibold text-gray-900">{String(a.type)}</p>
                <p className="text-xs text-gray-500">{a.occurredAt ? new Date(String(a.occurredAt)).toLocaleString('fa-IR') : ''}</p>
                <p className="mt-1 text-xs text-gray-600">{JSON.stringify(a.payload)}</p>
              </li>
            ))}
          </ol>
        )}
      </Section>

      <Modal open={callOpen} onClose={() => setCallOpen(false)} title="نتیجه تماس">
        <div className="space-y-3">
          <select value={callResult} onChange={(e) => setCallResult(e.target.value)} className="min-h-11 w-full rounded-lg border px-3">
            {CALL_RESULTS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
          <textarea value={callNotes} onChange={(e) => setCallNotes(e.target.value)} rows={3} className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="یادداشت" />
          <button
            type="button"
            className="btn btn-primary min-h-11 w-full"
            onClick={async () => {
              await apiClient.post(`/customers/${id}/marketing/calls`, { result: callResult, notes: callNotes });
              setCallOpen(false);
              setCallNotes('');
              await reload();
            }}
          >
            ثبت نتیجه
          </button>
        </div>
      </Modal>
    </div>
  );
}
