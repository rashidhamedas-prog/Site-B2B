'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { toman } from '@/lib/product-display';

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
  riskFlags?: string[];
};

type CatalogRow = {
  productId: string;
  name: string;
  slug: string | null;
  priceIrr: number;
  vendorSku: boolean;
  eligible: boolean;
  previewCommissionPercent: number;
  marginIrr: number;
  minMarginIrr: number;
  canEnable: boolean;
};

type RuleRow = {
  id: string;
  scope: string;
  percent: number;
  active: boolean;
  productId: string | null;
  categoryId: string | null;
  salesPartnerId: string | null;
  note: string | null;
};

type PayoutRow = {
  id: string;
  salesPartnerId: string;
  status: string;
  amountIrr: number;
  bankReferenceMasked: string | null;
  paidAt: string | null;
};

type Settings = {
  enabled: boolean;
  mode: 'OFF' | 'PREVIEW' | 'CANARY' | 'LIVE';
  applyOpen: boolean;
  commissionHoldDays: number | null;
  minPayoutIrr: number;
  dailyDraftCap: number;
  termsVersion: string;
};

type DraftRow = {
  id: string;
  salesPartnerId?: string;
  statusLabel: string;
  merchandiseIrr: number;
  convertedOrderId: string | null;
  customerPhoneMasked: string | null;
  attribution?: { salesSource: string; salesPartnerId: string | null; salesPartnerSubmissionId: string | null } | null;
};

type AuditRow = { id: string; action: string; targetType: string; targetId: string; createdAt: string };
type Report = {
  applications: { total: number; byStatus: Record<string, number> };
  partners: { total: number; byStatus: Record<string, number> };
  drafts: { sampleSize: number; byStatus: Record<string, number>; converted: number; customerConfirmRate: number | null };
  note: string;
};

type Tab = 'applications' | 'partners' | 'orders' | 'catalog' | 'rules' | 'payouts' | 'settings' | 'reports';

export function AdminSalesPartners() {
  const [tab, setTab] = useState<Tab>('applications');
  const [apps, setApps] = useState<ApplicationRow[]>([]);
  const [partners, setPartners] = useState<PartnerRow[]>([]);
  const [catalog, setCatalog] = useState<CatalogRow[]>([]);
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rulePercent, setRulePercent] = useState(5);
  const [ruleNote, setRuleNote] = useState('');
  const [payoutPartnerId, setPayoutPartnerId] = useState('');
  const [bankReference, setBankReference] = useState('');
  const [availableIrr, setAvailableIrr] = useState<number | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [orders, setOrders] = useState<DraftRow[]>([]);
  const [audits, setAudits] = useState<AuditRow[]>([]);
  const [report, setReport] = useState<Report | null>(null);

  async function load() {
    setError(null);
    try {
      const [nextApps, nextPartners, nextCatalog, nextRules, nextPayouts, nextSettings, nextOrders, nextAudits, nextReport] = await Promise.all([
        apiClient.get<ApplicationRow[]>('/admin/sales-partners/applications'),
        apiClient.get<PartnerRow[]>('/admin/sales-partners'),
        apiClient.get<{ items: CatalogRow[] }>(`/admin/sales-partners/catalog${query ? `?q=${encodeURIComponent(query)}` : ''}`),
        apiClient.get<RuleRow[]>('/admin/sales-partners/rules'),
        apiClient.get<PayoutRow[]>('/admin/sales-partners/payouts'),
        apiClient.get<Settings>('/admin/sales-partners/settings'),
        apiClient.get<DraftRow[]>('/admin/sales-partners/orders'),
        apiClient.get<AuditRow[]>('/admin/sales-partners/audits'),
        apiClient.get<Report>('/admin/sales-partners/reports'),
      ]);
      setApps(nextApps);
      setPartners(nextPartners);
      setCatalog(nextCatalog.items);
      setRules(nextRules);
      setPayouts(nextPayouts);
      setSettings(nextSettings);
      setOrders(nextOrders);
      setAudits(nextAudits);
      setReport(nextReport);
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

  async function toggleEligible(row: CatalogRow) {
    const partnerPercent = row.vendorSku
      ? Number(window.prompt('درصد پورسانت بازاریاب برای کنترل حاشیه', String(row.previewCommissionPercent)) || row.previewCommissionPercent)
      : row.previewCommissionPercent;
    setBusyId(row.productId);
    try {
      await apiClient.patch(`/admin/sales-partners/catalog/${row.productId}/eligibility`, {
        eligible: !row.eligible,
        partnerPercent,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تغییر مجاز بودن محصول ناموفق بود');
    } finally {
      setBusyId(null);
    }
  }

  async function loadBalance() {
    if (!payoutPartnerId) return;
    try {
      const next = await apiClient.get<{ available: number }>(`/admin/sales-partners/${payoutPartnerId}/balances`);
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

  const tabs: { id: Tab; label: string }[] = [
    { id: 'applications', label: 'درخواست‌ها' },
    { id: 'partners', label: 'همکاران بازاریاب' },
    { id: 'orders', label: 'سفارش‌ها' },
    { id: 'catalog', label: 'محصولات مجاز' },
    { id: 'rules', label: 'قوانین پورسانت' },
    { id: 'payouts', label: 'تسویه' },
    { id: 'settings', label: 'تنظیمات' },
    { id: 'reports', label: 'گزارش و سوابق' },
  ];

  return (
    <div className="space-y-6" dir="rtl">
      <p className="text-sm text-stone-600">
        این بخش برای همکار بازاریاب است، نه تأمین‌کننده ارسال. برنامه تا روشن‌شدن فلگ روی سفارش‌های فعلی اثر ندارد.
      </p>
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`min-h-11 rounded-xl px-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1B5C4A] ${
              tab === item.id ? 'bg-[#1B5C4A] text-white' : 'border'
            }`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
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
              {row.riskFlags && row.riskFlags.length > 0 && (
                <p className="mt-2 text-sm text-amber-900" role="status">هشدار: {row.riskFlags.join('، ')}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {row.status === 'ACTIVE' && (
                  <button type="button" className="min-h-11 rounded-lg border px-3" disabled={busyId === row.id} onClick={() => void setPartnerStatus(row.id, 'SUSPENDED')}>تعلیق</button>
                )}
                {row.status === 'SUSPENDED' && (
                  <button type="button" className="min-h-11 rounded-lg bg-emerald-700 px-3 text-white" disabled={busyId === row.id} onClick={() => void setPartnerStatus(row.id, 'ACTIVE')}>فعال‌سازی</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {tab === 'orders' && (
        <ul className="space-y-3">
          {orders.length === 0 && <li className="text-sm text-stone-600">سفارش همکاری ثبت نشده.</li>}
          {orders.map((row) => (
            <li key={row.id} className="rounded-xl border p-4 text-sm">
              <p className="font-medium">{row.statusLabel}</p>
              <p className="mt-1 text-stone-600">
                {toman(row.merchandiseIrr)} تومان
                {row.customerPhoneMasked ? ` · ${row.customerPhoneMasked}` : ''}
              </p>
              {row.convertedOrderId && (
                <div className="mt-2 space-y-2">
                  <p className="text-stone-500">
                    سفارش فروشگاه ساخته شده است
                    {row.attribution?.salesSource ? ` · منبع ${row.attribution.salesSource}` : ''}
                  </p>
                  <button
                    type="button"
                    className="min-h-11 rounded-lg border px-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1B5C4A]"
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
      )}

      {tab === 'catalog' && (
        <div className="space-y-3">
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void load();
            }}
          >
            <label className="sr-only" htmlFor="sp-catalog-q">جستجوی محصول</label>
            <input
              id="sp-catalog-q"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="min-h-11 min-w-0 flex-1 rounded-xl border px-3"
              placeholder="نام محصول"
            />
            <button type="submit" className="min-h-11 rounded-xl border px-4">جستجو</button>
          </form>
          {catalog.length === 0 && <p className="text-sm text-stone-600">محصولی پیدا نشد.</p>}
          <ul className="space-y-3">
            {catalog.map((row) => (
              <li key={row.productId} className="rounded-xl border p-4">
                <p className="font-medium">{row.name}</p>
                <p className="text-sm text-stone-600">
                  {toman(row.priceIrr)} تومان · پورسانت پیش‌فرض {row.previewCommissionPercent}٪
                  {row.vendorSku ? ' · کالای تأمین‌کننده' : ''}
                </p>
                {row.vendorSku && (
                  <p className="mt-1 text-sm text-amber-800">
                    {row.canEnable
                      ? `حاشیه پس از پورسانت بازاریاب کافی است (${toman(row.marginIrr)} تومان).`
                      : 'حاشیه کافی نیست؛ فعال‌سازی رد می‌شود.'}
                  </p>
                )}
                <button
                  type="button"
                  className="mt-3 min-h-11 rounded-lg border px-3"
                  disabled={busyId === row.productId || (!row.eligible && !row.canEnable)}
                  onClick={() => void toggleEligible(row)}
                >
                  {row.eligible ? 'غیرفعال کردن برای بازاریاب' : 'مجاز کردن برای بازاریاب'}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === 'rules' && (
        <div className="space-y-4">
          <form
            className="space-y-3 rounded-xl border p-4"
            onSubmit={(e) => {
              e.preventDefault();
              void createProgramRule();
            }}
          >
            <p className="font-medium">نرخ پیش‌فرض برنامه</p>
            <label className="block text-sm" htmlFor="sp-rule-percent">درصد</label>
            <input
              id="sp-rule-percent"
              type="number"
              min={0}
              max={80}
              value={rulePercent}
              onChange={(e) => setRulePercent(Number(e.target.value))}
              className="min-h-11 w-32 rounded-xl border px-3"
            />
            <label className="block text-sm" htmlFor="sp-rule-note">توضیح داخلی</label>
            <input
              id="sp-rule-note"
              value={ruleNote}
              onChange={(e) => setRuleNote(e.target.value)}
              className="min-h-11 w-full rounded-xl border px-3"
            />
            <button type="submit" className="min-h-11 rounded-xl bg-[#1B5C4A] px-4 text-white" disabled={busyId === 'rule'}>
              ثبت نرخ برنامه
            </button>
          </form>
          <ul className="space-y-3">
            {rules.length === 0 && <li className="text-sm text-stone-600">قانونی ثبت نشده؛ تا آن زمان پورسانت تخمینی صفر است.</li>}
            {rules.map((row) => (
              <li key={row.id} className="rounded-xl border p-4 text-sm">
                <p className="font-medium">{row.scope} · {row.percent}٪ {row.active ? '' : '(غیرفعال)'}</p>
                {row.note && <p className="mt-1 text-stone-600">{row.note}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === 'payouts' && (
        <div className="space-y-4">
          <form
            className="space-y-3 rounded-xl border p-4"
            onSubmit={(e) => {
              e.preventDefault();
              void confirmPayout();
            }}
          >
            <label className="block text-sm" htmlFor="sp-pay-partner">همکار بازاریاب</label>
            <select
              id="sp-pay-partner"
              className="min-h-11 w-full rounded-xl border px-3"
              value={payoutPartnerId}
              onChange={(e) => {
                setPayoutPartnerId(e.target.value);
                setAvailableIrr(null);
              }}
            >
              <option value="">انتخاب کنید</option>
              {partners.map((row) => (
                <option key={row.id} value={row.id}>{row.displayName}</option>
              ))}
            </select>
            <button
              type="button"
              className="min-h-11 rounded-xl border px-4"
              disabled={!payoutPartnerId}
              onClick={() => void loadBalance()}
            >
              مشاهده مانده
            </button>
            {availableIrr !== null && (
              <p className="text-sm">قابل‌برداشت: {toman(availableIrr)} تومان</p>
            )}
            <label className="block text-sm" htmlFor="sp-pay-ref">شماره مرجع واریز</label>
            <input
              id="sp-pay-ref"
              className="min-h-11 w-full rounded-xl border px-3"
              value={bankReference}
              onChange={(e) => setBankReference(e.target.value)}
              required
            />
            <button type="submit" className="min-h-11 rounded-xl bg-[#1B5C4A] px-4 text-white" disabled={busyId === 'payout'}>
              ثبت تسویه
            </button>
          </form>
          <ul className="space-y-3">
            {payouts.length === 0 && <li className="text-sm text-stone-600">تسویه‌ای ثبت نشده.</li>}
            {payouts.map((row) => (
              <li key={row.id} className="rounded-xl border p-4 text-sm">
                {toman(row.amountIrr)} تومان · {row.bankReferenceMasked} · {row.status}
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === 'settings' && settings && (
        <form
          className="space-y-3 rounded-xl border p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void saveSettings();
          }}
        >
          <label className="block text-sm" htmlFor="sp-mode">وضعیت برنامه</label>
          <select
            id="sp-mode"
            className="min-h-11 w-full rounded-xl border px-3"
            value={settings.mode}
            onChange={(e) => setSettings({ ...settings, mode: e.target.value as Settings['mode'] })}
          >
            <option value="OFF">خاموش</option>
            <option value="PREVIEW">پیش‌نمایش ثبت‌نام</option>
            <option value="CANARY">آزمایشی</option>
            <option value="LIVE">زنده</option>
          </select>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" checked={settings.enabled} onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })} />
            فعال بودن عملیات همکار (CANARY/LIVE)
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" checked={settings.applyOpen} onChange={(e) => setSettings({ ...settings, applyOpen: e.target.checked })} />
            باز بودن ثبت‌نام
          </label>
          <label className="block text-sm" htmlFor="sp-hold">مهلت نگهداری پورسانت (روز)</label>
          <input
            id="sp-hold"
            type="number"
            min={1}
            max={180}
            className="min-h-11 w-32 rounded-xl border px-3"
            value={settings.commissionHoldDays ?? ''}
            onChange={(e) => setSettings({ ...settings, commissionHoldDays: e.target.value ? Number(e.target.value) : null })}
          />
          <label className="block text-sm" htmlFor="sp-min">حداقل تسویه (ریال)</label>
          <input
            id="sp-min"
            type="number"
            min={0}
            className="min-h-11 w-48 rounded-xl border px-3"
            value={settings.minPayoutIrr}
            onChange={(e) => setSettings({ ...settings, minPayoutIrr: Number(e.target.value) })}
          />
          <p className="text-sm text-stone-600">نسخه شرایط: {settings.termsVersion} — متن حقوقی نهایی را اختراع نکنید.</p>
          <button type="submit" className="min-h-11 rounded-xl bg-[#1B5C4A] px-4 text-white" disabled={busyId === 'settings'}>
            ذخیره تنظیمات
          </button>
        </form>
      )}

      {tab === 'reports' && (
        <div className="space-y-4 text-sm">
          {report && (
            <section className="rounded-xl border p-4">
              <p className="font-medium">شاخص‌ها از دادهٔ همین سامانه است، نه هدف فروش.</p>
              <p className="mt-2 text-stone-600">{report.note}</p>
              <p className="mt-3">درخواست‌ها: {report.applications.total}</p>
              <p>همکاران: {report.partners.total}</p>
              <p>نمونه پیش‌سفارش: {report.drafts.sampleSize} · تبدیل‌شده: {report.drafts.converted}</p>
              <p>
                نرخ تأیید مشتری در نمونه:
                {' '}
                {report.drafts.customerConfirmRate == null
                  ? 'هنوز تصمیم قطعی کافی نیست'
                  : `${Math.round(report.drafts.customerConfirmRate * 100)}٪`}
              </p>
            </section>
          )}
          <section>
            <p className="mb-2 font-medium">سوابق تصمیم</p>
            <ul className="space-y-2">
              {audits.length === 0 && <li className="text-stone-600">سابقه‌ای نیست.</li>}
              {audits.map((row) => (
                <li key={row.id} className="rounded-xl border p-3">
                  {row.action} · {row.targetType} · {new Date(row.createdAt).toLocaleString('fa-IR')}
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
