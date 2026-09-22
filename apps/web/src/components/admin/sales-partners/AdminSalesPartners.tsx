'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';

type ApplicationRow = {
  id: string;
  displayName: string;
  phoneMasked: string;
  status: string;
  createdAt: string;
};

type PartnerRow = {
  id: string;
  displayName: string;
  status: string;
  statusLabel: string;
  statusReason: string | null;
  phoneMasked: string;
};

export function AdminSalesPartners() {
  const [tab, setTab] = useState<'applications' | 'partners'>('applications');
  const [apps, setApps] = useState<ApplicationRow[]>([]);
  const [partners, setPartners] = useState<PartnerRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const [nextApps, nextPartners] = await Promise.all([
        apiClient.get<ApplicationRow[]>('/admin/sales-partners/applications'),
        apiClient.get<PartnerRow[]>('/admin/sales-partners'),
      ]);
      setApps(nextApps);
      setPartners(nextPartners);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'بارگذاری ناموفق بود');
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function review(id: string, action: 'APPROVE' | 'NEED_INFO' | 'REJECT') {
    const reason = action === 'APPROVE' ? '' : window.prompt('دلیل را بنویسید') || '';
    if (action !== 'APPROVE' && reason.trim().length < 3) return;
    setBusyId(id);
    try {
      await apiClient.patch(`/admin/sales-partners/applications/${id}/review`, { action, reason: reason || undefined });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ثبت تصمیم ناموفق بود');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6" dir="rtl">
      <p className="text-sm text-stone-600">
        این بخش برای همکار بازاریاب است، نه تأمین‌کننده ارسال. برنامه تا روشن‌شدن فلگ روی سفارش‌های فعلی اثر ندارد.
      </p>
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
      <div className="flex gap-2">
        <button type="button" className={`min-h-11 rounded-xl px-4 ${tab === 'applications' ? 'bg-[#1B5C4A] text-white' : 'border'}`} onClick={() => setTab('applications')}>
          درخواست‌ها
        </button>
        <button type="button" className={`min-h-11 rounded-xl px-4 ${tab === 'partners' ? 'bg-[#1B5C4A] text-white' : 'border'}`} onClick={() => setTab('partners')}>
          همکاران
        </button>
      </div>

      {tab === 'applications' && (
        <ul className="space-y-3">
          {apps.length === 0 && <li className="text-sm text-stone-600">درخواستی نیست.</li>}
          {apps.map((row) => (
            <li key={row.id} className="rounded-xl border p-4">
              <p className="font-medium">{row.displayName}</p>
              <p className="text-sm text-stone-600">{row.phoneMasked} · {row.status}</p>
              {row.status === 'PENDING_REVIEW' && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" className="min-h-11 rounded-lg bg-emerald-700 px-3 text-white" disabled={busyId === row.id} onClick={() => review(row.id, 'APPROVE')}>تأیید</button>
                  <button type="button" className="min-h-11 rounded-lg border px-3" disabled={busyId === row.id} onClick={() => review(row.id, 'NEED_INFO')}>تکمیل اطلاعات</button>
                  <button type="button" className="min-h-11 rounded-lg border border-red-300 px-3 text-red-800" disabled={busyId === row.id} onClick={() => review(row.id, 'REJECT')}>رد</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {tab === 'partners' && (
        <ul className="space-y-3">
          {partners.length === 0 && <li className="text-sm text-stone-600">همکار بازاریابی ثبت نشده.</li>}
          {partners.map((row) => (
            <li key={row.id} className="rounded-xl border p-4">
              <p className="font-medium">{row.displayName}</p>
              <p className="text-sm text-stone-600">{row.phoneMasked} · {row.statusLabel}</p>
              {row.statusReason && <p className="mt-1 text-sm text-amber-800">{row.statusReason}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
