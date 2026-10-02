'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ClipboardList,
  LayoutDashboard,
  Package,
  Percent,
  ScrollText,
  Search,
  Settings as SettingsIcon,
  ShoppingBag,
  Users,
  Wallet,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toman } from '@/lib/product-display';
import { SpBadge, SpEmptyState, SpRefreshButton, SpSection, spChipClass, spFocusClass } from '@/components/sales-partners/SpUi';
import {
  formatSpDate,
  spAppStatusLabel,
  spAuditLabel,
  SP_MODE_FA,
} from '@/components/sales-partners/sp-labels';
import { SpAdminDashboard, partnerBadgeLabel } from './SpAdminDashboard';
import { SpApplicationDetailDrawer } from './SpApplicationDetailDrawer';
import { SpApplyFormBuilder } from './SpApplyFormBuilder';
import type {
  ApplicationDetail,
  ApplicationRow,
  AuditRow,
  CatalogRow,
  DraftRow,
  PartnerRow,
  PayoutRow,
  Report,
  RuleRow,
  Settings,
  Tab,
} from './types';

export function AdminSalesPartners() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [apps, setApps] = useState<ApplicationRow[]>([]);
  const [partners, setPartners] = useState<PartnerRow[]>([]);
  const [catalog, setCatalog] = useState<CatalogRow[]>([]);
  const [catalogFacets, setCatalogFacets] = useState<{ id: string | null; name: string; count: number }[]>([]);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [catalogPage, setCatalogPage] = useState(1);
  const [categoryId, setCategoryId] = useState('');
  const [eligibleFilter, setEligibleFilter] = useState<'all' | 'yes' | 'no'>('all');
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [appFilter, setAppFilter] = useState('ALL');
  const [auditFilter, setAuditFilter] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [rulePercent, setRulePercent] = useState(10);
  const [ruleNote, setRuleNote] = useState('');
  const [commissionDrafts, setCommissionDrafts] = useState<Record<string, number>>({});
  const [payoutPartnerId, setPayoutPartnerId] = useState('');
  const [bankReference, setBankReference] = useState('');
  const [availableIrr, setAvailableIrr] = useState<number | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [orders, setOrders] = useState<DraftRow[]>([]);
  const [audits, setAudits] = useState<AuditRow[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ApplicationDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const loadCatalog = useCallback(async () => {
    const catalogParams = new URLSearchParams();
    if (appliedQuery) catalogParams.set('q', appliedQuery);
    if (categoryId) catalogParams.set('categoryId', categoryId);
    if (eligibleFilter !== 'all') catalogParams.set('eligible', eligibleFilter);
    if (catalogPage > 1) catalogParams.set('page', String(catalogPage));
    const catalogQs = catalogParams.toString();
    const nextCatalog = await apiClient.get<{
      items: CatalogRow[];
      total?: number;
      facets?: { categories: { id: string | null; name: string; count: number }[] };
    }>(`/admin/sales-partners/catalog${catalogQs ? `?${catalogQs}` : ''}`);
    setCatalog(nextCatalog.items);
    setCatalogFacets(nextCatalog.facets?.categories || []);
    setCatalogTotal(nextCatalog.total ?? nextCatalog.items.length);
    setCommissionDrafts((prev) => {
      const next = { ...prev };
      for (const row of nextCatalog.items) {
        if (next[row.productId] === undefined) {
          next[row.productId] =
            row.productCommissionPercent ?? row.previewCommissionPercent ?? 10;
        }
      }
      return next;
    });
  }, [appliedQuery, categoryId, eligibleFilter, catalogPage]);

  const loadDesk = useCallback(async () => {
    const auditQs = auditFilter ? `?targetType=${encodeURIComponent(auditFilter)}` : '';
    const [nextApps, nextPartners, nextRules, nextPayouts, nextSettings, nextOrders, nextAudits, nextReport] =
      await Promise.all([
        apiClient.get<ApplicationRow[]>('/admin/sales-partners/applications'),
        apiClient.get<PartnerRow[]>('/admin/sales-partners'),
        apiClient.get<RuleRow[]>('/admin/sales-partners/rules'),
        apiClient.get<PayoutRow[]>('/admin/sales-partners/payouts'),
        apiClient.get<Settings>('/admin/sales-partners/settings'),
        apiClient.get<DraftRow[]>('/admin/sales-partners/orders'),
        apiClient.get<AuditRow[]>(`/admin/sales-partners/audits${auditQs}`),
        apiClient.get<Report>('/admin/sales-partners/reports'),
      ]);
    setApps(nextApps);
    setPartners(nextPartners);
    setRules(nextRules);
    setPayouts(nextPayouts);
    setSettings(nextSettings);
    setOrders(nextOrders);
    setAudits(nextAudits);
    setReport(nextReport);
  }, [auditFilter]);

  const load = useCallback(async () => {
    setError(null);
    try {
      await Promise.all([loadDesk(), loadCatalog()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'بارگذاری ناموفق بود');
    } finally {
      setLoading(false);
    }
  }, [loadDesk, loadCatalog]);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    loadDesk()
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'بارگذاری ناموفق بود');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadDesk]);

  useEffect(() => {
    let cancelled = false;
    loadCatalog().catch((err: unknown) => {
      if (!cancelled) setError(err instanceof Error ? err.message : 'بارگذاری کاتالوگ ناموفق بود');
    });
    return () => {
      cancelled = true;
    };
  }, [loadCatalog]);

  const filteredApps = useMemo(() => {
    if (appFilter === 'ALL') return apps;
    if (appFilter === 'NEED_INFO') {
      return apps.filter((row) => row.status === 'NEEDS_INFORMATION' || row.status === 'NEED_INFO');
    }
    return apps.filter((row) => row.status === appFilter);
  }, [apps, appFilter]);

  async function openApplication(id: string) {
    setDetailId(id);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const next = await apiClient.get<ApplicationDetail>(`/admin/sales-partners/applications/${id}`);
      setDetail(next);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : 'بارگذاری جزئیات ناموفق بود');
    } finally {
      setDetailLoading(false);
    }
  }

  async function review(id: string, action: 'APPROVE' | 'NEED_INFO' | 'REJECT') {
    const reason = action === 'APPROVE' ? '' : window.prompt('دلیل را بنویسید') || '';
    if (action !== 'APPROVE' && reason.trim().length < 3) return;
    setBusyId(id);
    try {
      await apiClient.patch(`/admin/sales-partners/applications/${id}/review`, {
        action,
        reason: reason || undefined,
      });
      setDetailId(null);
      setDetail(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ثبت تصمیم ناموفق بود');
      setDetailError(err instanceof Error ? err.message : 'ثبت تصمیم ناموفق بود');
    } finally {
      setBusyId(null);
    }
  }

  async function sendWelcomeSms(row: ApplicationRow) {
    const ok = window.confirm(
      `پیامک خوش‌آمد با نام کاربری (موبایل) و رمز عبور جدید برای «${row.displayName}» (${row.phoneMasked}) ارسال شود؟\nرمز قبلی دیگر کار نمی‌کند.`,
    );
    if (!ok) return;
    setBusyId(row.id);
    setError(null);
    try {
      const res = await apiClient.post<{ sent?: boolean; message?: string }>(
        `/admin/sales-partners/applications/${row.id}/welcome-sms`,
        {},
      );
      window.alert(res?.message || (res?.sent ? 'پیامک ارسال شد' : 'انجام شد'));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ارسال پیامک خوش‌آمد ناموفق بود');
    } finally {
      setBusyId(null);
    }
  }

  function draftCommission(row: CatalogRow): number {
    const raw = commissionDrafts[row.productId];
    if (Number.isInteger(raw) && raw >= 0 && raw <= 80) return raw;
    return row.productCommissionPercent ?? row.previewCommissionPercent ?? 10;
  }

  async function patchEligibility(
    row: CatalogRow,
    eligible: boolean,
    opts?: { withCommission?: boolean },
  ) {
    const commissionPercentOverride = draftCommission(row);
    if (
      opts?.withCommission &&
      (!Number.isInteger(commissionPercentOverride) ||
        commissionPercentOverride < 0 ||
        commissionPercentOverride > 80)
    ) {
      setError('پورسانت محصول باید عدد صحیح بین ۰ تا ۸۰ باشد');
      return;
    }
    setBusyId(row.productId);
    setError(null);
    try {
      await apiClient.patch(`/admin/sales-partners/catalog/${row.productId}/eligibility`, {
        eligible,
        ...(opts?.withCommission
          ? { commissionPercentOverride, partnerPercent: commissionPercentOverride }
          : {}),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تغییر مجاز بودن محصول ناموفق بود');
    } finally {
      setBusyId(null);
    }
  }

  async function toggleEligible(row: CatalogRow) {
    const enabling = !row.eligible;
    await patchEligibility(row, enabling, { withCommission: enabling });
  }

  async function saveProductCommission(row: CatalogRow) {
    if (!row.eligible) {
      setError('اول محصول را برای بازاریاب مجاز کنید، بعد پورسانت را ذخیره کنید');
      return;
    }
    await patchEligibility(row, true, { withCommission: true });
  }

  async function loadBalance() {
    if (!payoutPartnerId) return;
    try {
      const next = await apiClient.get<{ available: number }>(
        `/admin/sales-partners/${payoutPartnerId}/balances`,
      );
      setAvailableIrr(next.available);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خواندن مانده ناموفق بود');
    }
  }

  async function confirmPayout() {
    if (!payoutPartnerId) return;
    setBusyId('payout');
    try {
      await apiClient.post('/admin/sales-partners/payouts', {
        salesPartnerId: payoutPartnerId,
        bankReference,
        idempotencyKey: `ui-${payoutPartnerId}-${Date.now()}`,
        method: 'TRANSFER',
      });
      setBankReference('');
      await load();
      await loadBalance();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ثبت تسویه ناموفق بود');
    } finally {
      setBusyId(null);
    }
  }

  async function changeAttribution(row: DraftRow) {
    const next = window.prompt('شناسه همکار مقصد', row.attribution?.salesPartnerId || row.salesPartnerId || '') || '';
    const reason = window.prompt('دلیل تغییر attribution (حداقل ۸ حرف)') || '';
    if (!next.trim() || reason.trim().length < 8) return;
    setBusyId(row.id);
    try {
      await apiClient.patch(`/admin/sales-partners/orders/${row.id}/attribution`, {
        salesPartnerId: next.trim(),
        reason: reason.trim(),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تغییر attribution ناموفق بود');
    } finally {
      setBusyId(null);
    }
  }

  async function setPartnerStatus(id: string, status: 'ACTIVE' | 'SUSPENDED' | 'CLOSED') {
    const reason = status === 'ACTIVE' ? '' : window.prompt('دلیل را بنویسید') || '';
    if (status !== 'ACTIVE' && reason.trim().length < 3) return;
    setBusyId(id);
    try {
      await apiClient.patch(`/admin/sales-partners/${id}/status`, { status, reason: reason || undefined });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تغییر وضعیت ناموفق بود');
    } finally {
      setBusyId(null);
    }
  }

  async function saveSettings() {
    if (!settings) return;
    setBusyId('settings');
    try {
      await apiClient.patch('/admin/sales-partners/settings', {
        enabled: settings.enabled,
        mode: settings.mode,
        applyOpen: settings.applyOpen,
        commissionHoldDays: settings.commissionHoldDays || undefined,
        minPayoutIrr: settings.minPayoutIrr,
        dailyDraftCap: settings.dailyDraftCap,
        termsVersion: settings.termsVersion,
        applyFormFields: settings.applyFormFields || [],
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ذخیره تنظیمات ناموفق بود');
    } finally {
      setBusyId(null);
    }
  }

  async function createProgramRule() {
    setBusyId('rule');
    try {
      await apiClient.post('/admin/sales-partners/rules', {
        scope: 'PROGRAM',
        percent: rulePercent,
        note: ruleNote || undefined,
      });
      setRuleNote('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ثبت قانون ناموفق بود');
    } finally {
      setBusyId(null);
    }
  }

  const tabs: { id: Tab; label: string; icon: typeof Package }[] = [
    { id: 'dashboard', label: 'داشبورد', icon: LayoutDashboard },
    { id: 'applications', label: 'درخواست‌ها', icon: ClipboardList },
    { id: 'partners', label: 'همکاران', icon: Users },
    { id: 'orders', label: 'سفارش‌ها', icon: ShoppingBag },
    { id: 'catalog', label: 'محصولات مجاز', icon: Package },
    { id: 'rules', label: 'قوانین پورسانت', icon: Percent },
    { id: 'payouts', label: 'تسویه', icon: Wallet },
    { id: 'settings', label: 'تنظیمات', icon: SettingsIcon },
    { id: 'reports', label: 'گزارش و سوابق', icon: ScrollText },
  ];

  const pendingCount = apps.filter((row) => row.status === 'PENDING_REVIEW').length;
  const catalogGroups = useMemo(() => {
    const map = new Map<string, CatalogRow[]>();
    for (const row of catalog) {
      const name = row.categoryName || 'بدون دسته';
      const list = map.get(name) || [];
      list.push(row);
      map.set(name, list);
    }
    return [...map.entries()];
  }, [catalog]);
  const catalogPages = Math.max(1, Math.ceil(catalogTotal / 20));

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-3xl border border-stone-200 bg-white p-4">
        <div className="min-w-0 max-w-2xl">
          <p className="text-xs font-medium text-[#1B5C4A]">میز کار همکار بازاریاب</p>
          <p className="mt-1 text-sm leading-7 text-stone-600">
            این بخش برای همکار بازاریاب است، نه تأمین‌کننده ارسال. برنامه تا روشن‌شدن فلگ روی سفارش‌های فعلی اثر ندارد.
          </p>
          {settings ? (
            <p className="mt-2 text-xs text-stone-500">
              وضعیت برنامه: {SP_MODE_FA[settings.mode] || settings.mode}
              {settings.enabled ? ' · عملیات فعال' : ' · عملیات خاموش'}
              {pendingCount > 0 ? ` · ${pendingCount.toLocaleString('fa-IR')} درخواست باز` : ''}
            </p>
          ) : null}
        </div>
        <SpRefreshButton onClick={() => void load()} busy={loading && !!report} />
      </div>

      {error && (
        <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <div className="flex gap-2 overflow-x-auto pb-1 lg:sticky lg:top-4 lg:flex-col lg:overflow-visible" role="tablist" aria-label="بخش‌های همکار بازاریاب">
          {tabs.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3 text-sm ${spFocusClass} ${
                  active ? 'bg-[#1B5C4A] text-white' : 'border border-stone-200 bg-white text-stone-700'
                }`}
                onClick={() => setTab(item.id)}
              >
                <Icon className="h-4 w-4" aria-hidden />
                <span className="truncate">{item.label}</span>
                {item.id === 'applications' && pendingCount > 0 ? (
                  <span className="mr-auto inline-flex min-w-[1.25rem] justify-center rounded-full bg-[#C9A84C] px-1.5 text-[10px] font-bold text-[#0F2F28]">
                    {pendingCount.toLocaleString('fa-IR')}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        <div className="min-w-0 space-y-6">

      {loading && !report ? (
        <p className="text-sm text-stone-600" role="status">
          در حال بارگذاری…
        </p>
      ) : null}

      {tab === 'dashboard' && (
        <SpAdminDashboard
          settings={settings}
          report={report}
          apps={apps}
          partners={partners}
          orders={orders}
          audits={audits}
          onGo={(id) => setTab(id as Tab)}
        />
      )}

      {tab === 'applications' && (
        <SpSection
          title="درخواست‌های همکاری"
          description="اول جزئیات کامل را ببینید، بعد تأیید، تکمیل اطلاعات یا رد کنید."
        >
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'ALL', label: 'همه' },
              { id: 'PENDING_REVIEW', label: 'در انتظار' },
              { id: 'NEED_INFO', label: 'تکمیل اطلاعات' },
              { id: 'APPROVED', label: 'تأییدشده' },
              { id: 'REJECTED', label: 'ردشده' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                className={`min-h-10 rounded-full px-3 text-sm ${spFocusClass} ${
                  appFilter === f.id ? 'bg-[#1B5C4A] text-white' : 'border border-stone-200 bg-white'
                }`}
                onClick={() => setAppFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <ul className="space-y-3">
            {filteredApps.length === 0 && <li><SpEmptyState>درخواستی با این فیلتر نیست.</SpEmptyState></li>}
            {filteredApps.map((row) => (
              <li key={row.id} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-stone-900">{row.displayName}</p>
                    <p className="mt-1 text-sm text-stone-600">
                      {row.phoneMasked}
                      {row.createdAt ? ` · ${formatSpDate(row.createdAt)}` : ''}
                    </p>
                    <p className="mt-1 text-xs text-stone-500">
                      {[row.province, row.city].filter(Boolean).join(' / ') || 'شهر ثبت نشده'}
                      {row.primaryChannel ? ` · کانال: ${row.primaryChannel}` : ''}
                      {row.nationalIdMasked ? ` · کدملی: ${row.nationalIdMasked}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-stretch gap-2">
                    <SpBadge status={row.status} label={spAppStatusLabel(row.status)} />
                    {row.status === 'APPROVED' && (
                      <button
                        type="button"
                        className={`min-h-10 rounded-xl border border-[#1B5C4A]/30 bg-[#E8F2EE] px-3 text-xs font-medium text-[#1B5C4A] disabled:opacity-60 ${spFocusClass}`}
                        disabled={busyId === row.id}
                        onClick={() => void sendWelcomeSms(row)}
                      >
                        {busyId === row.id ? 'در حال ارسال…' : 'ارسال پیامک خوش‌آمد'}
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={`min-h-11 rounded-xl bg-[#1B5C4A] px-3 text-white ${spFocusClass}`}
                    onClick={() => void openApplication(row.id)}
                  >
                    مشاهده جزئیات
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <SpApplicationDetailDrawer
            open={Boolean(detailId)}
            loading={detailLoading}
            detail={detail}
            listHint={apps.find((a) => a.id === detailId) || null}
            busy={busyId === detailId}
            error={detailError}
            onClose={() => {
              setDetailId(null);
              setDetail(null);
              setDetailError(null);
            }}
            onReview={(action) => {
              if (detailId) void review(detailId, action);
            }}
          />
        </SpSection>
      )}

      {tab === 'partners' && (
        <SpSection title="همکاران بازاریاب" description="فعال‌سازی، تعلیق و مشاهده هشدار ریسک.">
          <ul className="space-y-3">
            {partners.length === 0 && <li><SpEmptyState>همکار بازاریابی ثبت نشده.</SpEmptyState></li>}
            {partners.map((row) => (
              <li key={row.id} className="rounded-2xl border border-stone-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{row.displayName}</p>
                    <p className="mt-1 text-sm text-stone-600">{row.phoneMasked}</p>
                    <p className="mt-1 font-mono text-[11px] text-stone-400">{row.id}</p>
                  </div>
                  <SpBadge status={row.status} label={partnerBadgeLabel(row)} />
                </div>
                {row.statusReason && <p className="mt-2 text-sm text-amber-800">{row.statusReason}</p>}
                {row.riskFlags && row.riskFlags.length > 0 && (
                  <p className="mt-2 text-sm text-amber-900" role="status">
                    هشدار: {row.riskFlags.join('، ')}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {row.status === 'ACTIVE' && (
                    <button
                      type="button"
                      className={`min-h-11 rounded-xl border px-3 ${spFocusClass}`}
                      disabled={busyId === row.id}
                      onClick={() => void setPartnerStatus(row.id, 'SUSPENDED')}
                    >
                      تعلیق
                    </button>
                  )}
                  {row.status === 'SUSPENDED' && (
                    <button
                      type="button"
                      className={`min-h-11 rounded-xl bg-emerald-700 px-3 text-white ${spFocusClass}`}
                      disabled={busyId === row.id}
                      onClick={() => void setPartnerStatus(row.id, 'ACTIVE')}
                    >
                      فعال‌سازی
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </SpSection>
      )}

      {tab === 'orders' && (
        <SpSection title="سفارش‌های همکاری" description="پیش‌سفارش‌ها و attribution پس از تبدیل.">
          <ul className="space-y-3">
            {orders.length === 0 && <li><SpEmptyState>سفارش همکاری ثبت نشده.</SpEmptyState></li>}
            {orders.map((row) => (
              <li key={row.id} className="rounded-2xl border border-stone-200 bg-white p-4 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-medium">{row.statusLabel}</p>
                  {row.status ? <SpBadge status={row.status} label={row.statusLabel} /> : null}
                </div>
                <p className="mt-2 text-stone-600">
                  {toman(row.merchandiseIrr)} تومان
                  {row.customerPhoneMasked ? ` · ${row.customerPhoneMasked}` : ''}
                </p>
                {row.convertedOrderId && (
                  <div className="mt-3 space-y-2">
                    <p className="text-stone-500">
                      سفارش فروشگاه ساخته شده است
                      {row.attribution?.salesSource ? ` · منبع ${row.attribution.salesSource}` : ''}
                    </p>
                    <button
                      type="button"
                      className={`min-h-11 rounded-xl border px-3 ${spFocusClass}`}
                      disabled={busyId === row.id}
                      onClick={() => void changeAttribution(row)}
                    >
                      تغییر attribution با دلیل
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </SpSection>
      )}

      {tab === 'catalog' && (
        <SpSection
          title="محصولات مجاز برای بازاریاب"
          description="تا وقتی محصولی را مجاز نکنید، کاتالوگ همکار خالی می‌ماند و لینک فروش همان کالا پورسانت نمی‌سازد."
        >
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setCatalogPage(1);
              setAppliedQuery(query.trim());
            }}
          >
            <label className="sr-only" htmlFor="sp-catalog-q">
              جستجوی محصول
            </label>
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" aria-hidden />
              <input
                id="sp-catalog-q"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className={`min-h-11 w-full rounded-xl border border-stone-200 bg-white py-2 pr-10 pl-3 ${spFocusClass}`}
                placeholder="نام محصول"
              />
            </div>
            <button type="submit" className={`min-h-11 rounded-xl border px-4 ${spFocusClass}`}>
              جستجو
            </button>
          </form>
          <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="دسته محصولات">
            <button
              type="button"
              className={spChipClass(categoryId === '')}
              aria-pressed={categoryId === ''}
              onClick={() => {
                setCatalogPage(1);
                setCategoryId('');
              }}
            >
              همه دسته‌ها
            </button>
            {catalogFacets.filter((facet) => facet.id).map((facet) => (
              <button
                key={facet.id}
                type="button"
                className={spChipClass(categoryId === facet.id)}
                aria-pressed={categoryId === facet.id}
                onClick={() => {
                  setCatalogPage(1);
                  setCategoryId(facet.id || '');
                }}
              >
                {facet.name}
                <span className="tabular-nums opacity-80">{facet.count.toLocaleString('fa-IR')}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="وضعیت مجوز">
            {([
              ['all', 'همه'],
              ['yes', 'مجاز'],
              ['no', 'غیرمجاز'],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={spChipClass(eligibleFilter === id)}
                aria-pressed={eligibleFilter === id}
                onClick={() => {
                  setCatalogPage(1);
                  setEligibleFilter(id);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-sm text-stone-500" role="status">
            {catalogTotal.toLocaleString('fa-IR')} محصول در این فیلتر
          </p>
          {catalog.length === 0 && <SpEmptyState>محصولی پیدا نشد.</SpEmptyState>}
          <div className="space-y-6">
            {catalogGroups.map(([name, rows]) => (
              <section key={name} aria-labelledby={`admin-cat-${rows[0]?.categoryId || 'none'}`}>
                <h3 id={`admin-cat-${rows[0]?.categoryId || 'none'}`} className="mb-3 text-sm font-semibold text-[#1B5C4A]">
                  {name}
                </h3>
                <ul className="grid gap-3 lg:grid-cols-2">
                  {rows.map((row) => (
                    <li key={row.productId} className="rounded-2xl border border-stone-200 bg-white p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="font-medium">{row.name}</p>
                        <SpBadge
                          status={row.eligible ? 'ACTIVE' : 'OFF'}
                          label={row.eligible ? 'مجاز' : 'غیرمجاز'}
                        />
                      </div>
                      <p className="mt-1 text-sm text-stone-600">
                        {toman(row.priceIrr)} تومان
                        {row.vendorSku ? ' · کالای تأمین‌کننده' : ''}
                        {row.productCommissionPercent != null
                          ? ` · پورسانت محصول ${row.productCommissionPercent}٪`
                          : ` · پورسانت مؤثر ${row.previewCommissionPercent}٪`}
                      </p>
                      <label className="mt-2 flex flex-wrap items-center gap-2 text-sm text-stone-700">
                        <span>پورسانت این محصول (%)</span>
                        <input
                          type="number"
                          min={0}
                          max={80}
                          step={1}
                          inputMode="numeric"
                          dir="ltr"
                          className={`w-20 min-h-10 rounded-xl border border-stone-300 px-2 ${spFocusClass}`}
                          value={draftCommission(row)}
                          onChange={(e) => {
                            const n = Number(e.target.value);
                            setCommissionDrafts((prev) => ({
                              ...prev,
                              [row.productId]: Number.isFinite(n) ? Math.max(0, Math.min(80, Math.trunc(n))) : 0,
                            }));
                          }}
                          aria-label={`پورسانت ${row.name}`}
                        />
                      </label>
                      {row.vendorSku && (
                        <p className="mt-1 text-sm text-amber-800">
                          {row.canEnable
                            ? `حاشیه پس از پورسانت بازاریاب کافی است (${toman(row.marginIrr)} تومان).`
                            : 'حاشیه کافی نیست؛ درصد را کمتر کنید یا این کالا را مجاز نکنید.'}
                        </p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className={`min-h-11 rounded-xl border px-3 ${spFocusClass}`}
                          disabled={busyId === row.productId}
                          onClick={() => void toggleEligible(row)}
                        >
                          {row.eligible ? 'غیرفعال کردن برای بازاریاب' : 'مجاز کردن برای بازاریاب'}
                        </button>
                        {row.eligible ? (
                          <button
                            type="button"
                            className={`min-h-11 rounded-xl border border-[#1B5C4A]/40 px-3 text-[#1B5C4A] ${spFocusClass}`}
                            disabled={busyId === row.productId}
                            onClick={() => void saveProductCommission(row)}
                          >
                            ذخیره پورسانت محصول
                          </button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          {catalogTotal > 20 && (
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                className={spChipClass(false)}
                disabled={catalogPage <= 1}
                onClick={() => setCatalogPage((current) => Math.max(1, current - 1))}
              >
                قبلی
              </button>
              <p className="text-sm tabular-nums text-stone-600">
                {catalogPage.toLocaleString('fa-IR')} از {catalogPages.toLocaleString('fa-IR')}
              </p>
              <button
                type="button"
                className={spChipClass(false)}
                disabled={catalogPage >= catalogPages}
                onClick={() => setCatalogPage((current) => current + 1)}
              >
                بعدی
              </button>
            </div>
          )}
        </SpSection>
      )}

      {tab === 'rules' && (
        <SpSection title="قوانین پورسانت" description="نرخ برنامه مبنای تخمین و محاسبه است.">
          <form
            className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4"
            onSubmit={(e) => {
              e.preventDefault();
              void createProgramRule();
            }}
          >
            <p className="font-medium">نرخ پیش‌فرض برنامه</p>
            <label className="block text-sm" htmlFor="sp-rule-percent">
              درصد
            </label>
            <input
              id="sp-rule-percent"
              type="number"
              min={0}
              max={80}
              value={rulePercent}
              onChange={(e) => setRulePercent(Number(e.target.value))}
              className={`min-h-11 w-32 rounded-xl border px-3 ${spFocusClass}`}
            />
            <label className="block text-sm" htmlFor="sp-rule-note">
              توضیح داخلی
            </label>
            <input
              id="sp-rule-note"
              value={ruleNote}
              onChange={(e) => setRuleNote(e.target.value)}
              className={`min-h-11 w-full rounded-xl border px-3 ${spFocusClass}`}
            />
            <button
              type="submit"
              className={`min-h-11 rounded-xl bg-[#1B5C4A] px-4 text-white ${spFocusClass}`}
              disabled={busyId === 'rule'}
            >
              ثبت نرخ برنامه
            </button>
          </form>
          <ul className="space-y-3">
            {rules.length === 0 && (
              <li>
                <SpEmptyState>قانونی ثبت نشده؛ تا آن زمان پورسانت تخمینی صفر است.</SpEmptyState>
              </li>
            )}
            {rules.map((row) => (
              <li key={row.id} className="rounded-2xl border border-stone-200 bg-white p-4 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">
                    {row.scope} · {row.percent}٪
                  </p>
                  <SpBadge status={row.active ? 'ACTIVE' : 'OFF'} label={row.active ? 'فعال' : 'غیرفعال'} />
                </div>
                {row.note && <p className="mt-1 text-stone-600">{row.note}</p>}
              </li>
            ))}
          </ul>
        </SpSection>
      )}

      {tab === 'payouts' && (
        <SpSection title="تسویه پورسانت" description="فقط مانده قابل‌برداشت با مرجع بانکی ثبت می‌شود.">
          <form
            className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4"
            onSubmit={(e) => {
              e.preventDefault();
              void confirmPayout();
            }}
          >
            <label className="block text-sm" htmlFor="sp-pay-partner">
              همکار بازاریاب
            </label>
            <select
              id="sp-pay-partner"
              className={`min-h-11 w-full rounded-xl border px-3 ${spFocusClass}`}
              value={payoutPartnerId}
              onChange={(e) => {
                setPayoutPartnerId(e.target.value);
                setAvailableIrr(null);
              }}
            >
              <option value="">انتخاب کنید</option>
              {partners.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.displayName}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={`min-h-11 rounded-xl border px-4 ${spFocusClass}`}
              disabled={!payoutPartnerId}
              onClick={() => void loadBalance()}
            >
              مشاهده مانده
            </button>
            {availableIrr !== null && (
              <p className="text-sm">قابل‌برداشت: {toman(availableIrr)} تومان</p>
            )}
            <label className="block text-sm" htmlFor="sp-pay-ref">
              شماره مرجع واریز
            </label>
            <input
              id="sp-pay-ref"
              className={`min-h-11 w-full rounded-xl border px-3 ${spFocusClass}`}
              value={bankReference}
              onChange={(e) => setBankReference(e.target.value)}
              required
            />
            <button
              type="submit"
              className={`min-h-11 rounded-xl bg-[#1B5C4A] px-4 text-white ${spFocusClass}`}
              disabled={busyId === 'payout'}
            >
              ثبت تسویه
            </button>
          </form>
          {report?.payouts ? (
            <p className="text-sm text-stone-600">
              مجموع تسویه‌های PAID در نمونه: {toman(report.payouts.paidIrr)} تومان ·{' '}
              {report.payouts.count.toLocaleString('fa-IR')} رکورد
            </p>
          ) : null}
          <ul className="space-y-3">
            {payouts.length === 0 && <li><SpEmptyState>تسویه‌ای ثبت نشده.</SpEmptyState></li>}
            {payouts.map((row) => (
              <li key={row.id} className="rounded-2xl border border-stone-200 bg-white p-4 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium tabular-nums">{toman(row.amountIrr)} تومان</span>
                  <SpBadge status={row.status} label={row.status} />
                </div>
                <p className="mt-1 text-stone-600">
                  {row.bankReferenceMasked}
                  {row.paidAt ? ` · ${formatSpDate(row.paidAt)}` : ''}
                </p>
              </li>
            ))}
          </ul>
        </SpSection>
      )}

      {tab === 'settings' && settings && (
        <SpSection title="تنظیمات برنامه" description="فلگ عملیات، ثبت‌نام و نگهداری پورسانت.">
          <form
            className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4"
            onSubmit={(e) => {
              e.preventDefault();
              void saveSettings();
            }}
          >
            <label className="block text-sm" htmlFor="sp-mode">
              وضعیت برنامه
            </label>
            <select
              id="sp-mode"
              className={`min-h-11 w-full rounded-xl border px-3 ${spFocusClass}`}
              value={settings.mode}
              onChange={(e) => setSettings({ ...settings, mode: e.target.value as Settings['mode'] })}
            >
              <option value="OFF">خاموش</option>
              <option value="PREVIEW">پیش‌نمایش ثبت‌نام</option>
              <option value="CANARY">آزمایشی</option>
              <option value="LIVE">زنده</option>
            </select>
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
              />
              فعال بودن عملیات همکار (CANARY/LIVE)
            </label>
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.applyOpen}
                onChange={(e) => setSettings({ ...settings, applyOpen: e.target.checked })}
              />
              باز بودن ثبت‌نام
            </label>
            <label className="block text-sm" htmlFor="sp-hold">
              مهلت نگهداری پورسانت (روز)
            </label>
            <input
              id="sp-hold"
              type="number"
              min={1}
              max={180}
              className={`min-h-11 w-32 rounded-xl border px-3 ${spFocusClass}`}
              value={settings.commissionHoldDays ?? ''}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  commissionHoldDays: e.target.value ? Number(e.target.value) : null,
                })
              }
            />
            <label className="block text-sm" htmlFor="sp-min">
              حداقل تسویه (ریال)
            </label>
            <input
              id="sp-min"
              type="number"
              min={0}
              className={`min-h-11 w-48 rounded-xl border px-3 ${spFocusClass}`}
              value={settings.minPayoutIrr}
              onChange={(e) => setSettings({ ...settings, minPayoutIrr: Number(e.target.value) })}
            />
            <p className="text-sm text-stone-600">
              نسخه شرایط: {settings.termsVersion}. متن عمومی در{' '}
              <a
                href="/sales-partnership/terms"
                className={`text-[#1B5C4A] underline-offset-4 hover:underline ${spFocusClass}`}
              >
                /sales-partnership/terms
              </a>{' '}
              است.
            </p>
            <div className="border-t border-stone-100 pt-4">
              <SpApplyFormBuilder
                fields={settings.applyFormFields || []}
                onChange={(applyFormFields) => setSettings({ ...settings, applyFormFields })}
              />
            </div>
            <button
              type="submit"
              className={`min-h-11 rounded-xl bg-[#1B5C4A] px-4 text-white ${spFocusClass}`}
              disabled={busyId === 'settings'}
            >
              ذخیره تنظیمات
            </button>
          </form>
        </SpSection>
      )}

      {tab === 'reports' && (
        <div className="space-y-6">
          <SpSection title="خلاصه برنامه" description="شاخص‌های قابل گزارش از دادهٔ فعلی.">
            {report ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border bg-white p-4 text-sm">
                  <p className="text-stone-500">درخواست‌ها</p>
                  <p className="mt-1 text-xl font-semibold tabular-nums">
                    {report.applications.total.toLocaleString('fa-IR')}
                  </p>
                </div>
                <div className="rounded-2xl border bg-white p-4 text-sm">
                  <p className="text-stone-500">همکاران</p>
                  <p className="mt-1 text-xl font-semibold tabular-nums">
                    {report.partners.total.toLocaleString('fa-IR')}
                  </p>
                </div>
                <div className="rounded-2xl border bg-white p-4 text-sm">
                  <p className="text-stone-500">تبدیل پیش‌سفارش</p>
                  <p className="mt-1 text-xl font-semibold tabular-nums">
                    {report.drafts.converted.toLocaleString('fa-IR')}
                    <span className="text-sm font-normal text-stone-500">
                      {' '}
                      / {report.drafts.sampleSize.toLocaleString('fa-IR')}
                    </span>
                  </p>
                </div>
                <div className="rounded-2xl border bg-white p-4 text-sm">
                  <p className="text-stone-500">نرخ تأیید مشتری</p>
                  <p className="mt-1 text-xl font-semibold tabular-nums">
                    {report.drafts.customerConfirmRate == null
                      ? '—'
                      : `${Math.round(report.drafts.customerConfirmRate * 100).toLocaleString('fa-IR')}٪`}
                  </p>
                </div>
              </div>
            ) : (
              <SpEmptyState>گزارش هنوز بارگذاری نشده.</SpEmptyState>
            )}
            {report?.note ? (
              <p className="rounded-2xl bg-stone-50 p-3 text-sm leading-7 text-stone-600">{report.note}</p>
            ) : null}
          </SpSection>

          <SpSection title="سوابق تصمیم" description="فیلتر بر اساس نوع هدف.">
            <div className="flex flex-wrap gap-2">
              {[
                { id: '', label: 'همه' },
                { id: 'application', label: 'درخواست' },
                { id: 'profile', label: 'پروفایل' },
                { id: 'order', label: 'سفارش' },
                { id: 'payout', label: 'تسویه' },
                { id: 'settings', label: 'تنظیمات' },
              ].map((f) => (
                <button
                  key={f.id || 'all'}
                  type="button"
                  className={`min-h-10 rounded-full px-3 text-sm ${spFocusClass} ${
                    auditFilter === f.id ? 'bg-[#1B5C4A] text-white' : 'border bg-white'
                  }`}
                  onClick={() => setAuditFilter(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <ul className="space-y-2">
              {audits.length === 0 && <li><SpEmptyState>سابقه‌ای نیست.</SpEmptyState></li>}
              {audits.map((row) => (
                <li key={row.id} className="rounded-2xl border border-stone-200 bg-white p-3 text-sm">
                  <p className="font-medium">{spAuditLabel(row.action)}</p>
                  <p className="mt-1 text-stone-500">
                    {row.targetType} · {row.targetId.slice(0, 8)}… · {formatSpDate(row.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          </SpSection>
        </div>
      )}
        </div>
      </div>
    </div>
  );
}
