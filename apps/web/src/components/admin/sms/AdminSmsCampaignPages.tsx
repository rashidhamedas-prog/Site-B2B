'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { getRole } from '@/lib/auth';
import { SmsSection, SmsStatusBadge, SmsClassBadge } from './sms-ui';

export function AdminSmsCampaignRun() {
  const { id } = useParams<{ id: string }>();
  const [camp, setCamp] = useState<any>(null);
  const [msgs, setMsgs] = useState<any[]>([]);
  const [confirmPause, setConfirmPause] = useState(false);

  const load = () => {
    apiClient.get(`/admin/sms/campaigns/${id}`).then(setCamp).catch(() => undefined);
    apiClient.get<any[]>(`/admin/sms/messages?campaignId=${id}`).then(setMsgs).catch(() => []);
  };
  useEffect(() => {
    load();
  }, [id]);

  const counts = {
    delivered: msgs.filter((m) => m.status === 'DELIVERED' || m.status === 'SENT').length,
    failed: msgs.filter((m) => m.status === 'FAILED' || m.status === 'UNDELIVERED').length,
    queued: msgs.filter((m) => m.status === 'QUEUED' || m.status === 'SENDING').length,
  };
  const total = Math.max(1, msgs.length);

  return (
    <SmsSection
      title={camp?.name || 'اجرای کمپین'}
      actions={<SmsStatusBadge status={camp?.status || 'QUEUED'} />}
    >
      {camp && (
        <div className="mb-3 flex flex-wrap gap-2">
          <SmsClassBadge messageClass={camp.messageClass} />
          <span className="text-sm text-gray-600">
            گیرندگان: {(camp.recipientCount || 0).toLocaleString('fa-IR')}
          </span>
        </div>
      )}
      <div className="mb-2 h-3 overflow-hidden rounded-full bg-gray-100" role="img" aria-label="پیشرفت کمپین">
        <div className="flex h-full">
          <div className="bg-emerald-500" style={{ width: `${(counts.delivered / total) * 100}%` }} />
          <div className="bg-red-500" style={{ width: `${(counts.failed / total) * 100}%` }} />
          <div className="bg-amber-400" style={{ width: `${(counts.queued / total) * 100}%` }} />
        </div>
      </div>
      <div className="mb-4 flex flex-wrap gap-3 text-xs">
        <span>تحویل/ارسال {counts.delivered.toLocaleString('fa-IR')}</span>
        <span>ناموفق {counts.failed.toLocaleString('fa-IR')}</span>
        <span>در صف {counts.queued.toLocaleString('fa-IR')}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="min-h-11 rounded-lg border border-red-300 px-4 text-sm font-bold text-red-800"
          onClick={() => setConfirmPause(true)}
        >
          توقف اضطراری
        </button>
        <button
          type="button"
          className="min-h-11 rounded-lg border px-4 text-sm"
          onClick={() => apiClient.post(`/admin/sms/campaigns/${id}/cancel`, {}).then(load)}
        >
          لغو کمپین
        </button>
        <button type="button" className="min-h-11 rounded-lg border px-4 text-sm" onClick={load}>
          تازه‌سازی
        </button>
      </div>
      {confirmPause && (
        <div role="alertdialog" aria-modal="true" className="mt-4 rounded-xl border bg-white p-4 shadow">
          <p className="text-sm font-bold">توقف اضطراری؟</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              autoFocus
              className="min-h-11 rounded-lg border px-4 text-sm font-bold"
              onClick={() => setConfirmPause(false)}
            >
              انصراف
            </button>
            <button
              type="button"
              className="min-h-11 rounded-lg bg-red-700 px-4 text-sm font-bold text-white"
              onClick={() => {
                apiClient.post(`/admin/sms/campaigns/${id}/pause`, {}).then(() => {
                  setConfirmPause(false);
                  load();
                });
              }}
            >
              توقف
            </button>
          </div>
        </div>
      )}
    </SmsSection>
  );
}

export function AdminSmsCampaignApproval() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const role = typeof window !== 'undefined' ? getRole() : 'ADMIN';
  const [camp, setCamp] = useState<any>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient.get(`/admin/sms/campaigns/${id}`).then(setCamp).catch(() => undefined);
  }, [id]);

  const meIsCreator = camp?.createdBy && false; // server enforces; UI hint via role
  const canApprove = role === 'ADMIN' || role === 'SMS_MANAGER';

  return (
    <SmsSection title="تأیید مدیر">
      {!canApprove && (
        <p role="alert" className="mb-3 text-sm text-red-700">
          این صفحه نیاز به نقش مدیر پیامک یا مدیر کل دارد
        </p>
      )}
      {camp && (
        <ul className="mb-4 space-y-1 text-sm">
          <li>نام: {camp.name}</li>
          <li>
            نوع: <SmsClassBadge messageClass={camp.messageClass} />
          </li>
          <li>گیرندگان: {(camp.recipientCount || 0).toLocaleString('fa-IR')}</li>
          <li className="whitespace-pre-wrap rounded-lg bg-gray-50 p-3">{camp.bodySnapshot}</li>
        </ul>
      )}
      {error && (
        <p role="alert" className="mb-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <label className="mb-3 block text-sm">
        دلیل رد (در صورت رد)
        <input className="mt-1 w-full rounded-lg border px-3 py-2" value={reason} onChange={(e) => setReason(e.target.value)} />
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          autoFocus
          className="min-h-11 rounded-lg border px-4 text-sm font-bold"
          onClick={() => router.push(`/admin/sms/campaigns/${id}`)}
        >
          بازگشت
        </button>
        <button
          type="button"
          className="min-h-11 rounded-lg border border-red-300 px-4 text-sm font-bold text-red-800"
          onClick={() =>
            apiClient
              .post(`/admin/sms/campaigns/${id}/approve`, { reject: true, reason })
              .then(() => router.push('/admin/sms'))
              .catch((e) => setError(e?.message || 'خطا'))
          }
        >
          رد کمپین
        </button>
        <button
          type="button"
          disabled={!canApprove || meIsCreator}
          className="min-h-11 rounded-lg bg-red-700 px-4 text-sm font-bold text-white disabled:opacity-50"
          aria-describedby={meIsCreator ? 'four-eyes' : undefined}
          onClick={() =>
            apiClient
              .post(`/admin/sms/campaigns/${id}/approve`, {})
              .then(() => router.push(`/admin/sms/campaigns/${id}`))
              .catch((e) => setError(e?.message || 'خطا'))
          }
        >
          تأیید و شروع ارسال
        </button>
      </div>
      {meIsCreator && (
        <p id="four-eyes" className="mt-2 text-xs text-gray-500">
          سازنده نمی‌تواند خودش را تأیید کند
        </p>
      )}
    </SmsSection>
  );
}
