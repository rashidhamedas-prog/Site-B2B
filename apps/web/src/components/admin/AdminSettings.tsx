'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  AlertCircle, Building2, CheckCircle, CreditCard, Globe, Loader2,
  Menu, MessageSquare, Palette, Save, Search, ScanSearch, Truck,
} from 'lucide-react';
import { isAdminAuthFailureMessage } from '@/lib/admin-session';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/cn';
import { revalidateStorefrontAfterSave } from '@/lib/cms/revalidate-client';
import { DEFAULT_THEME } from '@/components/wholesale/ThemeApply';
import { EMPTY_ENAMAD } from '@/lib/enamad';
import {
  DEFAULT_SEO_SETTINGS,
  SETTINGS_SECTION_HINT,
  SETTINGS_SECTION_LABEL,
  SETTINGS_SECTIONS,
  parseSettingsWorkspaceQuery,
  resolveSmsEvents,
  serializeSettingsWorkspaceQuery,
  settingsSectionMatchesQuery,
  type SettingsSectionId,
} from '@/lib/admin-settings-workspace';
import { BusinessTab } from './settings/BusinessTab';
import { InstallmentsTab } from './settings/InstallmentsTab';
import { MarketingTab } from './settings/MarketingTab';
import { NavigationTab } from './settings/NavigationTab';
import { PaymentTab } from './settings/PaymentTab';
import { SeoTab } from './settings/SeoTab';
import { ShippingTab } from './settings/ShippingTab';
import { SmsTab, SMS_TEMPLATE_DEFAULTS } from './settings/SmsTab';
import { ThemeTab } from './settings/ThemeTab';
import type { SaleChannel, SettingsPayload } from './settings/types';

const SECTION_ICONS: Record<SettingsSectionId, typeof Building2> = {
  business: Building2,
  navigation: Menu,
  shipping: Truck,
  sms: MessageSquare,
  payment: CreditCard,
  installments: CreditCard,
  seo: ScanSearch,
  marketing: Globe,
  theme: Palette,
};

const DEFAULT_RETAIL_COMPANIES = [
  { id: 'PISHTAZ', label: 'پست پیشتاز', isActive: true, sort: 10 },
  { id: 'TIPAX', label: 'تیپاکس', isActive: true, sort: 20 },
  { id: 'CHAPAR', label: 'چاپار', isActive: true, sort: 30 },
  { id: 'TEHRAN_BIKE', label: 'پیک تهران', isActive: true, sort: 40 },
  { id: 'IN_PERSON', label: 'تحویل در محل', isActive: false, sort: 50 },
];

const DEFAULT_WHOLESALE_COMPANIES = [
  { id: 'CHAPAR', label: 'چاپار', isActive: true, sort: 10 },
  { id: 'TIPAX', label: 'تیپاکس', isActive: true, sort: 20 },
  { id: 'POST', label: 'پست پیشتاز', isActive: true, sort: 30 },
  { id: 'FREIGHT', label: 'باربری', isActive: true, sort: 40 },
  { id: 'OTHER', label: 'سایر', isActive: true, sort: 50 },
  { id: 'IN_PERSON', label: 'تحویل در محل', isActive: false, sort: 60 },
];

const DEFAULT_POST = {
  enabled: false,
  originProvince: 'خراسان رضوی',
  originCity: 'مشهد',
  sameCityBase: 730_000,
  sameProvinceBase: 830_000,
  otherBase: 1_030_000,
  extraKgFee: 180_000,
  vatPercent: 10,
};

const DEFAULT_OPS = { orderPaidAdmin: true, abandonedCart: true, stockOutAdmin: true };

function hydrateSettings(res: SettingsPayload): SettingsPayload {
  const installments = res.installments ?? ({} as SettingsPayload['installments']);
  const rules = Array.isArray(installments.rules) && installments.rules.length
    ? installments.rules
    : [{
        id: 'default',
        minDownPaymentPercent: Number(installments.minDownPaymentPercent) || 0,
        maxMonths: Math.max(1, Number(installments.maxMonths) || 6),
        categoryId: null as string | null,
      }];
  const ship = res.shipping ?? ({} as SettingsPayload['shipping']);
  const retailDefaults = {
    inPersonEnabled: false,
    baseFee: ship.baseFee ?? 1_500_000,
    perKgFee: ship.perKgFee ?? 250_000,
    freeThreshold: ship.freeThreshold ?? 50_000_000,
    kgPerPiece: ship.kgPerPiece ?? 0.45,
    detailsText: 'وزن تقریبی و کارمزد پایه + هر کیلو برای فروشگاه تکی.',
    companies: DEFAULT_RETAIL_COMPANIES,
  };
  const wholesaleDefaults = {
    inPersonEnabled: false,
    baseFee: ship.baseFee ?? 1_500_000,
    freeThreshold: ship.freeThreshold ?? 50_000_000,
    detailsText: 'هزینه ثابت ارسال عمده؛ روش‌های فعال در چک‌اوت عمده.',
    companies: DEFAULT_WHOLESALE_COMPANIES,
  };
  const retail = {
    ...retailDefaults,
    ...(ship.retail ?? {}),
    companies: Array.isArray(ship.retail?.companies) ? ship.retail.companies : DEFAULT_RETAIL_COMPANIES,
  };
  const wholesale = {
    ...wholesaleDefaults,
    ...(ship.wholesale ?? {}),
    companies: Array.isArray(ship.wholesale?.companies)
      ? ship.wholesale.companies
      : (Array.isArray(ship.companies) ? ship.companies : DEFAULT_WHOLESALE_COMPANIES),
  };
  const post = res.shippingPost ?? { retail: DEFAULT_POST, wholesale: DEFAULT_POST };
  return {
    ...res,
    business: {
      ...res.business,
      postalCode: res.business?.postalCode ?? '',
      logoUrl: res.business?.logoUrl ?? '',
      logoAlt: res.business?.logoAlt ?? '',
      descriptionWholesale: res.business?.descriptionWholesale ?? '',
      descriptionRetail: res.business?.descriptionRetail ?? '',
      sameAs: Array.isArray(res.business?.sameAs) ? res.business.sameAs : [],
      limitedStockMultiplier: res.business?.limitedStockMultiplier ?? 2,
      newBadgeDays: res.business?.newBadgeDays ?? 7,
      enamadWholesale: { ...EMPTY_ENAMAD, ...(res.business?.enamadWholesale ?? {}), enabled: res.business?.enamadWholesale?.enabled === true },
      enamadRetail: { ...EMPTY_ENAMAD, ...(res.business?.enamadRetail ?? {}), enabled: res.business?.enamadRetail?.enabled === true },
    },
    seo: {
      wholesale: { ...DEFAULT_SEO_SETTINGS.wholesale, ...(res.seo?.wholesale ?? {}) },
      retail: { ...DEFAULT_SEO_SETTINGS.retail, ...(res.seo?.retail ?? {}) },
    },
    shipping: {
      ...ship,
      baseFee: retail.baseFee,
      perKgFee: retail.perKgFee,
      freeThreshold: retail.freeThreshold,
      kgPerPiece: retail.kgPerPiece,
      retail,
      wholesale,
      companies: wholesale.companies,
      methods: ship.methods ?? {},
    },
    shippingPost: {
      retail: { ...DEFAULT_POST, ...(post.retail ?? {}) },
      wholesale: { ...DEFAULT_POST, ...(post.wholesale ?? {}) },
    },
    sms: {
      enabled: res.sms?.enabled ?? true,
      apiKey: res.sms?.apiKey ?? '',
      lineNumber: res.sms?.lineNumber ?? '',
      otpTemplateId: Number(res.sms?.otpTemplateId) || 0,
      adminPhoneWholesale: res.sms?.adminPhoneWholesale ?? '',
      adminPhoneWholesale2: res.sms?.adminPhoneWholesale2 ?? '',
      adminPhoneRetail: res.sms?.adminPhoneRetail ?? '',
      adminPhoneRetail2: res.sms?.adminPhoneRetail2 ?? '',
      events: resolveSmsEvents(res.sms?.events),
      templates: { ...SMS_TEMPLATE_DEFAULTS, ...(res.sms?.templates ?? {}) },
    },
    smsOps: {
      retail: { ...DEFAULT_OPS, ...(res.smsOps?.retail ?? {}) },
      wholesale: { ...DEFAULT_OPS, ...(res.smsOps?.wholesale ?? {}) },
    },
    payment: {
      enabled: res.payment?.enabled ?? true,
      wholesaleEnabled: res.payment?.wholesaleEnabled !== false,
      merchantId: res.payment?.merchantId ?? '',
      sandbox: !!res.payment?.sandbox,
      callbackUrl: res.payment?.callbackUrl ?? 'https://poshaktaranom.com/payment/callback',
      retailEnabled: res.payment?.retailEnabled !== false,
      retailMerchantId: res.payment?.retailMerchantId ?? '',
      retailSandbox: !!res.payment?.retailSandbox,
      retailCallbackUrl: res.payment?.retailCallbackUrl ?? 'https://www.poshaktaranom.ir/payment/callback',
      digipayEnabled: res.payment?.digipayEnabled !== false,
      digipayClientId: res.payment?.digipayClientId ?? '',
      digipayClientSecret: res.payment?.digipayClientSecret ?? '',
      digipayUsername: res.payment?.digipayUsername ?? '',
      digipayPassword: res.payment?.digipayPassword ?? '',
      digipaySandbox: !!res.payment?.digipaySandbox,
      digipayConfigured: !!res.payment?.digipayConfigured,
      torobpayEnabled: res.payment?.torobpayEnabled !== false,
      torobpayClientId: res.payment?.torobpayClientId ?? '',
      torobpayClientSecret: res.payment?.torobpayClientSecret ?? '',
      torobpayUsername: res.payment?.torobpayUsername ?? '',
      torobpayPassword: res.payment?.torobpayPassword ?? '',
      torobpaySandbox: !!res.payment?.torobpaySandbox,
      torobpayConfigured: !!res.payment?.torobpayConfigured,
      manualCardNumber: res.payment?.manualCardNumber ?? '',
      manualCardOwner: res.payment?.manualCardOwner ?? '',
      retailCashEnabled: res.payment?.retailCashEnabled === true,
      wholesaleCashEnabled: res.payment?.wholesaleCashEnabled === true,
    },
    installments: { ...installments, rules, minActiveInvoices: installments.minActiveInvoices ?? 2 },
    theme: {
      ...DEFAULT_THEME,
      ...(res.theme ?? {}),
      retailStorefrontSkin: res.theme?.retailStorefrontSkin === 'boutique' ? 'boutique' : 'classic',
      popups: {
        boutique: { ...DEFAULT_THEME.popups.boutique, ...res.theme?.popups?.boutique },
        newsletter: { ...DEFAULT_THEME.popups.newsletter, ...res.theme?.popups?.newsletter },
      },
    },
    marketing: {
      feedBrandName: res.marketing?.feedBrandName ?? 'پوشاک ترنم',
      ga4WholesaleId: res.marketing?.ga4WholesaleId ?? '',
      ga4RetailId: res.marketing?.ga4RetailId ?? '',
      gtmWholesaleId: res.marketing?.gtmWholesaleId ?? '',
      gtmRetailId: res.marketing?.gtmRetailId ?? '',
      gscWholesaleVerification: res.marketing?.gscWholesaleVerification ?? '',
      gscRetailVerification: res.marketing?.gscRetailVerification ?? '',
      yektanetPixelId: res.marketing?.yektanetPixelId ?? '',
      metaPixelId: res.marketing?.metaPixelId ?? '',
      adroScriptUrl: res.marketing?.adroScriptUrl ?? '',
      adroAccountId: res.marketing?.adroAccountId ?? '',
      afferScriptUrl: res.marketing?.afferScriptUrl ?? '',
      afsonaScriptUrl: res.marketing?.afsonaScriptUrl ?? '',
      takhfifanScriptUrl: res.marketing?.takhfifanScriptUrl ?? '',
      yektanetPostbackUrl: res.marketing?.yektanetPostbackUrl ?? '',
      afferPostbackUrl: res.marketing?.afferPostbackUrl ?? '',
      afsonaPostbackUrl: res.marketing?.afsonaPostbackUrl ?? '',
      takhfifanPostbackUrl: res.marketing?.takhfifanPostbackUrl ?? '',
      postbackUrl: res.marketing?.postbackUrl ?? '',
      broadcastPostbacks: res.marketing?.broadcastPostbacks === true,
      basalamEnabled: res.marketing?.basalamEnabled === true,
      basalamAccessToken: res.marketing?.basalamAccessToken ?? '',
      basalamVendorId: res.marketing?.basalamVendorId ?? '',
      torobOrderSyncEnabled: res.marketing?.torobOrderSyncEnabled === true,
    },
  };
}

export function AdminSettings() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const workspace = parseSettingsWorkspaceQuery(searchParams);
  const tab = workspace.section;
  const channel = workspace.channel;
  const [query, setQuery] = useState(workspace.q);
  const [data, setData] = useState<SettingsPayload | null>(null);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<SettingsSectionId | null>(null);
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});
  const [loadError, setLoadError] = useState('');
  const [digipayProbeBusy, setDigipayProbeBusy] = useState(false);
  const [digipayProbeMsg, setDigipayProbeMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [torobpayProbeBusy, setTorobpayProbeBusy] = useState(false);
  const [torobpayProbeMsg, setTorobpayProbeMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [syncNote, setSyncNote] = useState('');
  const tickerSaveRef = useRef<() => Promise<void>>(async () => {});

  const replaceWorkspace = useCallback((next: { section?: SettingsSectionId; channel?: SaleChannel; q?: string }) => {
    const qs = serializeSettingsWorkspaceQuery({
      section: next.section ?? tab,
      channel: next.channel ?? channel,
      q: next.q ?? query,
    });
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [channel, pathname, query, router, tab]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [res, cats] = await Promise.all([
        apiClient.get<SettingsPayload>('/settings/admin'),
        apiClient.get<Array<{ id: string; name: string }>>('/categories').catch(() => []),
      ]);
      setData(hydrateSettings(res));
      setCategories(cats ?? []);
    } catch (e: unknown) {
      setData(null);
      setLoadError(e instanceof Error ? e.message : 'اتصال به سرور تنظیمات برقرار نشد');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setQuery(workspace.q); }, [workspace.q]);

  const save = async () => {
    if (!data) return;
    setSaving(true);
    setSyncNote('');
    try {
      if (tab === 'shipping') {
        const ship = data.shipping;
        await apiClient.put('/settings/admin/shipping', {
          ...ship,
          baseFee: ship.retail.baseFee,
          perKgFee: ship.retail.perKgFee,
          freeThreshold: ship.retail.freeThreshold,
          kgPerPiece: ship.retail.kgPerPiece,
          companies: ship.wholesale.companies,
          retail: ship.retail,
          wholesale: ship.wholesale,
        });
        await apiClient.put('/settings/admin/shippingPost', {
          retail: data.shippingPost.retail,
          wholesale: data.shippingPost.wholesale,
        });
      } else if (tab === 'sms') {
        await apiClient.put('/settings/admin/sms', data.sms);
        await apiClient.put('/settings/admin/smsOps', data.smsOps);
      } else if (tab === 'theme') {
        await apiClient.put('/settings/admin/theme', data.theme);
        await tickerSaveRef.current();
      } else if (tab === 'installments') {
        const inst = data.installments;
        const rules = inst.rules ?? [];
        await apiClient.put('/settings/admin/installments', {
          ...inst,
          rules,
          minDownPaymentPercent: rules[0]?.minDownPaymentPercent ?? inst.minDownPaymentPercent ?? 0,
          maxMonths: Math.max(...rules.map((r) => r.maxMonths), inst.maxMonths || 1),
          minActiveInvoices: inst.minActiveInvoices ?? 2,
        });
      } else if (tab === 'seo') {
        await apiClient.put('/settings/admin/seo', data.seo);
        await apiClient.put('/settings/admin/marketing', data.marketing);
      } else if (tab === 'navigation') {
        setSaving(false);
        return;
      } else {
        await apiClient.put(`/settings/admin/${tab}`, data[tab as 'business' | 'payment' | 'marketing' | 'theme']);
      }
      const bust = await Promise.all([
        revalidateStorefrontAfterSave('WHOLESALE', 'chrome'),
        revalidateStorefrontAfterSave('RETAIL', 'chrome'),
      ]);
      const failed = bust.filter((b) => !b.ok);
      setSyncNote(failed.length ? 'ذخیره شد؛ تازه‌سازی ویترین کامل نشد — یک‌بار دیگر ذخیره کنید.' : 'ویترین تکی و عمده تازه‌سازی شد');
      await load();
      setSaved(tab);
      setTimeout(() => setSaved(null), 2500);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'خطا در ذخیره تنظیمات');
    } finally {
      setSaving(false);
    }
  };

  const testDigipayConnection = async () => {
    if (!data) return;
    setDigipayProbeBusy(true);
    setDigipayProbeMsg(null);
    try {
      const res = await apiClient.post<{ ok: boolean; stage: string; failureClass?: string; message: string; sandbox: boolean }>(
        '/payments/digipay/connection-test',
        {
          digipayClientId: data.payment.digipayClientId,
          digipayClientSecret: data.payment.digipayClientSecret,
          digipayUsername: data.payment.digipayUsername,
          digipayPassword: data.payment.digipayPassword,
          digipaySandbox: !!data.payment.digipaySandbox,
        },
      );
      const envLabel = res.sandbox ? 'UAT' : 'عملیاتی';
      setDigipayProbeMsg({
        ok: !!res.ok,
        text: `${res.ok ? 'موفق' : 'ناموفق'} (${envLabel} · ${res.stage}${res.failureClass ? ` · ${res.failureClass}` : ''}): ${res.message}`,
      });
    } catch (e: unknown) {
      setDigipayProbeMsg({ ok: false, text: e instanceof Error ? e.message : 'تست اتصال دیجی‌پی انجام نشد' });
    } finally {
      setDigipayProbeBusy(false);
    }
  };

  const testTorobpayConnection = async () => {
    if (!data) return;
    setTorobpayProbeBusy(true);
    setTorobpayProbeMsg(null);
    try {
      const res = await apiClient.post<{ ok: boolean; stage: string; failureClass?: string; message: string; eligible?: boolean }>(
        '/payments/torobpay/connection-test',
        {
          torobpayClientId: data.payment.torobpayClientId,
          torobpayClientSecret: data.payment.torobpayClientSecret,
          torobpayUsername: data.payment.torobpayUsername,
          torobpayPassword: data.payment.torobpayPassword,
          torobpaySandbox: !!data.payment.torobpaySandbox,
        },
      );
      setTorobpayProbeMsg({
        ok: !!res.ok,
        text: `${res.ok ? 'موفق' : 'ناموفق'} (${res.stage}${res.failureClass ? ` · ${res.failureClass}` : ''}${typeof res.eligible === 'boolean' ? ` · eligible=${res.eligible}` : ''}): ${res.message}`,
      });
    } catch (e: unknown) {
      setTorobpayProbeMsg({ ok: false, text: e instanceof Error ? e.message : 'تست اتصال ترب‌پی انجام نشد' });
    } finally {
      setTorobpayProbeBusy(false);
    }
  };

  const visibleTabs = SETTINGS_SECTIONS.filter((id) => settingsSectionMatchesQuery(id, query));

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) {
    const staffOnly = loadError.includes('فقط مدیر کل');
    const sessionForbidden = isAdminAuthFailureMessage(loadError);
    return (
      <div className="card mx-auto max-w-lg p-8 text-center">
        <AlertCircle className="mx-auto mb-3 h-10 w-10 text-error" />
        <p className="font-medium text-gray-800">{staffOnly ? 'فقط مدیر کل به تنظیمات سیستم دسترسی دارد' : 'تنظیمات بارگذاری نشد'}</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-gray-500" role="alert">{loadError || 'اتصال به سرور تنظیمات برقرار نشد'}</p>
        {staffOnly ? (
          <p className="mt-3 text-sm text-gray-600">ایمیل و رمز ورود را از <a href="/admin/account" className="font-semibold text-primary hover:underline">حساب من</a> عوض کنید.</p>
        ) : sessionForbidden ? (
          <p className="mt-3 text-sm text-gray-600">از <a href="/admin/login" className="font-semibold text-primary hover:underline">ورود مدیریت</a> دوباره وارد شوید.</p>
        ) : null}
        <button type="button" onClick={() => void load()} className="btn btn-primary btn-sm mt-4 min-h-11">تلاش مجدد</button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold tracking-wide text-primary">پنل عملیات فروشگاه</p>
            <h2 className="mt-1 text-xl font-bold text-gray-900">تنظیمات سیستم</h2>
            <p className="mt-1 max-w-xl text-sm leading-6 text-gray-500">
              هر بخش جدا ذخیره می‌شود و بعد از ذخیره به ویترین تکی و عمده می‌رسد. حساب ورود از{' '}
              <a href="/admin/account" className="font-medium text-primary hover:underline">حساب من</a> عوض می‌شود.
            </p>
          </div>
          <a href="/admin/site-content" className="inline-flex min-h-11 items-center rounded-xl border border-primary/20 bg-primary/5 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/10">
            محتوای صفحات →
          </a>
        </div>
        <label className="relative mt-4 block max-w-md">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              replaceWorkspace({ q: e.target.value });
            }}
            placeholder="جستجو: ارسال، پیامک، سئو، منو…"
            className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pr-10 pl-3 text-sm focus:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          />
        </label>
      </div>

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <nav className="lg:sticky lg:top-4 lg:w-60 shrink-0" aria-label="بخش‌های تنظیمات">
          <div className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
            {visibleTabs.map((id) => {
              const Icon = SECTION_ICONS[id];
              const active = id === tab;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => replaceWorkspace({ section: id })}
                  className={cn(
                    'flex min-h-11 min-w-[9.5rem] items-center gap-3 rounded-2xl border px-3 py-2.5 text-right transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 lg:min-w-0',
                    active
                      ? 'border-primary/30 bg-primary text-white shadow-sm'
                      : 'border-transparent bg-white text-gray-700 hover:border-gray-200 hover:bg-gray-50',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{SETTINGS_SECTION_LABEL[id]}</span>
                    <span className={cn('block text-[11px]', active ? 'text-white/80' : 'text-gray-400')}>{SETTINGS_SECTION_HINT[id]}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </nav>

        <div className="min-w-0 flex-1 space-y-5">
          {tab === 'business' && <BusinessTab data={data} onChange={setData} />}
          {tab === 'navigation' && <NavigationTab />}
          {tab === 'shipping' && (
            <ShippingTab
              shipping={data.shipping}
              shippingPost={data.shippingPost}
              channel={channel}
              onChannel={(ch) => replaceWorkspace({ channel: ch })}
              onShipping={(shipping) => setData({ ...data, shipping })}
              onPost={(shippingPost) => setData({ ...data, shippingPost })}
            />
          )}
          {tab === 'sms' && (
            <SmsTab
              sms={data.sms}
              smsOps={data.smsOps}
              channel={channel}
              onChannel={(ch) => replaceWorkspace({ channel: ch })}
              onSms={(sms) => setData({ ...data, sms })}
              onOps={(smsOps) => setData({ ...data, smsOps })}
              showSecret={!!showSecret.smsApiKey}
              onToggleSecret={() => setShowSecret((p) => ({ ...p, smsApiKey: !p.smsApiKey }))}
            />
          )}
          {tab === 'payment' && (
            <PaymentTab
              data={data}
              showSecret={showSecret}
              onToggleSecret={(key) => setShowSecret((p) => ({ ...p, [key]: !p[key] }))}
              onChange={setData}
              digipayBusy={digipayProbeBusy}
              digipayMsg={digipayProbeMsg}
              onTestDigipay={() => void testDigipayConnection()}
              torobpayBusy={torobpayProbeBusy}
              torobpayMsg={torobpayProbeMsg}
              onTestTorobpay={() => void testTorobpayConnection()}
            />
          )}
          {tab === 'installments' && (
            <InstallmentsTab data={data} categories={categories} onChange={setData} />
          )}
          {tab === 'seo' && (
            <SeoTab
              data={data}
              channel={channel}
              onChannel={(ch) => replaceWorkspace({ channel: ch })}
              onChange={setData}
            />
          )}
          {tab === 'marketing' && (
            <MarketingTab
              data={data}
              showBasalam={!!showSecret.basalam}
              onToggleBasalam={() => setShowSecret((s) => ({ ...s, basalam: !s.basalam }))}
              onChange={setData}
            />
          )}
          {tab === 'theme' && (
            <ThemeTab
              theme={data.theme}
              channel={channel}
              onChannel={(ch) => replaceWorkspace({ channel: ch })}
              onTheme={(theme) => setData({ ...data, theme })}
              tickerSaveRef={tickerSaveRef}
            />
          )}

          {tab !== 'navigation' ? (
            <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-4 rounded-2xl border border-gray-100 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
              <button type="button" onClick={() => void save()} disabled={saving} className="btn btn-primary btn-md inline-flex min-h-11 items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                ذخیره این بخش
              </button>
              {saved === tab ? (
                <p className="inline-flex items-center gap-1.5 text-sm font-medium text-success">
                  <CheckCircle className="h-4 w-4" /> ذخیره شد
                </p>
              ) : (
                <p className="text-xs text-gray-400">فقط تنظیمات همین بخش ذخیره می‌شود</p>
              )}
              {syncNote ? <p className="text-xs text-gray-500">{syncNote}</p> : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
