'use client';

import { Activity, ClipboardList, Users, Wallet } from 'lucide-react';
import { toman } from '@/lib/product-display';
import { SpBadge, SpBarRow, SpEmptyState, SpKpi, SpSection } from '@/components/sales-partners/SpUi';
import {
  formatSpDate,
  spAppStatusLabel,
  spAuditLabel,
  SP_DRAFT_STATUS_FA,
  SP_MODE_FA,
  SP_PARTNER_STATUS_FA,
  spPartnerStatusLabel,
} from '@/components/sales-partners/sp-labels';
import type { ApplicationRow, AuditRow, DraftRow, PartnerRow, Report, Settings } from './types';

export function SpAdminDashboard({
  settings,
  report,
  apps,
  partners,
  orders,
  audits,
  onGo,
}: {
  settings: Settings | null;
  report: Report | null;
  apps: ApplicationRow[];
  partners: PartnerRow[];
  orders: DraftRow[];
  audits: AuditRow[];
  onGo: (tab: string) => void;
}) {
  const pendingApps = apps.filter((row) => row.status === 'PENDING_REVIEW');
  const actionOrders = orders.filter(
    (row) => row.status === 'DRAFT' || row.status === 'AWAITING_CUSTOMER_CONFIRMATION' || !row.convertedOrderId,
  ).slice(0, 6);
  const draftMax = report
    ? Math.max(1, ...Object.values(report.drafts.byStatus || {}))
    : 1;
  const partnerMax = report
    ? Math.max(1, ...Object.values(report.partners.byStatus || {}))
    : 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-gradient-to-l from-[#F6F1E8] to-white p-4">
        <div className="min-w-0">
          <p className="text-xs font-medium text-[#1B5C4A]">ترنم · عملیات همکار بازاریاب</p>
          <h2 className="mt-1 text-lg font-semibold text-stone-900">داشبورد گزارش‌دهی</h2>
          <p className="mt-1 text-sm text-stone-600">
            شاخص‌ها از دادهٔ همین سامانه است؛ هدف فروش یا درآمد تضمینی نیست.
          </p>
        </div>
        {settings ? (
          <SpBadge status={settings.mode} label={SP_MODE_FA[settings.mode] || settings.mode} />
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SpKpi
          label="درخواست در انتظار"
          value={(report?.applications.pendingReview ?? pendingApps.length).toLocaleString('fa-IR')}
          hint="نیاز به تصمیم ادمین"
          accent
        />
        <SpKpi
          label="همکار فعال"
          value={(report?.partners.active ?? partners.filter((p) => p.status === 'ACTIVE').length).toLocaleString('fa-IR')}
          hint={`از ${(report?.partners.total ?? partners.length).toLocaleString('fa-IR')} همکار`}
        />
        <SpKpi
          label="نرخ تأیید مشتری"
          value={
            report?.drafts.customerConfirmRate == null
              ? '—'
              : `${Math.round(report.drafts.customerConfirmRate * 100).toLocaleString('fa-IR')}٪`
          }
          hint={
            report
              ? `نمونه ${report.drafts.sampleSize.toLocaleString('fa-IR')} پیش‌سفارش`
              : undefined
          }
        />
        <SpKpi
          label="قابل‌برداشت برنامه"
          value={report ? `${toman(report.commissions?.available ?? 0)}` : '—'}
          hint="تومان · از دفتر پورسانت"
        />
      </div>

      {report?.commissions ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <SpKpi label="در نگهداری" value={`${toman(report.commissions.held)} تومان`} />
          <SpKpi label="پرداخت‌شده" value={`${toman(report.commissions.paid)} تومان`} />
          <SpKpi label="برگشت‌خورده" value={`${toman(report.commissions.reversed)} تومان`} />
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <SpSection title="قیف پیش‌سفارش‌ها" description="توزیع وضعیت در نمونهٔ اخیر">
          <div className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4">
            {report && Object.keys(report.drafts.byStatus || {}).length > 0 ? (
              Object.entries(report.drafts.byStatus).map(([key, value]) => (
                <SpBarRow
                  key={key}
                  label={SP_DRAFT_STATUS_FA[key] || key}
                  value={value}
                  max={draftMax}
                />
              ))
            ) : (
              <SpEmptyState>هنوز پیش‌سفارشی برای قیف نیست.</SpEmptyState>
            )}
          </div>
        </SpSection>
        <SpSection title="وضعیت همکاران" description="توزیع پروفایل‌های ثبت‌شده">
          <div className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4">
            {report && Object.keys(report.partners.byStatus || {}).length > 0 ? (
              Object.entries(report.partners.byStatus).map(([key, value]) => (
                <SpBarRow
                  key={key}
                  label={SP_PARTNER_STATUS_FA[key] || key}
                  value={value}
                  max={partnerMax}
                />
              ))
            ) : (
              <SpEmptyState>همکاری ثبت نشده.</SpEmptyState>
            )}
          </div>
        </SpSection>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SpSection
          title="نیاز به اقدام"
          description="درخواست‌ها و سفارش‌های باز"
          action={
            <button type="button" className="text-sm text-[#1B5C4A] underline-offset-4 hover:underline" onClick={() => onGo('applications')}>
              همه درخواست‌ها
            </button>
          }
        >
          <ul className="space-y-2">
            {pendingApps.length === 0 && actionOrders.length === 0 ? (
              <li><SpEmptyState>صف اقدام خالی است.</SpEmptyState></li>
            ) : null}
            {pendingApps.slice(0, 4).map((row) => (
              <li key={row.id} className="flex items-start justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{row.displayName}</p>
                  <p className="mt-0.5 text-xs text-stone-500">{row.phoneMasked} · درخواست</p>
                </div>
                <SpBadge status={row.status} label={spAppStatusLabel(row.status)} />
              </li>
            ))}
            {actionOrders.slice(0, 4).map((row) => (
              <li key={row.id} className="flex items-start justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{row.statusLabel}</p>
                  <p className="mt-0.5 text-xs text-stone-500">
                    {toman(row.merchandiseIrr)} تومان
                    {row.customerPhoneMasked ? ` · ${row.customerPhoneMasked}` : ''}
                  </p>
                </div>
                <ClipboardList className="h-4 w-4 shrink-0 text-stone-400" aria-hidden />
              </li>
            ))}
          </ul>
        </SpSection>

        <SpSection
          title="سوابق اخیر"
          description="آخرین تصمیم‌های ثبت‌شده"
          action={
            <button type="button" className="text-sm text-[#1B5C4A] underline-offset-4 hover:underline" onClick={() => onGo('reports')}>
              گزارش کامل
            </button>
          }
        >
          <ul className="space-y-2">
            {audits.length === 0 ? (
              <li><SpEmptyState>سابقه‌ای ثبت نشده.</SpEmptyState></li>
            ) : (
              audits.slice(0, 8).map((row) => (
                <li key={row.id} className="rounded-2xl border border-stone-200 bg-white p-3 text-sm">
                  <div className="flex items-start gap-2">
                    <Activity className="mt-0.5 h-4 w-4 shrink-0 text-[#1B5C4A]" aria-hidden />
                    <div className="min-w-0">
                      <p className="font-medium">{spAuditLabel(row.action)}</p>
                      <p className="mt-0.5 text-xs text-stone-500">
                        {row.targetType} · {formatSpDate(row.createdAt)}
                      </p>
                    </div>
                  </div>
                </li>
              ))
            )}
          </ul>
        </SpSection>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <QuickLink icon={Users} label="مدیریت همکاران" onClick={() => onGo('partners')} />
        <QuickLink icon={Wallet} label="تسویه پورسانت" onClick={() => onGo('payouts')} />
        <QuickLink icon={ClipboardList} label="محصولات مجاز" onClick={() => onGo('catalog')} />
      </div>

      {report?.note ? (
        <p className="rounded-2xl bg-stone-50 p-3 text-sm leading-7 text-stone-600" role="note">
          {report.note}
          {report.generatedAt ? ` · به‌روز‌رسانی ${formatSpDate(report.generatedAt)}` : ''}
        </p>
      ) : null}
    </div>
  );
}

function QuickLink({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Users;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-dashed border-stone-300 bg-white px-3 text-sm text-stone-700 transition-colors hover:border-[#1B5C4A]/40 hover:bg-[#1B5C4A]/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C9A84C]"
    >
      <Icon className="h-4 w-4 text-[#1B5C4A]" aria-hidden />
      {label}
    </button>
  );
}

export function partnerBadgeLabel(row: PartnerRow): string {
  return spPartnerStatusLabel(row.status, row.statusLabel);
}
