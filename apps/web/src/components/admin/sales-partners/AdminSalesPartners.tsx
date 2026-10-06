'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ClipboardList,
  LayoutDashboard,
  Megaphone,
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
import { SpBadge, SpButton, SpEmptyState, SpRefreshButton, SpSection, spChipClass, spFocusClass } from '@/components/sales-partners/SpUi';
import {
  formatSpDate,
  spAppStatusLabel,
  spAuditLabel,
  SP_DRAFT_STATUS_FA,
  SP_MODE_FA,
  SP_PARTNER_STATUS_FA,
} from '@/components/sales-partners/sp-labels';
import { SpAdminDashboard, partnerBadgeLabel } from './SpAdminDashboard';
import { SpApplicationDetailDrawer } from './SpApplicationDetailDrawer';
import { SpApplyFormBuilder } from './SpApplyFormBuilder';
import { SpReasonDialog } from './SpReasonDialog';
import {
  activeProgramRule,
  isActionableDraft,
  matchesApplicationSearch,
  matchesPartnerSearch,
  partnerNameById,
  payoutIdempotencyKey,
} from './sp-admin-ops';
import { SpCommissionRules } from './SpCommissionRules';
import { SpNoticeDesk } from './SpNoticeDesk';
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
  const [rulePercentTouched, setRulePercentTouched] = useState(false);
  const [ruleNote, setRuleNote] = useState('');
  const [propagateRules, setPropagateRules] = useState(true);
  const [ruleMessage, setRuleMessage] = useState<string | null>(null);
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
  const [appQuery, setAppQuery] = useState('');
  const [partnerQuery, setPartnerQuery] = useState('');
  const [partnerFilter, setPartnerFilter] = useState('ALL');
  const [orderFilter, setOrderFilter] = useState('ALL');
  const [orderPartnerId, setOrderPartnerId] = useState('');
  const [dialogReason, setDialogReason] = useState('');
  const [attrPartnerId, setAttrPartnerId] = useState('');
  const [payoutConfirmOpen, setPayoutConfirmOpen] = useState(false);
  const [statusDialog, setStatusDialog] = useState<{
    id: string;
    status: 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
    name: string;
  } | null>(null);
  const [attrDialog, setAttrDialog] = useState<DraftRow | null>(null);

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
    let rows = apps.filter((row) => matchesApplicationSearch(row, appQuery));
    if (appFilter === 'NEED_INFO') {
      rows = rows.filter((row) => row.status === 'NEEDS_INFORMATION' || row.status === 'NEED_INFO');
    } else if (appFilter !== 'ALL') {
      rows = rows.filter((row) => row.status === appFilter);
    }
    return rows;
  }, [apps, appFilter, appQuery]);

  const filteredPartners = useMemo(() => {
    let rows = partners.filter((row) => matchesPartnerSearch(row, partnerQuery));
    if (partnerFilter === 'RISK') {
      rows = rows.filter((row) => (row.riskFlags?.length || 0) > 0);
    } else if (partnerFilter !== 'ALL') {
      rows = rows.filter((row) => row.status === partnerFilter);
    }
    return rows;
  }, [partners, partnerFilter, partnerQuery]);

  const filteredOrders = useMemo(() => {
    let rows = orders;
    if (orderPartnerId) {
      rows = rows.filter(
        (row) => row.salesPartnerId === orderPartnerId || row.attribution?.salesPartnerId === orderPartnerId,
      );
    }
    if (orderFilter === 'ACTION') return rows.filter(isActionableDraft);
    if (orderFilter === 'ALL' || !orderFilter) return rows;
    return rows.filter((row) => row.status === orderFilter);
  }, [orders, orderFilter, orderPartnerId]);

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

  async function review(id: string, action: 'APPROVE' | 'NEED_INFO' | 'REJECT', reason = '') {
    if (action !== 'APPROVE' && reason.trim().length < 3) {
      setDetailError('برای رد یا تکمیل اطلاعات حداقل ۳ حرف دلیل بنویسید');
      return;
    }
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
      row.welcomeSmsSent
        ? `پیامک خوش‌آمد قبلاً برای «${row.displayName}» ارسال شده. ارسال مجدد با رمز جدید انجام شود؟\nرمز قبلی دیگر کار نمی‌کند.`
        : `پیامک خوش‌آمد با نام کاربری (موبایل) و رمز عبور جدید برای «${row.displayName}» (${row.phoneMasked}) ارسال شود؟\nرمز قبلی دیگر کار نمی‌کند.`,
    );
    if (!ok) return;
    setBusyId(row.id);
    setError(null);
    try {
      const res = await apiClient.post<{ sent?: boolean; message?: string }>(
        `/admin/sales-partners/applications/${row.id}/welcome-sms`,
        {},
      );
      if (res?.sent !== false) {
        setApps((prev) =>
          prev.map((item) =>
            item.id === row.id
              ? {
                  ...item,
                  welcomeSmsSent: true,
                  welcomeSmsLastSentAt: new Date().toISOString(),
                }
              : item,
          ),
        );
      }
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

  useEffect(() => {
    if (!payoutPartnerId) {
      setAvailableIrr(null);
      return;
    }
    let cancelled = false;
    apiClient
      .get<{ available: number }>(`/admin/sales-partners/${payoutPartnerId}/balances`)
      .then((next) => {
        if (!cancelled) setAvailableIrr(next.available);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'خواندن مانده ناموفق بود');
      });
    return () => {
      cancelled = true;
    };
  }, [payoutPartnerId]);

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
    if (!payoutPartnerId || availableIrr == null) return;
    const min = settings?.minPayoutIrr ?? 0;
    if (availableIrr < min) {
      setError('مانده از حداقل تسویه کمتر است');
      return;
    }
    if (bankReference.trim().length < 4) {
      setError('مرجع واریز حداقل ۴ حرف است');
      return;
    }
    setBusyId('payout');
    try {
      await apiClient.post('/admin/sales-partners/payouts', {
        salesPartnerId: payoutPartnerId,
        bankReference: bankReference.trim(),
        idempotencyKey: payoutIdempotencyKey(payoutPartnerId, bankReference, availableIrr),
        method: 'TRANSFER',
      });
      setBankReference('');
      setPayoutConfirmOpen(false);
      await load();
      await loadBalance();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ثبت تسویه ناموفق بود');
    } finally {
      setBusyId(null);
    }
  }

  async function submitAttribution() {
    if (!attrDialog) return;
    if (!attrPartnerId.trim() || dialogReason.trim().length < 8) {
      setError('همکار فعال و دلیل حداقل ۸ حرف لازم است');
      return;
    }
    setBusyId(attrDialog.id);
    try {
      await apiClient.patch(`/admin/sales-partners/orders/${attrDialog.id}/attribution`, {
        salesPartnerId: attrPartnerId.trim(),
        reason: dialogReason.trim(),
      });
      setAttrDialog(null);
      setDialogReason('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تغییر attribution ناموفق بود');
    } finally {
      setBusyId(null);
    }
  }

  async function submitPartnerStatus() {
    if (!statusDialog) return;
    if (statusDialog.status !== 'ACTIVE' && dialogReason.trim().length < 3) return;
    setBusyId(statusDialog.id);
    try {
      await apiClient.patch(`/admin/sales-partners/${statusDialog.id}/status`, {
        status: statusDialog.status,
        reason: dialogReason.trim() || undefined,
      });
      setStatusDialog(null);
      setDialogReason('');
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
        canaryPhone: settings.canaryPhone || '',
        applyFormFields: settings.applyFormFields || [],
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ذخیره تنظیمات ناموفق بود');
    } finally {
      setBusyId(null);
    }
  }

  useEffect(() => {
    if (rulePercentTouched) return;
    const active = activeProgramRule(rules);
    if (active) setRulePercent(active.percent);
  }, [rules, rulePercentTouched]);

  async function createProgramRule() {
    if (!Number.isInteger(rulePercent) || rulePercent < 0 || rulePercent > 80) {
      setError('درصد برنامه باید عدد صحیح بین ۰ تا ۸۰ باشد');
      return;
    }
    setBusyId('rule');
    setRuleMessage(null);
    try {
      const saved = await apiClient.post<{ percent: number; updatedProducts?: number }>(
        '/admin/sales-partners/rules',
        {
          scope: 'PROGRAM',
          percent: rulePercent,
          note: ruleNote || undefined,
          applyToFollowerProducts: propagateRules,
        },
      );
      const synced = saved.updatedProducts ?? 0;
      setRuleMessage(
        propagateRules
          ? `نرخ برنامه ${saved.percent.toLocaleString('fa-IR')}٪ شد و ${synced.toLocaleString('fa-IR')} محصول پیرو هم‌گام شد.`
          : `نرخ برنامه ${saved.percent.toLocaleString('fa-IR')}٪ شد. محصولات پیرو دست نخوردند.`,
      );
      setRuleNote('');
      setRulePercentTouched(false);
      setCommissionDrafts({});
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ثبت قانون ناموفق بود');
    } finally {
      setBusyId(null);
    }
  }

  const tabs: { id: Tab; label: string; icon: typeof Package }[] = [
    { id: 'dashboard', label: 'داشبورد', icon: LayoutDashboard },
    { id: 'notices', label: 'اطلاع‌رسانی', icon: Megaphone },
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
  const actionOrderCount = orders.filter(isActionableDraft).length;
  const suspendedCount = partners.filter((row) => row.status === 'SUSPENDED').length;

  function goTo(next: Tab, extra?: { appFilter?: string; partnerFilter?: string; orderFilter?: string; focusPartnerId?: string }) {
    setTab(next);
    if (extra?.appFilter) setAppFilter(extra.appFilter);
    if (extra?.partnerFilter) setPartnerFilter(extra.partnerFilter);
    if (extra?.orderFilter) setOrderFilter(extra.orderFilter);
    if (extra?.focusPartnerId) {
      setPayoutPartnerId(extra.focusPartnerId);
      setAvailableIrr(null);
    }
  }
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
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-stone-900">میز عملیات همکار بازاریاب</p>
          {settings ? (
            <p className="mt-1 text-xs text-stone-500">
              {SP_MODE_FA[settings.mode] || settings.mode}
              {settings.enabled ? ' · عملیات فعال' : ' · عملیات خاموش'}
              {settings.applyOpen ? ' · ثبت‌نام باز' : ' · ثبت‌نام بسته'}
              {pendingCount > 0 ? ` · ${pendingCount.toLocaleString('fa-IR')} درخواست باز` : ''}
            </p>
          ) : (
            <p className="mt-1 text-xs text-stone-500">کنترل درخواست، همکار، پیش‌سفارش و تسویه</p>
          )}
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
                {item.id === 'orders' && actionOrderCount > 0 ? (
                  <span className="mr-auto inline-flex min-w-[1.25rem] justify-center rounded-full bg-amber-100 px-1.5 text-[10px] font-bold text-amber-900">
                    {actionOrderCount.toLocaleString('fa-IR')}
                  </span>
                ) : null}
                {item.id === 'partners' && suspendedCount > 0 ? (
                  <span className="mr-auto inline-flex min-w-[1.25rem] justify-center rounded-full bg-red-100 px-1.5 text-[10px] font-bold text-red-800">
                    {suspendedCount.toLocaleString('fa-IR')}
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

      {tab === 'notices' && <SpNoticeDesk />}

      {tab === 'dashboard' && (
        <SpAdminDashboard
          settings={settings}
          report={report}
          apps={apps}
          partners={partners}
          orders={orders}
          audits={audits}
          onGo={goTo}
          onOpenApplication={(id) => {
            setTab('applications');
            void openApplication(id);
          }}
        />
      )}

      {tab === 'applications' && (
        <SpSection
          title="درخواست‌های همکاری"
          description="اول جزئیات کامل را ببینید، بعد تأیید، تکمیل اطلاعات یا رد کنید."
        >
          <div className="flex flex-wrap gap-2">
            <label className="sr-only" htmlFor="sp-app-q">
              جستجوی درخواست
            </label>
            <input
              id="sp-app-q"
              value={appQuery}
              onChange={(e) => setAppQuery(e.target.value)}
              className={`min-h-10 min-w-[12rem] flex-1 rounded-full border border-stone-200 bg-white px-3 text-sm ${spFocusClass}`}
              placeholder="نام، موبایل یا شهر"
            />
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
                    {row.status === 'APPROVED' && row.welcomeSmsSent && (
                      <p
                        className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-center text-[11px] font-medium text-emerald-900"
                        role="status"
                      >
                        پیامک خوش‌آمد ارسال شد
                        {row.welcomeSmsLastSentAt
                          ? ` · ${formatSpDate(row.welcomeSmsLastSentAt)}`
                          : ''}
                      </p>
                    )}
                    {row.status === 'APPROVED' && (
                      <button
                        type="button"
                        className={`min-h-10 rounded-xl border px-3 text-xs font-medium disabled:opacity-60 ${spFocusClass} ${
                          row.welcomeSmsSent
                            ? 'border-stone-200 bg-stone-50 text-stone-700'
                            : 'border-[#1B5C4A]/30 bg-[#E8F2EE] text-[#1B5C4A]'
                        }`}
                        disabled={busyId === row.id}
                        onClick={() => void sendWelcomeSms(row)}
                      >
                        {busyId === row.id
                          ? 'در حال ارسال…'
                          : row.welcomeSmsSent
                            ? 'ارسال مجدد پیامک'
                            : 'ارسال پیامک خوش‌آمد'}
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
        </SpSection>
      )}

      {tab === 'partners' && (
        <SpSection title="همکاران بازاریاب" description="فعال‌سازی، تعلیق، بستن حساب و هشدار ریسک.">
          <div className="flex flex-wrap gap-2">
            <input
              value={partnerQuery}
              onChange={(e) => setPartnerQuery(e.target.value)}
              className={`min-h-10 min-w-[12rem] flex-1 rounded-full border border-stone-200 bg-white px-3 text-sm ${spFocusClass}`}
              placeholder="نام، موبایل یا شبا"
            />
            {[
              { id: 'ALL', label: 'همه' },
              { id: 'ACTIVE', label: 'فعال' },
              { id: 'SUSPENDED', label: 'تعلیق' },
              { id: 'CLOSED', label: 'بسته' },
              { id: 'RISK', label: 'دارای هشدار' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                className={spChipClass(partnerFilter === f.id)}
                onClick={() => setPartnerFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <ul className="space-y-3">
            {filteredPartners.length === 0 && <li><SpEmptyState>همکاری با این فیلتر نیست.</SpEmptyState></li>}
            {filteredPartners.map((row) => (
              <li key={row.id} className="rounded-2xl border border-stone-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{row.displayName}</p>
                    <p className="mt-1 text-sm text-stone-600">{row.phoneMasked}</p>
                    <p className="mt-1 text-xs text-stone-500">
                      {row.ibanMasked ? `شبا ${row.ibanMasked}` : 'شبا ثبت نشده'}
                      {row.termsAcceptedAt ? ` · شرایط ${formatSpDate(row.termsAcceptedAt)}` : ''}
                    </p>
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
                  <SpButton
                    variant="secondary"
                    className="min-h-10 px-3 text-xs"
                    onClick={() => {
                      setTab('orders');
                      setOrderFilter('ALL');
                      setOrderPartnerId(row.id);
                    }}
                  >
                    سفارش‌های این همکار
                  </SpButton>
                  {row.status === 'ACTIVE' && (
                    <SpButton
                      variant="secondary"
                      disabled={busyId === row.id}
                      onClick={() => {
                        setDialogReason('');
                        setStatusDialog({ id: row.id, status: 'SUSPENDED', name: row.displayName });
                      }}
                    >
                      تعلیق
                    </SpButton>
                  )}
                  {row.status === 'SUSPENDED' && (
                    <SpButton
                      disabled={busyId === row.id}
                      onClick={() => {
                        setDialogReason('');
                        setStatusDialog({ id: row.id, status: 'ACTIVE', name: row.displayName });
                      }}
                    >
                      فعال‌سازی
                    </SpButton>
                  )}
                  {row.status !== 'CLOSED' && (
                    <SpButton
                      variant="destructive"
                      disabled={busyId === row.id}
                      onClick={() => {
                        setDialogReason('');
                        setStatusDialog({ id: row.id, status: 'CLOSED', name: row.displayName });
                      }}
                    >
                      بستن حساب
                    </SpButton>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </SpSection>
      )}

      {tab === 'orders' && (
        <SpSection title="سفارش‌های همکاری" description="صف اقدام جدا از تاریخچهٔ منقضی/لغو است. Attribution فقط با انتخاب همکار فعال.">
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'ALL', label: 'همه' },
              { id: 'ACTION', label: 'نیاز به اقدام' },
              { id: 'DRAFT', label: SP_DRAFT_STATUS_FA.DRAFT },
              { id: 'AWAITING_CUSTOMER_CONFIRMATION', label: SP_DRAFT_STATUS_FA.AWAITING_CUSTOMER_CONFIRMATION },
              { id: 'CUSTOMER_CONFIRMED', label: SP_DRAFT_STATUS_FA.CUSTOMER_CONFIRMED },
              { id: 'CONVERTED_TO_ORDER', label: SP_DRAFT_STATUS_FA.CONVERTED_TO_ORDER },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                className={spChipClass(orderFilter === f.id)}
                onClick={() => setOrderFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
            <select
              className={`min-h-10 rounded-full border border-stone-200 bg-white px-3 text-sm ${spFocusClass}`}
              value={orderPartnerId}
              onChange={(e) => setOrderPartnerId(e.target.value)}
              aria-label="فیلتر همکار"
            >
              <option value="">همه همکاران</option>
              {partners.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.displayName}
                </option>
              ))}
            </select>
          </div>
          <ul className="space-y-3">
            {filteredOrders.length === 0 && <li><SpEmptyState>سفارشی با این فیلتر نیست.</SpEmptyState></li>}
            {filteredOrders.map((row) => {
              const partnerLabel = partnerNameById(partners, row.salesPartnerId || row.attribution?.salesPartnerId);
              return (
              <li key={row.id} className="rounded-2xl border border-stone-200 bg-white p-4 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">{SP_DRAFT_STATUS_FA[row.status || ''] || row.statusLabel}</p>
                    <p className="mt-1 text-stone-600">
                      {toman(row.merchandiseIrr)} تومان
                      {row.estimatedCommissionIrr ? ` · تخمین پورسانت ${toman(row.estimatedCommissionIrr)}` : ''}
                    </p>
                    <p className="mt-1 text-xs text-stone-500">
                      {partnerLabel || 'همکار نامشخص'}
                      {row.customerPhoneMasked ? ` · مشتری ${row.customerPhoneMasked}` : ''}
                      {row.orderStatus ? ` · فروشگاه ${row.orderStatus}` : ''}
                    </p>
                  </div>
                  {row.status ? <SpBadge status={row.status} label={row.statusLabel} /> : null}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {row.convertedOrderId ? (
                    <a
                      href={`/admin/orders/${row.convertedOrderId}`}
                      className={`inline-flex min-h-11 items-center rounded-xl border border-stone-200 px-3 ${spFocusClass}`}
                    >
                      سفارش فروشگاه
                    </a>
                  ) : null}
                  {row.convertedOrderId && (
                    <button
                      type="button"
                      className={`min-h-11 rounded-xl border px-3 ${spFocusClass}`}
                      disabled={busyId === row.id}
                      onClick={() => {
                        setDialogReason('');
                        setAttrPartnerId(row.attribution?.salesPartnerId || row.salesPartnerId || '');
                        setAttrDialog(row);
                      }}
                    >
                      تغییر attribution
                    </button>
                  )}
                </div>
              </li>
              );
            })}
          </ul>
        </SpSection>
      )}

      {tab === 'catalog' && (
        <SpSection
          title="محصولات زنده فروشگاه"
          description="هر کالای فعال فروشگاه تکی با قیمت، همین‌جا برای همکار باز است. کالای تازه با انتشار روی سایت اضافه می‌شود. خاموش کردن یک کالا فقط همان استثنا را می‌سازد."
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
                      {(() => {
                        const program = activeProgramRule(rules);
                        if (!program) return null;
                        const follows = draftCommission(row) === program.percent;
                        return (
                          <p className="mt-1 text-xs leading-5 text-stone-500">
                            {follows
                              ? 'پیرو نرخ برنامه؛ با ذخیرهٔ نرخ برنامه عوض می‌شود.'
                              : 'نرخ اختصاصی این کالا؛ با نرخ برنامه عوض نمی‌شود.'}
                          </p>
                        );
                      })()}
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
                          disabled={busyId === row.productId || (!row.eligible && !row.canEnable)}
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
        <SpCommissionRules
          rules={rules}
          percent={rulePercent}
          note={ruleNote}
          propagate={propagateRules}
          busy={busyId === 'rule'}
          message={ruleMessage}
          onPercent={(value) => {
            setRulePercentTouched(true);
            setRulePercent(value);
          }}
          onNote={setRuleNote}
          onPropagate={setPropagateRules}
          onSubmit={() => void createProgramRule()}
        />
      )}

      {tab === 'payouts' && (
        <SpSection title="تسویه پورسانت" description="فقط مانده قابل‌برداشت با مرجع بانکی ثبت می‌شود.">
          <form
            className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4"
            onSubmit={(e) => {
              e.preventDefault();
              setPayoutConfirmOpen(true);
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
                  {row.ibanMasked ? ` · ${row.ibanMasked}` : ''}
                  {row.status !== 'ACTIVE' ? ` · ${SP_PARTNER_STATUS_FA[row.status] || row.status}` : ''}
                </option>
              ))}
            </select>
            {availableIrr !== null && (
              <p className="text-sm">
                قابل‌برداشت: {toman(availableIrr)} تومان
                {settings ? ` · حداقل ${toman(settings.minPayoutIrr)} تومان` : ''}
                {settings?.commissionHoldDays ? ` · نگهداری ${settings.commissionHoldDays.toLocaleString('fa-IR')} روز` : ''}
              </p>
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
              minLength={4}
            />
            <button
              type="submit"
              className={`min-h-11 rounded-xl bg-[#1B5C4A] px-4 text-white ${spFocusClass}`}
              disabled={busyId === 'payout' || !payoutPartnerId || availableIrr == null}
            >
              بررسی و ثبت تسویه
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
            {payouts.map((row) => {
              const payee = partnerNameById(partners, row.salesPartnerId);
              return (
              <li key={row.id} className="rounded-2xl border border-stone-200 bg-white p-4 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium tabular-nums">{toman(row.amountIrr)} تومان</span>
                  <SpBadge status={row.status} label={row.status} />
                </div>
                <p className="mt-1 text-stone-600">
                  {payee || 'همکار'}
                  {row.bankReferenceMasked ? ` · ${row.bankReferenceMasked}` : ''}
                  {row.paidAt ? ` · ${formatSpDate(row.paidAt)}` : ''}
                </p>
              </li>
              );
            })}
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
            {settings.mode === 'CANARY' ? (
              <label className="block text-sm" htmlFor="sp-canary">
                موبایل آزمایشی (CANARY)
                <input
                  id="sp-canary"
                  dir="ltr"
                  className={`mt-1 min-h-11 w-full rounded-xl border px-3 ${spFocusClass}`}
                  value={settings.canaryPhone || ''}
                  onChange={(e) => setSettings({ ...settings, canaryPhone: e.target.value })}
                  placeholder="09xxxxxxxxx"
                />
              </label>
            ) : null}
            {settings.mode === 'LIVE' ? (
              <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                LIVE همهٔ همکاران فعال را برای پیش‌سفارش باز می‌کند. قبل از ذخیره مطمئن شوید نرخ برنامه و محصولات مجاز درست است.
              </p>
            ) : null}
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
            <label className="block text-sm" htmlFor="sp-cap">
              سقف پیش‌سفارش روزانه هر همکار
            </label>
            <input
              id="sp-cap"
              type="number"
              min={1}
              max={100}
              className={`min-h-11 w-32 rounded-xl border px-3 ${spFocusClass}`}
              value={settings.dailyDraftCap}
              onChange={(e) => setSettings({ ...settings, dailyDraftCap: Number(e.target.value) })}
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

      <SpApplicationDetailDrawer
        open={Boolean(detailId)}
        key={detailId || 'closed'}
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
        onReview={(action, reason) => {
          if (detailId) void review(detailId, action, reason);
        }}
        onWelcomeSms={() => {
          const row = apps.find((a) => a.id === detailId);
          if (row) void sendWelcomeSms(row);
        }}
      />

      <SpReasonDialog
        open={Boolean(statusDialog)}
        title={
          statusDialog?.status === 'CLOSED'
            ? `بستن حساب «${statusDialog.name}»`
            : statusDialog?.status === 'SUSPENDED'
              ? `تعلیق «${statusDialog?.name}»`
              : `فعال‌سازی «${statusDialog?.name}»`
        }
        description={
          statusDialog?.status === 'CLOSED'
            ? 'بستن حساب برگشت‌ناپذیر است و نشست ورود باطل می‌شود.'
            : statusDialog?.status === 'ACTIVE'
              ? 'حساب دوباره می‌تواند وارد پنل شود.'
              : 'همکار دیگر نمی‌تواند وارد شود تا دوباره فعال شود.'
        }
        confirmLabel={statusDialog?.status === 'CLOSED' ? 'بستن حساب' : statusDialog?.status === 'SUSPENDED' ? 'تعلیق' : 'فعال‌سازی'}
        destructive={statusDialog?.status !== 'ACTIVE'}
        requireReason={statusDialog?.status !== 'ACTIVE'}
        minLength={3}
        reason={dialogReason}
        onReason={setDialogReason}
        busy={busyId === statusDialog?.id}
        onClose={() => setStatusDialog(null)}
        onConfirm={() => void submitPartnerStatus()}
      />

      <SpReasonDialog
        open={Boolean(attrDialog)}
        title="تغییر attribution سفارش"
        description="فقط همکار فعال انتخاب کنید. بعد از ثبت پورسانت، API تغییر را رد می‌کند."
        confirmLabel="ثبت attribution"
        minLength={8}
        reason={dialogReason}
        onReason={setDialogReason}
        extra={
          <label className="mt-3 block text-sm">
            همکار مقصد
            <select
              className={`mt-1 min-h-11 w-full rounded-xl border px-3 ${spFocusClass}`}
              value={attrPartnerId}
              onChange={(e) => setAttrPartnerId(e.target.value)}
            >
              <option value="">انتخاب کنید</option>
              {partners
                .filter((row) => row.status === 'ACTIVE')
                .map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.displayName}
                  </option>
                ))}
            </select>
          </label>
        }
        busy={busyId === attrDialog?.id}
        onClose={() => setAttrDialog(null)}
        onConfirm={() => void submitAttribution()}
      />

      <SpReasonDialog
        open={payoutConfirmOpen}
        title="تأیید تسویه"
        description={
          availableIrr == null
            ? 'ابتدا مانده را بارگذاری کنید.'
            : `ثبت واریز دستی ${toman(availableIrr)} تومان برای «${partnerNameById(partners, payoutPartnerId) || 'همکار'}» با مرجع ${bankReference.trim()}. این کار انتقال بانکی نیست؛ فقط دفتر را به‌عنوان ثبت‌شده علامت می‌زند.`
        }
        confirmLabel="ثبت به‌عنوان پرداخت‌شده"
        requireReason={false}
        reason={dialogReason}
        onReason={setDialogReason}
        busy={busyId === 'payout'}
        onClose={() => setPayoutConfirmOpen(false)}
        onConfirm={() => void confirmPayout()}
      />
    </div>
  );
}
