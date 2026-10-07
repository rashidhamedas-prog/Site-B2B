'use client';

import { useEffect } from 'react';
import { toman } from '@/lib/product-display';
import { SpBadge, SpButton, spFocusClass } from '@/components/sales-partners/SpUi';
import { formatSpDate, SP_DRAFT_STATUS_FA, SP_PARTNER_STATUS_FA } from '@/components/sales-partners/sp-labels';
import { adminDraftNextStep } from './sp-admin-ops';
import type { DraftDetail, DraftRow } from './types';

type Props = {
  open: boolean;
  loading: boolean;
  detail: DraftDetail | null;
  listHint?: DraftRow | null;
  partnerName?: string;
  error: string | null;
  onClose: () => void;
  onChangeAttribution?: () => void;
};

export function SpOrderDetailDrawer({
  open,
  loading,
  detail,
  listHint,
  partnerName,
  error,
  onClose,
  onChangeAttribution,
}: Props) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const status = detail?.status || listHint?.status || '';
  const statusLabel =
    detail?.statusLabel || listHint?.statusLabel || SP_DRAFT_STATUS_FA[status] || status || 'پیش‌سفارش';
  const title = partnerName || detail?.partnerDisplayName || 'جزئیات پیش‌سفارش';
  const nextStep = adminDraftNextStep(status, detail?.stale);
  const converted = Boolean(detail?.convertedOrderId || listHint?.convertedOrderId);
  const orderId = detail?.convertedOrderId || listHint?.convertedOrderId;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sp-order-detail-title"
      dir="rtl"
    >
      <button type="button" className="absolute inset-0 bg-stone-900/40" aria-label="بستن" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-lg flex-col overflow-y-auto bg-[#faf8f5] shadow-2xl">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-stone-200 bg-[#faf8f5]/95 px-4 py-4 backdrop-blur">
          <div className="min-w-0">
            <p className="text-xs font-medium text-stone-500">پیش‌سفارش همکار بازاریاب</p>
            <h2 id="sp-order-detail-title" className="mt-1 truncate text-lg font-bold text-stone-900">
              {title}
            </h2>
            {status ? (
              <div className="mt-2">
                <SpBadge status={status} label={statusLabel} />
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

          <p className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm leading-6 text-stone-700" role="status">
            {nextStep}
          </p>

          {detail ? (
            <>
              <section className="rounded-2xl border border-stone-200 bg-white p-4 text-sm">
                <h3 className="font-semibold text-stone-900">همکار و مشتری</h3>
                <dl className="mt-3 space-y-2">
                  <div className="flex justify-between gap-3">
                    <dt className="text-stone-500">همکار</dt>
                    <dd className="font-medium text-stone-900">{detail.partnerDisplayName || partnerName || 'نامشخص'}</dd>
                  </div>
                  {detail.partnerStatus ? (
                    <div className="flex justify-between gap-3">
                      <dt className="text-stone-500">وضعیت همکار</dt>
                      <dd>{SP_PARTNER_STATUS_FA[detail.partnerStatus] || detail.partnerStatus}</dd>
                    </div>
                  ) : null}
                  {detail.partnerPhoneMasked ? (
                    <div className="flex justify-between gap-3">
                      <dt className="text-stone-500">موبایل همکار</dt>
                      <dd dir="ltr" className="tabular-nums">
                        {detail.partnerPhoneMasked}
                      </dd>
                    </div>
                  ) : null}
                  {detail.customerName ? (
                    <div className="flex justify-between gap-3">
                      <dt className="text-stone-500">نام مشتری</dt>
                      <dd className="font-medium">{detail.customerName}</dd>
                    </div>
                  ) : null}
                  <div className="flex justify-between gap-3">
                    <dt className="text-stone-500">موبایل مشتری</dt>
                    <dd dir="ltr" className="tabular-nums">
                      {detail.customerPhoneMasked || 'ثبت نشده'}
                    </dd>
                  </div>
                </dl>
              </section>

              <section className="rounded-2xl border border-stone-200 bg-white p-4 text-sm">
                <h3 className="font-semibold text-stone-900">مبالغ</h3>
                <dl className="mt-3 space-y-2">
                  <div className="flex justify-between gap-3">
                    <dt className="text-stone-500">کالا</dt>
                    <dd className="tabular-nums">{toman(detail.merchandiseIrr)} تومان</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-stone-500">ارسال برآوردی</dt>
                    <dd className="tabular-nums">{toman(detail.shippingFeeIrr)} تومان</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-stone-500">پورسانت تخمینی</dt>
                    <dd className="tabular-nums">{toman(detail.estimatedCommissionIrr || 0)} تومان</dd>
                  </div>
                </dl>
                <p className="mt-3 text-xs leading-5 text-stone-500">
                  پورسانت تخمینی با مبلغ قابل‌برداشت یکی نیست. پرداخت و ارسال با ترنم است.
                </p>
              </section>

              {detail.alerts?.length ? (
                <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950" role="status">
                  <h3 className="font-semibold">هشدار موجودی یا قیمت</h3>
                  <ul className="mt-2 list-disc space-y-1 pr-5">
                    {detail.alerts.map((alert) => (
                      <li key={alert}>{alert}</li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <section className="rounded-2xl border border-stone-200 bg-white p-4 text-sm">
                <h3 className="font-semibold text-stone-900">اقلام</h3>
                {detail.items.length === 0 ? (
                  <p className="mt-2 text-stone-500">قلم کالا ثبت نشده.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {detail.items.map((item) => (
                      <li key={item.id} className="rounded-xl border border-stone-100 bg-[#faf8f5] p-3">
                        <p className="font-medium text-stone-900">{item.name || 'کالا'}</p>
                        <p className="mt-1 text-xs text-stone-500">
                          {item.quantity.toLocaleString('fa-IR')} عدد · هر واحد {toman(item.unitPriceIrr)} تومان
                        </p>
                        <p className="mt-1 text-sm text-stone-700">
                          جمع خط {toman(item.lineTotalIrr)} تومان
                          {item.estimatedCommissionIrr
                            ? ` · پورسانت ${toman(item.estimatedCommissionIrr)}`
                            : ''}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="rounded-2xl border border-stone-200 bg-white p-4 text-sm">
                <h3 className="font-semibold text-stone-900">زمان‌بندی</h3>
                <dl className="mt-3 space-y-2">
                  {detail.createdAt ? (
                    <div className="flex justify-between gap-3">
                      <dt className="text-stone-500">ثبت</dt>
                      <dd>{formatSpDate(detail.createdAt)}</dd>
                    </div>
                  ) : null}
                  {detail.updatedAt ? (
                    <div className="flex justify-between gap-3">
                      <dt className="text-stone-500">آخرین تغییر</dt>
                      <dd>{formatSpDate(detail.updatedAt)}</dd>
                    </div>
                  ) : null}
                  {detail.lastSentAt ? (
                    <div className="flex justify-between gap-3">
                      <dt className="text-stone-500">آخرین پیامک تأیید</dt>
                      <dd>{formatSpDate(detail.lastSentAt)}</dd>
                    </div>
                  ) : null}
                  <div className="flex justify-between gap-3">
                    <dt className="text-stone-500">تعداد ارسال لینک</dt>
                    <dd className="tabular-nums">{(detail.sentCount || 0).toLocaleString('fa-IR')}</dd>
                  </div>
                  {detail.expiresAt ? (
                    <div className="flex justify-between gap-3">
                      <dt className="text-stone-500">انقضا</dt>
                      <dd>{formatSpDate(detail.expiresAt)}</dd>
                    </div>
                  ) : null}
                  {detail.orderStatus ? (
                    <div className="flex justify-between gap-3">
                      <dt className="text-stone-500">وضعیت فروشگاه</dt>
                      <dd>{detail.orderStatus}</dd>
                    </div>
                  ) : null}
                </dl>
              </section>
            </>
          ) : null}
        </div>

        <footer className="sticky bottom-0 mt-auto space-y-2 border-t border-stone-200 bg-[#faf8f5] px-4 py-4">
          {converted && orderId ? (
            <a
              href={`/admin/orders/${orderId}`}
              className={`inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-stone-200 bg-white px-3 text-sm ${spFocusClass}`}
            >
              سفارش فروشگاه
            </a>
          ) : (
            <p className="text-xs leading-6 text-stone-500">
              این رکورد هنوز سفارش فروشگاه نیست. تکمیل و ارسال لینک از پنل همکار انجام می‌شود.
            </p>
          )}
          {converted && onChangeAttribution ? (
            <SpButton variant="secondary" className="w-full" onClick={onChangeAttribution}>
              تغییر attribution
            </SpButton>
          ) : null}
        </footer>
      </aside>
    </div>
  );
}
