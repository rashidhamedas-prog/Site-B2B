'use client';

import type { ApplicationDetail, ApplicationRow } from './types';
import { SpBadge, spFocusClass } from '@/components/sales-partners/SpUi';
import { formatSpDate, spAppStatusLabel } from '@/components/sales-partners/sp-labels';

type Props = {
  open: boolean;
  loading: boolean;
  detail: ApplicationDetail | null;
  listHint?: ApplicationRow | null;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onReview: (action: 'APPROVE' | 'NEED_INFO' | 'REJECT') => void;
};

export function SpApplicationDetailDrawer({
  open,
  loading,
  detail,
  listHint,
  busy,
  error,
  onClose,
  onReview,
}: Props) {
  if (!open) return null;

  const title = detail?.displayName || listHint?.displayName || 'جزئیات درخواست';
  const status = detail?.status || listHint?.status || '';

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="sp-app-detail-title">
      <button type="button" className="absolute inset-0 bg-stone-900/40" aria-label="بستن" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-lg flex-col overflow-y-auto bg-[#faf8f5] shadow-2xl">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-stone-200 bg-[#faf8f5]/95 px-4 py-4 backdrop-blur">
          <div className="min-w-0">
            <p className="text-xs font-medium text-stone-500">بررسی درخواست همکاری</p>
            <h2 id="sp-app-detail-title" className="mt-1 truncate text-lg font-bold text-stone-900">
              {title}
            </h2>
            {status ? (
              <div className="mt-2">
                <SpBadge status={status} label={spAppStatusLabel(status)} />
              </div>
            ) : null}
          </div>
          <button
            type="button"
            className={`min-h-10 rounded-xl border border-stone-200 bg-white px-3 text-sm ${spFocusClass}`}
            onClick={onClose}
          >
            بستن
          </button>
        </header>

        <div className="space-y-4 px-4 py-4">
          {error ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
              {error}
            </p>
          ) : null}
          {loading && !detail ? (
            <p className="text-sm text-stone-600">در حال بارگذاری جزئیات…</p>
          ) : null}
          {detail ? (
            <>
              <section className="rounded-2xl border border-stone-200 bg-white p-4 text-sm">
                <h3 className="font-semibold text-stone-900">ارتباط</h3>
                <dl className="mt-3 space-y-2">
                  <div className="flex justify-between gap-3">
                    <dt className="text-stone-500">موبایل</dt>
                    <dd dir="ltr" className="font-medium tabular-nums text-stone-900">
                      {detail.phone}
                    </dd>
                  </div>
                  {detail.createdAt ? (
                    <div className="flex justify-between gap-3">
                      <dt className="text-stone-500">ثبت</dt>
                      <dd className="text-stone-800">{formatSpDate(detail.createdAt)}</dd>
                    </div>
                  ) : null}
                  {detail.reviewNote ? (
                    <div>
                      <dt className="text-stone-500">یادداشت بررسی</dt>
                      <dd className="mt-1 text-amber-900">{detail.reviewNote}</dd>
                    </div>
                  ) : null}
                </dl>
              </section>

              <section className="rounded-2xl border border-stone-200 bg-white p-4 text-sm">
                <h3 className="font-semibold text-stone-900">اطلاعات ثبت‌نام</h3>
                <dl className="mt-3 space-y-3">
                  {detail.answerRows.length === 0 ? (
                    <p className="text-stone-500">جزئیات بیشتری ثبت نشده.</p>
                  ) : (
                    detail.answerRows.map((row) => (
                      <div key={row.key} className="border-b border-stone-100 pb-2 last:border-0">
                        <dt className="text-xs text-stone-500">{row.label}</dt>
                        <dd className="mt-0.5 whitespace-pre-wrap break-words font-medium text-stone-900">{row.value}</dd>
                      </div>
                    ))
                  )}
                </dl>
              </section>

              {detail.socialHandles && Object.keys(detail.socialHandles).length > 0 ? (
                <section className="rounded-2xl border border-stone-200 bg-white p-4 text-sm">
                  <h3 className="font-semibold text-stone-900">شبکه‌های اجتماعی</h3>
                  <ul className="mt-2 space-y-1">
                    {Object.entries(detail.socialHandles).map(([key, value]) => (
                      <li key={key} className="flex justify-between gap-2">
                        <span className="text-stone-500">{key}</span>
                        <span dir="ltr" className="font-medium">
                          {value}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </>
          ) : null}
        </div>

        {detail && (detail.status === 'PENDING_REVIEW' || detail.status === 'NEEDS_INFORMATION') ? (
          <footer className="sticky bottom-0 mt-auto space-y-2 border-t border-stone-200 bg-[#faf8f5] px-4 py-4">
            <p className="text-xs text-stone-500">قبل از تأیید، اطلاعات بالا را کامل بخوانید.</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                className={`min-h-11 flex-1 rounded-xl bg-emerald-700 px-3 text-white ${spFocusClass}`}
                onClick={() => onReview('APPROVE')}
              >
                تأیید
              </button>
              <button
                type="button"
                disabled={busy}
                className={`min-h-11 flex-1 rounded-xl border border-stone-300 bg-white px-3 ${spFocusClass}`}
                onClick={() => onReview('NEED_INFO')}
              >
                تکمیل اطلاعات
              </button>
              <button
                type="button"
                disabled={busy}
                className={`min-h-11 w-full rounded-xl border border-red-300 px-3 text-red-800 sm:w-auto ${spFocusClass}`}
                onClick={() => onReview('REJECT')}
              >
                رد
              </button>
            </div>
          </footer>
        ) : null}
      </aside>
    </div>
  );
}
