'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle, Building2, CheckCircle, CreditCard, Globe, Instagram,
  Loader2, Mail, MessageCircle, MessageSquare, Palette, Phone, Plus,
  Save, Search, ShieldCheck, Trash2, Truck,
} from 'lucide-react';
import { isAdminAuthFailureMessage } from '@/lib/admin-session';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/cn';
import { DEFAULT_THEME } from '@/components/wholesale/ThemeApply';
import { EMPTY_ENAMAD } from '@/lib/enamad';
import { AdminBasalamCatalog } from '@/components/admin/AdminBasalamCatalog';
import { EnamadEditor, NumberField, SecretField, TextAreaField, TextField, ToggleRow } from './settings/fields';
import { SettingsSection } from './settings/primitives';
import { ShippingTab } from './settings/ShippingTab';
import { SmsTab, SMS_TEMPLATE_DEFAULTS } from './settings/SmsTab';
import { ThemeTab } from './settings/ThemeTab';
import type { SaleChannel, SettingsPayload, SettingsTabId } from './settings/types';

const TABS: { id: SettingsTabId; label: string; hint: string; icon: typeof Building2 }[] = [
  { id: 'business', label: 'کسب‌وکار', hint: 'هویت، تماس، اینماد', icon: Building2 },
  { id: 'shipping', label: 'روش‌های ارسال', hint: 'تکی / عمده جدا', icon: Truck },
  { id: 'sms', label: 'پیامک', hint: 'sms.ir و رویدادها', icon: MessageSquare },
  { id: 'payment', label: 'درگاه پرداخت', hint: 'زرین‌پال، دیجی‌پی، ترب‌پی', icon: CreditCard },
  { id: 'installments', label: 'قوانین اقساط', hint: 'پیش‌پرداخت و ماه', icon: CreditCard },
  { id: 'marketing', label: 'Google / پیکسل', hint: 'فید و آنالیتیکس', icon: Globe },
  { id: 'theme', label: 'ظاهر و نوار روان', hint: 'تم و خبر هوم', icon: Palette },
];

const DEFAULT_RETAIL_COMPANIES = [
  { id: 'PISHTAZ', label: 'پست پیشتاز', isActive: true, sort: 10 },
  { id: 'TIPAX', label: 'تیپاکس', isActive: true, sort: 20 },
  { id: 'CHAPAR', label: 'چاپار', isActive: true, sort: 30 },
  { id: 'TEHRAN_BIKE', label: 'پیک تهران', isActive: true, sort: 40 },
  { id: 'IN_PERSON', label: 'تحویل در محل', isActive: true, sort: 50 },
];

const DEFAULT_WHOLESALE_COMPANIES = [
  { id: 'CHAPAR', label: 'چاپار', isActive: true, sort: 10 },
  { id: 'TIPAX', label: 'تیپاکس', isActive: true, sort: 20 },
  { id: 'POST', label: 'پست پیشتاز', isActive: true, sort: 30 },
  { id: 'FREIGHT', label: 'باربری', isActive: true, sort: 40 },
  { id: 'OTHER', label: 'سایر', isActive: true, sort: 50 },
  { id: 'IN_PERSON', label: 'تحویل در محل', isActive: true, sort: 60 },
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

export function AdminSettings() {
  const [tab, setTab] = useState<SettingsTabId>('business');
  const [channel, setChannel] = useState<SaleChannel>('RETAIL');
  const [query, setQuery] = useState('');
  const [data, setData] = useState<SettingsPayload | null>(null);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<SettingsTabId | null>(null);
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});
  const [loadError, setLoadError] = useState('');
  const [digipayProbeBusy, setDigipayProbeBusy] = useState(false);
  const [digipayProbeMsg, setDigipayProbeMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [torobpayProbeBusy, setTorobpayProbeBusy] = useState(false);
  const [torobpayProbeMsg, setTorobpayProbeMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const tickerSaveRef = useRef<() => Promise<void>>(async () => {});

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [res, cats] = await Promise.all([
        apiClient.get<SettingsPayload>('/settings/admin'),
        apiClient.get<Array<{ id: string; name: string }>>('/categories').catch(() => []),
      ]);
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
        baseFee: ship.baseFee ?? 1_500_000,
        perKgFee: ship.perKgFee ?? 250_000,
        freeThreshold: ship.freeThreshold ?? 50_000_000,
        kgPerPiece: ship.kgPerPiece ?? 0.45,
        detailsText: 'وزن تقریبی و کارمزد پایه + هر کیلو برای فروشگاه تکی.',
        companies: DEFAULT_RETAIL_COMPANIES,
      };
      const wholesaleDefaults = {
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
      setData({
        ...res,
        business: {
          ...res.business,
          limitedStockMultiplier: res.business?.limitedStockMultiplier ?? 2,
          newBadgeDays: res.business?.newBadgeDays ?? 7,
          enamadWholesale: { ...EMPTY_ENAMAD, ...(res.business?.enamadWholesale ?? {}), enabled: res.business?.enamadWholesale?.enabled === true },
          enamadRetail: { ...EMPTY_ENAMAD, ...(res.business?.enamadRetail ?? {}), enabled: res.business?.enamadRetail?.enabled === true },
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
          events: {
            orderRegistered: res.sms?.events?.orderRegistered !== false,
            orderConfirmed: res.sms?.events?.orderConfirmed !== false,
            orderShipped: res.sms?.events?.orderShipped !== false,
            paymentReceived: res.sms?.events?.paymentReceived !== false,
            orderRegisteredAdmin: res.sms?.events?.orderRegisteredAdmin !== false,
            wholesaleRegistrationAdmin: res.sms?.events?.wholesaleRegistrationAdmin !== false,
            wholesaleApproved: res.sms?.events?.wholesaleApproved !== false,
          },
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
      });
      setCategories(cats ?? []);
    } catch (e: unknown) {
      setData(null);
      setLoadError(e instanceof Error ? e.message : 'اتصال به سرور تنظیمات برقرار نشد');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    if (!data) return;
    setSaving(true);
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
        await load();
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
      } else {
        await apiClient.put(`/settings/admin/${tab}`, data[tab]);
      }
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

  const visibleTabs = TABS.filter((t) => {
    if (!query.trim()) return true;
    const q = query.trim();
    return t.label.includes(q) || t.hint.includes(q);
  });

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
              تکی و عمده جدا ذخیره می‌شوند. حساب ورود شما این‌جا نیست؛ آن را از{' '}
              <a href="/admin/account" className="font-medium text-primary hover:underline">حساب من</a> عوض کنید.
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
            onChange={(e) => setQuery(e.target.value)}
            placeholder="جستجو: ارسال، پیامک، نوار روان، پیشتاز…"
            className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pr-10 pl-3 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>
      </div>

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <nav className="lg:sticky lg:top-4 lg:w-60 shrink-0" aria-label="بخش‌های تنظیمات">
          <div className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
            {visibleTabs.map((t) => {
              const Icon = t.icon;
              const active = t.id === tab;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={cn(
                    'flex min-h-11 min-w-[9.5rem] items-center gap-3 rounded-2xl border px-3 py-2.5 text-right transition-colors lg:min-w-0',
                    active
                      ? 'border-primary/30 bg-primary text-white shadow-sm'
                      : 'border-transparent bg-white text-gray-700 hover:border-gray-200 hover:bg-gray-50',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>
                    <span className="block text-sm font-semibold">{t.label}</span>
                    <span className={cn('block text-[11px]', active ? 'text-white/80' : 'text-gray-400')}>{t.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </nav>

        <div className="min-w-0 flex-1 space-y-5">
          {tab === 'business' && (
            <div className="space-y-5">
              <SettingsSection title="هویت فروشگاه" hint="نام و راه‌های تماس در فوتر و صفحات عمومی دیده می‌شود.">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <TextField label="نام برند" value={data.business.businessName} onChange={(v) => setData({ ...data, business: { ...data.business, businessName: v } })} icon={<Building2 className="h-4 w-4" />} />
                  <TextField label="نام مدیر (نمایش عمومی)" value={data.business.ownerName} onChange={(v) => setData({ ...data, business: { ...data.business, ownerName: v } })} />
                  <TextField label="شماره تماس" value={data.business.phone} onChange={(v) => setData({ ...data, business: { ...data.business, phone: v } })} icon={<Phone className="h-4 w-4" />} dir="ltr" />
                  <TextField label="ایمیل" value={data.business.email} onChange={(v) => setData({ ...data, business: { ...data.business, email: v } })} icon={<Mail className="h-4 w-4" />} type="email" dir="ltr" />
                </div>
                <TextAreaField label="آدرس کارگاه" value={data.business.address} onChange={(v) => setData({ ...data, business: { ...data.business, address: v } })} />
                <TextAreaField label="آدرس دفتر پخش" value={data.business.officeAddress} onChange={(v) => setData({ ...data, business: { ...data.business, officeAddress: v } })} />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <TextField label="وب‌سایت" value={data.business.website} onChange={(v) => setData({ ...data, business: { ...data.business, website: v } })} icon={<Globe className="h-4 w-4" />} dir="ltr" />
                  <TextField label="اینستاگرام" value={data.business.instagram} onChange={(v) => setData({ ...data, business: { ...data.business, instagram: v } })} icon={<Instagram className="h-4 w-4" />} dir="ltr" />
                  <TextField label="تلگرام" value={data.business.telegram} onChange={(v) => setData({ ...data, business: { ...data.business, telegram: v } })} icon={<MessageCircle className="h-4 w-4" />} dir="ltr" />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <NumberField label="حداقل سفارش (تومان)" value={data.business.minOrderToman} onChange={(v) => setData({ ...data, business: { ...data.business, minOrderToman: v } })} />
                  <NumberField label="اعتبار پیش‌فرض نسیه (روز)" value={data.business.defaultCreditDays} onChange={(v) => setData({ ...data, business: { ...data.business, defaultCreditDays: v } })} />
                  <NumberField label="ضریب موجودی محدود" value={data.business.limitedStockMultiplier ?? 2} onChange={(v) => setData({ ...data, business: { ...data.business, limitedStockMultiplier: Math.max(1, v) } })} help="برای هر دو سایت" />
                  <NumberField label="روزهای نشان جدید" value={data.business.newBadgeDays ?? 7} onChange={(v) => setData({ ...data, business: { ...data.business, newBadgeDays: Math.max(1, v) } })} help="برای هر دو سایت" />
                </div>
              </SettingsSection>
              <SettingsSection title="نماد اعتماد الکترونیکی">
                <EnamadEditor title="عمده — poshaktaranom.com" value={data.business.enamadWholesale} onChange={(next) => setData({ ...data, business: { ...data.business, enamadWholesale: next } })} />
                <EnamadEditor title="تکی — www.poshaktaranom.ir" value={data.business.enamadRetail} onChange={(next) => setData({ ...data, business: { ...data.business, enamadRetail: next } })} />
              </SettingsSection>
            </div>
          )}

          {tab === 'shipping' && (
            <ShippingTab
              shipping={data.shipping}
              shippingPost={data.shippingPost}
              channel={channel}
              onChannel={setChannel}
              onShipping={(shipping) => setData({ ...data, shipping })}
              onPost={(shippingPost) => setData({ ...data, shippingPost })}
            />
          )}

          {tab === 'sms' && (
            <SmsTab
              sms={data.sms}
              smsOps={data.smsOps}
              channel={channel}
              onChannel={setChannel}
              onSms={(sms) => setData({ ...data, sms })}
              onOps={(smsOps) => setData({ ...data, smsOps })}
              showSecret={!!showSecret.smsApiKey}
              onToggleSecret={() => setShowSecret((p) => ({ ...p, smsApiKey: !p.smsApiKey }))}
            />
          )}

          {tab === 'payment' && (
            <div className="space-y-5">
              <SettingsSection title="کلید اصلی پرداخت">
                <ToggleRow label="فعال‌سازی پرداخت آنلاین (کلی)" hint="اگر خاموش باشد هیچ درگاهی کار نمی‌کند" value={data.payment.enabled} onChange={(v) => setData({ ...data, payment: { ...data.payment, enabled: v } })} />
              </SettingsSection>
              <SettingsSection tone="wholesale" title="زرین‌پال عمده" badge=".com">
                <ToggleRow label="فعال‌سازی درگاه عمده" value={data.payment.wholesaleEnabled !== false} onChange={(v) => setData({ ...data, payment: { ...data.payment, wholesaleEnabled: v } })} />
                <SecretField label="مرچنت کد عمده" value={data.payment.merchantId} shown={!!showSecret.merchantId} onToggle={() => setShowSecret((p) => ({ ...p, merchantId: !p.merchantId }))} onChange={(v) => setData({ ...data, payment: { ...data.payment, merchantId: v } })} />
                <ToggleRow label="Sandbox عمده" value={data.payment.sandbox} onChange={(v) => setData({ ...data, payment: { ...data.payment, sandbox: v } })} />
                <TextField label="آدرس بازگشت عمده" value={data.payment.callbackUrl ?? ''} dir="ltr" onChange={(v) => setData({ ...data, payment: { ...data.payment, callbackUrl: v } })} />
              </SettingsSection>
              <SettingsSection tone="retail" title="دیجی‌پی UPG تکی" badge=".ir">
                <ToggleRow label="نمایش دیجی‌پی در چک‌اوت تکی" value={data.payment.digipayEnabled !== false} onChange={(v) => setData({ ...data, payment: { ...data.payment, digipayEnabled: v } })} />
                <SecretField label="شناسه کلاینت UPG" value={data.payment.digipayClientId ?? ''} shown={!!showSecret.digipayClientId} onToggle={() => setShowSecret((p) => ({ ...p, digipayClientId: !p.digipayClientId }))} onChange={(v) => setData({ ...data, payment: { ...data.payment, digipayClientId: v } })} />
                <SecretField label="رمز کلاینت UPG" value={data.payment.digipayClientSecret ?? ''} shown={!!showSecret.digipayClientSecret} onToggle={() => setShowSecret((p) => ({ ...p, digipayClientSecret: !p.digipayClientSecret }))} onChange={(v) => setData({ ...data, payment: { ...data.payment, digipayClientSecret: v } })} />
                <SecretField label="نام کاربری UPG" value={data.payment.digipayUsername ?? ''} shown={!!showSecret.digipayUsername} onToggle={() => setShowSecret((p) => ({ ...p, digipayUsername: !p.digipayUsername }))} onChange={(v) => setData({ ...data, payment: { ...data.payment, digipayUsername: v } })} />
                <SecretField label="رمز عبور UPG" value={data.payment.digipayPassword ?? ''} shown={!!showSecret.digipayPassword} onToggle={() => setShowSecret((p) => ({ ...p, digipayPassword: !p.digipayPassword }))} onChange={(v) => setData({ ...data, payment: { ...data.payment, digipayPassword: v } })} />
                <ToggleRow label="حالت آزمایشی دیجی‌پی (UAT)" value={!!data.payment.digipaySandbox} onChange={(v) => setData({ ...data, payment: { ...data.payment, digipaySandbox: v } })} />
                <button type="button" onClick={() => void testDigipayConnection()} disabled={digipayProbeBusy} className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-900 disabled:opacity-60">
                  {digipayProbeBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                  تست اتصال دیجی‌پی
                </button>
                {digipayProbeMsg ? <p className={cn('rounded-lg border px-3 py-2 text-xs', digipayProbeMsg.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-950')}>{digipayProbeMsg.text}</p> : null}
              </SettingsSection>
              <SettingsSection tone="retail" title="ترب‌پی CPG تکی" badge=".ir">
                <ToggleRow label="نمایش ترب‌پی در چک‌اوت تکی" value={data.payment.torobpayEnabled !== false} onChange={(v) => setData({ ...data, payment: { ...data.payment, torobpayEnabled: v } })} />
                <SecretField label="کد پذیرنده" value={data.payment.torobpayClientId ?? ''} shown={!!showSecret.torobpayClientId} onToggle={() => setShowSecret((p) => ({ ...p, torobpayClientId: !p.torobpayClientId }))} onChange={(v) => setData({ ...data, payment: { ...data.payment, torobpayClientId: v } })} />
                <SecretField label="کلید" value={data.payment.torobpayClientSecret ?? ''} shown={!!showSecret.torobpayClientSecret} onToggle={() => setShowSecret((p) => ({ ...p, torobpayClientSecret: !p.torobpayClientSecret }))} onChange={(v) => setData({ ...data, payment: { ...data.payment, torobpayClientSecret: v } })} />
                <SecretField label="نام کاربری فعال‌سازی" value={data.payment.torobpayUsername ?? ''} shown={!!showSecret.torobpayUsername} onToggle={() => setShowSecret((p) => ({ ...p, torobpayUsername: !p.torobpayUsername }))} onChange={(v) => setData({ ...data, payment: { ...data.payment, torobpayUsername: v } })} />
                <SecretField label="رمز عبور فعال‌سازی" value={data.payment.torobpayPassword ?? ''} shown={!!showSecret.torobpayPassword} onToggle={() => setShowSecret((p) => ({ ...p, torobpayPassword: !p.torobpayPassword }))} onChange={(v) => setData({ ...data, payment: { ...data.payment, torobpayPassword: v } })} />
                <ToggleRow label="حالت آزمایشی ترب‌پی" value={!!data.payment.torobpaySandbox} onChange={(v) => setData({ ...data, payment: { ...data.payment, torobpaySandbox: v } })} />
                <button type="button" onClick={() => void testTorobpayConnection()} disabled={torobpayProbeBusy} className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-900 disabled:opacity-60">
                  {torobpayProbeBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                  تست اتصال ترب‌پی
                </button>
                {torobpayProbeMsg ? <p className={cn('rounded-lg border px-3 py-2 text-xs', torobpayProbeMsg.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-950')}>{torobpayProbeMsg.text}</p> : null}
              </SettingsSection>
              <SettingsSection tone="retail" title="زرین‌پال فروشگاه تکی" badge=".ir">
                <ToggleRow label="فعال‌سازی درگاه تکی" value={data.payment.retailEnabled !== false} onChange={(v) => setData({ ...data, payment: { ...data.payment, retailEnabled: v } })} />
                <SecretField label="مرچنت کد تکی" value={data.payment.retailMerchantId ?? ''} shown={!!showSecret.retailMerchantId} onToggle={() => setShowSecret((p) => ({ ...p, retailMerchantId: !p.retailMerchantId }))} onChange={(v) => setData({ ...data, payment: { ...data.payment, retailMerchantId: v } })} />
                <ToggleRow label="Sandbox تکی" value={!!data.payment.retailSandbox} onChange={(v) => setData({ ...data, payment: { ...data.payment, retailSandbox: v } })} />
                <TextField label="آدرس بازگشت تکی" value={data.payment.retailCallbackUrl ?? ''} dir="ltr" onChange={(v) => setData({ ...data, payment: { ...data.payment, retailCallbackUrl: v } })} />
              </SettingsSection>
              <SettingsSection title="کارت به کارت">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <TextField label="شماره کارت" value={data.payment.manualCardNumber} dir="ltr" onChange={(v) => setData({ ...data, payment: { ...data.payment, manualCardNumber: v } })} />
                  <TextField label="صاحب کارت" value={data.payment.manualCardOwner} onChange={(v) => setData({ ...data, payment: { ...data.payment, manualCardOwner: v } })} />
                </div>
              </SettingsSection>
            </div>
          )}

          {tab === 'installments' && (
            <SettingsSection title="قوانین پرداخت اقساطی" hint="اقساط فقط برای مشتریان با حداقل ۲ فاکتور فعال.">
              <div className="flex justify-end">
                <button type="button" className="btn btn-outline btn-sm inline-flex items-center gap-1.5" onClick={() => setData({
                  ...data,
                  installments: {
                    ...data.installments,
                    rules: [...(data.installments.rules ?? []), { id: `rule_${Date.now()}`, minDownPaymentPercent: 30, maxMonths: 6, categoryId: null }],
                  },
                })}>
                  <Plus className="h-3.5 w-3.5" /> افزودن قانون
                </button>
              </div>
              {(data.installments.rules ?? []).map((rule) => (
                <div key={rule.id} className="grid grid-cols-1 items-end gap-3 rounded-2xl border border-gray-100 p-4 sm:grid-cols-4">
                  <NumberField label="حداقل پیش‌پرداخت (%)" value={rule.minDownPaymentPercent} onChange={(v) => setData({ ...data, installments: { ...data.installments, rules: data.installments.rules.map((r) => r.id === rule.id ? { ...r, minDownPaymentPercent: v } : r) } })} />
                  <NumberField label="حداکثر اقساط (ماه)" value={rule.maxMonths} onChange={(v) => setData({ ...data, installments: { ...data.installments, rules: data.installments.rules.map((r) => r.id === rule.id ? { ...r, maxMonths: Math.max(1, v) } : r) } })} />
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">دسته‌بندی</label>
                    <select value={rule.categoryId ?? ''} onChange={(e) => setData({ ...data, installments: { ...data.installments, rules: data.installments.rules.map((r) => r.id === rule.id ? { ...r, categoryId: e.target.value || null } : r) } })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
                      <option value="">همه</option>
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <button type="button" className="btn btn-ghost btn-sm text-error inline-flex items-center gap-1" disabled={(data.installments.rules?.length ?? 0) <= 1} onClick={() => setData({ ...data, installments: { ...data.installments, rules: data.installments.rules.filter((r) => r.id !== rule.id) } })}>
                    <Trash2 className="h-3.5 w-3.5" /> حذف
                  </button>
                </div>
              ))}
            </SettingsSection>
          )}

          {tab === 'marketing' && (
            <div className="space-y-5">
              <SettingsSection title="ترب و فیدها">
                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                  <input type="checkbox" checked={!!data.marketing.torobOrderSyncEnabled} onChange={(e) => setData({ ...data, marketing: { ...data.marketing, torobOrderSyncEnabled: e.target.checked } })} className="rounded border-emerald-300" />
                  فعال‌سازی همگام‌سازی سفارش ترب
                </label>
                <p className="font-mono text-xs text-gray-500" dir="ltr">https://www.poshaktaranom.ir/api/v1/feeds/torob.xml</p>
              </SettingsSection>
              <SettingsSection title="Google Analytics و Search Console">
                <div className="grid gap-4 sm:grid-cols-2">
                  {([
                    ['ga4WholesaleId', 'GA4 عمده'],
                    ['ga4RetailId', 'GA4 تکی'],
                    ['gtmWholesaleId', 'GTM عمده'],
                    ['gtmRetailId', 'GTM تکی'],
                    ['gscWholesaleVerification', 'تأیید GSC عمده'],
                    ['gscRetailVerification', 'تأیید GSC تکی'],
                  ] as const).map(([key, label]) => (
                    <TextField key={key} label={label} value={(data.marketing as unknown as Record<string, string>)[key] ?? ''} onChange={(v) => setData({ ...data, marketing: { ...data.marketing, [key]: v } })} dir="ltr" />
                  ))}
                </div>
              </SettingsSection>
              <SettingsSection title="پیکسل و پست‌بک">
                <TextField label="نام برند در فید" value={data.marketing.feedBrandName} onChange={(v) => setData({ ...data, marketing: { ...data.marketing, feedBrandName: v } })} />
                <div className="grid gap-4 sm:grid-cols-2">
                  {([
                    ['yektanetPixelId', 'Yektanet Pixel'],
                    ['metaPixelId', 'Meta Pixel'],
                    ['adroScriptUrl', 'Adro Script'],
                    ['adroAccountId', 'Adro Account'],
                    ['afferScriptUrl', 'Affer Script'],
                    ['afsonaScriptUrl', 'Afsona Script'],
                    ['takhfifanScriptUrl', 'Takhfifan Script'],
                    ['yektanetPostbackUrl', 'Yektanet Postback'],
                    ['afferPostbackUrl', 'Affer Postback'],
                    ['afsonaPostbackUrl', 'Afsona Callback'],
                    ['takhfifanPostbackUrl', 'Takhfifan Postback'],
                    ['postbackUrl', 'Generic Postback'],
                  ] as const).map(([key, label]) => (
                    <TextField key={key} label={label} value={(data.marketing as unknown as Record<string, string>)[key] ?? ''} onChange={(v) => setData({ ...data, marketing: { ...data.marketing, [key]: v } })} dir="ltr" />
                  ))}
                </div>
                <ToggleRow label="ارسال پست‌بک حتی بدون click id" value={!!data.marketing.broadcastPostbacks} onChange={(v) => setData({ ...data, marketing: { ...data.marketing, broadcastPostbacks: v } })} />
              </SettingsSection>
              <SettingsSection title="باسلام">
                <ToggleRow label="فعال‌سازی همگام‌سازی باسلام" value={!!data.marketing.basalamEnabled} onChange={(v) => setData({ ...data, marketing: { ...data.marketing, basalamEnabled: v } })} />
                <TextField label="Vendor ID" value={data.marketing.basalamVendorId} onChange={(v) => setData({ ...data, marketing: { ...data.marketing, basalamVendorId: v } })} dir="ltr" />
                <SecretField label="Access Token" value={data.marketing.basalamAccessToken} shown={!!showSecret.basalam} onToggle={() => setShowSecret((s) => ({ ...s, basalam: !s.basalam }))} onChange={(v) => setData({ ...data, marketing: { ...data.marketing, basalamAccessToken: v } })} />
                <AdminBasalamCatalog />
              </SettingsSection>
            </div>
          )}

          {tab === 'theme' && (
            <ThemeTab
              theme={data.theme}
              channel={channel}
              onChannel={setChannel}
              onTheme={(theme) => setData({ ...data, theme })}
              tickerSaveRef={tickerSaveRef}
            />
          )}

          <div className="sticky bottom-0 z-10 flex items-center gap-4 rounded-2xl border border-gray-100 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
            <button type="button" onClick={() => void save()} disabled={saving} className="btn btn-primary btn-md inline-flex items-center gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              ذخیره این بخش
            </button>
            {saved === tab ? (
              <p className="inline-flex items-center gap-1.5 text-sm font-medium text-success">
                <CheckCircle className="h-4 w-4" /> ذخیره شد
              </p>
            ) : (
              <p className="text-xs text-gray-400">فقط تنظیمات همین تب ذخیره می‌شود</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
