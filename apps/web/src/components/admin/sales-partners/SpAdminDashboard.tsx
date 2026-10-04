'use client';

import { useEffect, useState } from 'react';
import { ClipboardList, ShoppingBag, Users, Wallet } from 'lucide-react';
import { toman } from '@/lib/product-display';
import { SpBadge, SpBarRow, SpButton, SpEmptyState, SpKpi, SpSection } from '@/components/sales-partners/SpUi';
import {
  formatSpDate,
  spAppStatusLabel,
  spAuditLabel,
  SP_DRAFT_STATUS_FA,
  SP_MODE_FA,
  SP_PARTNER_STATUS_FA,
  spPartnerStatusLabel,
} from '@/components/sales-partners/sp-labels';
import type { ApplicationRow, AuditRow, CommissionBucket, DraftRow, PartnerRow, Report, Settings, Tab } from './types';
import { actionableDrafts, auditTab, partnerNameById, partnerSlicesForBucket } from './sp-admin-ops';

const MONEY_BUCKETS: Record<CommissionBucket, { label: string; hint: string }> = {
  held: { label: 'در نگهداری', hint: 'پورسانتی که هنوز آزاد نشده، به تفکیک همکار' },
  paid: { label: 'ثبت واریز دستی', hint: 'واریزهایی که برای هر همکار ثبت شده' },
  reversed: { label: 'برگشت‌خورده', hint: 'پورسانت برگشت‌خورده هر همکار' },
  debt: { label: 'بدهی', hint: 'مانده منفی هر همکار. رقم کارت بعد از جمع کل دفتر است و می‌تواند از جمع نفرها کمتر باشد' },
  available: { label: 'قابل‌برداشت', hint: 'مانده آزاد هر همکار' },
};

export function SpAdminDashboard({
  settings,
  report,
  apps,
  partners,
  orders,
  audits,
  onGo,
  onOpenApplication,
}: {
  settings: Settings | null;
  report: Report | null;
  apps: ApplicationRow[];
  partners: PartnerRow[];
  orders: DraftRow[];
  audits: AuditRow[];
  onGo: (tab: Tab, extra?: { appFilter?: string; partnerFilter?: string; orderFilter?: string; focusPartnerId?: string }) => void;
  onOpenApplication: (id: string) => void;
}) {
  const pendingApps = apps.filter((row) => row.status === 'PENDING_REVIEW');
  const needInfoApps = apps.filter((row) => row.status === 'NEEDS_INFORMATION' || row.status === 'NEED_INFO');
  const queueOrders = actionableDrafts(orders, 8);
  const draftMax = report ? Math.max(1, ...Object.values(report.drafts.byStatus || {})) : 1;
  const partnerMax = report ? Math.max(1, ...Object.values(report.partners.byStatus || {})) : 1;
  const pendingCount = report?.applications.pendingReview ?? pendingApps.length;
  const inboxEmpty = pendingApps.length === 0 && needInfoApps.length === 0 && queueOrders.length === 0;
  const [moneyBucket, setMoneyBucket] = useState<CommissionBucket | null>(null);

  useEffect(() => {
    if (!moneyBucket) return;
    document.getElementById('sp-commission-breakdown')?.scrollIntoView({ block: 'nearest' });
  }, [moneyBucket]);

  function toggleMoney(bucket: CommissionBucket) {
    setMoneyBucket((current) => (current === bucket ? null : bucket));
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.8fr)]">
        <SpSection
          title="نیاز به اقدام"
          description="صف تصمیم ادمین — نه گزارش."
          action={
            <SpButton variant="ghost" className="min-h-9 px-2 text-sm" onClick={() => onGo('applications', { appFilter: 'PENDING_REVIEW' })}>
              همه درخواست‌ها
            </SpButton>
          }
        >
          <ul className="space-y-2">
            {inboxEmpty ? (
              <li>
                <SpEmptyState>صف خالی است. اگر ثبت‌نام باز است، درخواست جدید همین‌جا ظاهر می‌شود.</SpEmptyState>
              </li>
            ) : null}
            {pendingApps.slice(0, 6).map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{row.displayName}</p>
                  <p className="mt-0.5 text-xs text-stone-500">
                    {row.phoneMasked} · درخواست
                    {row.city ? ` · ${row.city}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <SpBadge status={row.status} label={spAppStatusLabel(row.status)} />
                  <SpButton className="min-h-10 px-3 text-xs" onClick={() => onOpenApplication(row.id)}>
                    بررسی
                  </SpButton>
                </div>
              </li>
            ))}
            {needInfoApps.slice(0, 3).map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{row.displayName}</p>
                  <p className="mt-0.5 text-xs text-stone-500">منتظر تکمیل اطلاعات</p>
                </div>
                <SpButton variant="secondary" className="min-h-10 px-3 text-xs" onClick={() => onOpenApplication(row.id)}>
                  مشاهده
                </SpButton>
              </li>
            ))}
            {queueOrders.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{row.statusLabel}</p>
                  <p className="mt-0.5 text-xs text-stone-500">
                    {toman(row.merchandiseIrr)} تومان
                    {row.customerPhoneMasked ? ` · ${row.customerPhoneMasked}` : ''}
                    {partnerNameById(partners, row.salesPartnerId) ? ` · ${partnerNameById(partners, row.salesPartnerId)}` : ''}
                  </p>
                </div>
                <SpButton variant="secondary" className="min-h-10 px-3 text-xs" onClick={() => onGo('orders', { orderFilter: row.status || 'ACTION' })}>
                  سفارش‌ها
                </SpButton>
              </li>
            ))}
          </ul>
        </SpSection>

        <div className="space-y-3">
          <SpKpi
            label="درخواست در انتظار"
            value={pendingCount.toLocaleString('fa-IR')}
            hint={needInfoApps.length ? `${needInfoApps.length.toLocaleString('fa-IR')} مورد تکمیل اطلاعات` : 'برای تصمیم ادمین'}
            accent={pendingCount > 0}
            onClick={() => onGo('applications', { appFilter: 'PENDING_REVIEW' })}
          />
          <SpKpi
            label="همکار فعال"
            value={(report?.partners.active ?? partners.filter((p) => p.status === 'ACTIVE').length).toLocaleString('fa-IR')}
            hint={`از ${(report?.partners.total ?? partners.length).toLocaleString('fa-IR')} پروفایل`}
            onClick={() => onGo('partners', { partnerFilter: 'ACTIVE' })}
          />
          <SpKpi
            label="نرخ تبدیل پیش‌سفارش"
            value={
              report?.drafts.customerConfirmRate == null
                ? '—'
                : `${Math.round(report.drafts.customerConfirmRate * 100).toLocaleString('fa-IR')}٪`
            }
            hint={report ? `نمونه ${report.drafts.sampleSize.toLocaleString('fa-IR')} · تبدیل‌شده به سفارش` : undefined}
            onClick={() => onGo('orders')}
          />
          <SpKpi
            label="قابل‌برداشت برنامه"
            value={report ? `${toman(report.commissions?.available ?? 0)}` : '—'}
            hint="تومان · کلیک برای ریز همکاران"
            pressed={moneyBucket === 'available'}
            onClick={() => toggleMoney('available')}
          />
        </div>
      </div>

      {report?.commissions ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SpKpi
            label="در نگهداری"
            value={`${toman(report.commissions.held)} تومان`}
            pressed={moneyBucket === 'held'}
            onClick={() => toggleMoney('held')}
          />
          <SpKpi
            label="ثبت واریز دستی"
            value={`${toman(report.commissions.paid)} تومان`}
            pressed={moneyBucket === 'paid'}
            onClick={() => toggleMoney('paid')}
          />
          <SpKpi
            label="برگشت‌خورده"
            value={`${toman(report.commissions.reversed)} تومان`}
            pressed={moneyBucket === 'reversed'}
            onClick={() => toggleMoney('reversed')}
          />
          <SpKpi
            label="بدهی"
            value={`${toman(report.commissions.debt ?? 0)} تومان`}
            pressed={moneyBucket === 'debt'}
            onClick={() => toggleMoney('debt')}
          />
        </div>
      ) : null}

      {moneyBucket && report?.commissions ? (
        <CommissionBreakdown
          bucket={moneyBucket}
          cardIrr={report.commissions[moneyBucket] ?? 0}
          rows={partnerSlicesForBucket(report.commissions.byPartner, moneyBucket)}
          splitReady={report.commissions.byPartner != null}
          partners={partners}
          onOpenPartner={(id) => onGo('payouts', { focusPartnerId: id })}
        />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <SpSection title="قیف پیش‌سفارش‌ها" description="کلیک روی هر وضعیت، همان فیلتر را در سفارش‌ها باز می‌کند">
          <div className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4">
            {report && Object.keys(report.drafts.byStatus || {}).length > 0 ? (
              Object.entries(report.drafts.byStatus).map(([key, value]) => (
                <SpBarRow
                  key={key}
                  label={SP_DRAFT_STATUS_FA[key] || key}
                  value={value}
                  max={draftMax}
                  onClick={() => onGo('orders', { orderFilter: key })}
                />
              ))
            ) : (
              <SpEmptyState>هنوز پیش‌سفارشی برای قیف نیست.</SpEmptyState>
            )}
          </div>
        </SpSection>
        <SpSection title="وضعیت همکاران" description="کلیک، فهرست همکاران را فیلتر می‌کند">
          <div className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4">
            {report && Object.keys(report.partners.byStatus || {}).length > 0 ? (
              Object.entries(report.partners.byStatus).map(([key, value]) => (
                <SpBarRow
                  key={key}
                  label={SP_PARTNER_STATUS_FA[key] || key}
                  value={value}
                  max={partnerMax}
                  onClick={() => onGo('partners', { partnerFilter: key })}
                />
              ))
            ) : (
              <SpEmptyState>همکاری ثبت نشده.</SpEmptyState>
            )}
          </div>
        </SpSection>
      </div>

      <SpSection
        title="سوابق اخیر"
        description="آخرین تصمیم‌های ثبت‌شده"
        action={
          <SpButton variant="ghost" className="min-h-9 px-2 text-sm" onClick={() => onGo('reports')}>
            گزارش کامل
          </SpButton>
        }
      >
        <ul className="space-y-2">
          {audits.length === 0 ? (
            <li>
              <SpEmptyState>سابقه‌ای ثبت نشده.</SpEmptyState>
            </li>
          ) : (
            audits.slice(0, 8).map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className="flex w-full items-start gap-2 rounded-2xl border border-stone-200 bg-white p-3 text-right text-sm hover:border-[#1B5C4A]/30"
                  onClick={() => onGo(auditTab(row.targetType))}
                >
                  <ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-[#1B5C4A]" aria-hidden />
                  <div className="min-w-0">
                    <p className="font-medium">{spAuditLabel(row.action)}</p>
                    <p className="mt-0.5 text-xs text-stone-500">
                      {row.targetType} · {formatSpDate(row.createdAt)}
                    </p>
                  </div>
                </button>
              </li>
            ))
          )}
        </ul>
      </SpSection>

      <div className="grid gap-2 sm:grid-cols-4">
        <QuickLink icon={Users} label="مدیریت همکاران" onClick={() => onGo('partners')} />
        <QuickLink icon={ShoppingBag} label="پیش‌سفارش‌ها" onClick={() => onGo('orders', { orderFilter: 'ACTION' })} />
        <QuickLink icon={Wallet} label="تسویه پورسانت" onClick={() => onGo('payouts')} />
        <QuickLink icon={ClipboardList} label="محصولات مجاز" onClick={() => onGo('catalog')} />
      </div>

      {report?.note ? (
        <p className="rounded-2xl bg-stone-50 p-3 text-sm leading-7 text-stone-600" role="note">
          {report.note}
          {report.generatedAt ? ` · به‌روز‌رسانی ${formatSpDate(report.generatedAt)}` : ''}
          {settings ? ` · برنامه ${SP_MODE_FA[settings.mode] || settings.mode}` : ''}
        </p>
      ) : null}
    </div>
  );
}

function CommissionBreakdown({
  bucket,
  cardIrr,
  rows,
  splitReady,
  partners,
  onOpenPartner,
}: {
  bucket: CommissionBucket;
  cardIrr: number;
  rows: Array<{ salesPartnerId: string; amountIrr: number }>;
  splitReady: boolean;
  partners: PartnerRow[];
  onOpenPartner: (id: string) => void;
}) {
  const meta = MONEY_BUCKETS[bucket];
  const sum = rows.reduce((total, row) => total + row.amountIrr, 0);
  return (
    <SpSection id="sp-commission-breakdown" title={`ریز ${meta.label}`} description={meta.hint}>
      {!splitReady ? (
        <SpEmptyState>ریز سهم همکاران در این گزارش نیست. یک‌بار صفحه را تازه کنید.</SpEmptyState>
      ) : rows.length === 0 ? (
        <SpEmptyState>این رقم برای هیچ همکاری ثبت نشده.</SpEmptyState>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => {
            const name = partnerNameById(partners, row.salesPartnerId);
            return (
              <li
                key={row.salesPartnerId}
                className="flex items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-3"
              >
                <span className="min-w-0 truncate font-medium">{name || 'همکار بدون نام'}</span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="font-semibold tabular-nums text-stone-900">{toman(row.amountIrr)} تومان</span>
                  <SpButton variant="ghost" className="min-h-9 px-2 text-xs" onClick={() => onOpenPartner(row.salesPartnerId)}>
                    تسویه
                  </SpButton>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-xs leading-6 text-stone-500">
        جمع ریز: {toman(sum)} تومان
        {sum === cardIrr ? ' · با رقم کارت یکی است' : ` · رقم کارت ${toman(cardIrr)} تومان`}
      </p>
    </SpSection>
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
    <SpButton variant="secondary" onClick={onClick} className="w-full">
      <Icon className="h-4 w-4 text-[#1B5C4A]" aria-hidden />
      {label}
    </SpButton>
  );
}

export function partnerBadgeLabel(row: PartnerRow): string {
  return spPartnerStatusLabel(row.status, row.statusLabel);
}
