'use client';

import { useState } from 'react';
import { Loader2, Store, RefreshCw } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/cn';

type PushResult = {
  ok?: boolean;
  created?: number;
  mappedExisting?: number;
  failed?: number;
  remaining?: number;
  hasMore?: boolean;
  hint?: string;
  failedSample?: Array<{ sku: string; error: string }>;
};

type SyncResult = {
  ok?: boolean;
  updated?: number;
  unmappedCount?: number;
  hint?: string;
};

export function AdminBasalamCatalog() {
  const [busy, setBusy] = useState<'push' | 'sync' | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const pushCatalog = async () => {
    setBusy('push');
    setMsg(null);
    const totals = { created: 0, mappedExisting: 0, failed: 0 };
    const errors: string[] = [];
    try {
      for (let i = 0; i < 20; i += 1) {
        const res = await apiClient.post<PushResult>('/basalam/push-catalog?limit=8', {});
        totals.created += Number(res.created) || 0;
        totals.mappedExisting += Number(res.mappedExisting) || 0;
        totals.failed += Number(res.failed) || 0;
        for (const row of res.failedSample || []) {
          errors.push(`${row.sku}: ${row.error}`);
        }
        if (!res.hasMore) {
          const parts = [
            totals.created ? `${totals.created} محصول جدید در غرفه ساخته شد` : null,
            totals.mappedExisting ? `${totals.mappedExisting} محصول قبلی غرفه وصل شد` : null,
            totals.failed ? `${totals.failed} مورد رد شد` : null,
          ].filter(Boolean);
          setMsg({
            ok: totals.failed === 0,
            text:
              (parts.join('؛ ') || 'محصول جدیدی برای ارسال نبود') +
              (res.hint ? ` — ${res.hint}` : '') +
              (errors.length ? ` (${errors.slice(0, 3).join(' | ')})` : ''),
          });
          return;
        }
      }
      setMsg({
        ok: true,
        text: `ارسال بخشی انجام شد: ${totals.created} ساخته شد. دکمه را دوباره بزنید تا بقیه بروند.`,
      });
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message ?? 'ارسال به باسلام ناموفق بود' });
    } finally {
      setBusy(null);
    }
  };

  const syncInventory = async () => {
    setBusy('sync');
    setMsg(null);
    try {
      const res = await apiClient.post<SyncResult>('/basalam/sync-inventory?limit=80', {});
      setMsg({
        ok: res.ok !== false,
        text:
          res.ok === false
            ? 'به‌روزرسانی موجودی کامل نشد'
            : `${res.updated ?? 0} محصول به‌روز شد` +
              (res.unmappedCount ? `؛ ${res.unmappedCount} هنوز به غرفه وصل نشده` : '') +
              (res.hint ? ` — ${res.hint}` : ''),
      });
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message ?? 'همگام‌سازی موجودی ناموفق بود' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
      <p className="text-xs text-gray-600">
        اول توکن و شناسه غرفه را ذخیره کنید. دکمهٔ ارسال، محصولات فعال فروشگاه تکی را به غرفه می‌برد
        (موارد تکراری دوباره ساخته نمی‌شوند). محصول جدید به‌صورت پیش‌نویس می‌ماند تا عکس را در پنل باسلام بررسی و منتشر کنید.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void pushCatalog()}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-60"
        >
          {busy === 'push' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Store className="h-3.5 w-3.5" />}
          {busy === 'push' ? 'در حال ارسال به غرفه…' : 'ارسال محصولات تکی به غرفه'}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void syncInventory()}
          className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-bold text-emerald-900 hover:bg-emerald-50 disabled:opacity-60"
        >
          {busy === 'sync' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          {busy === 'sync' ? 'در حال به‌روزرسانی…' : 'به‌روزرسانی موجودی و قیمت'}
        </button>
      </div>
      {msg && (
        <p
          className={cn(
            'text-xs rounded-lg px-3 py-2 border',
            msg.ok ? 'bg-white border-emerald-200 text-emerald-900' : 'bg-amber-50 border-amber-200 text-amber-950',
          )}
        >
          {msg.text}
        </p>
      )}
    </div>
  );
}
