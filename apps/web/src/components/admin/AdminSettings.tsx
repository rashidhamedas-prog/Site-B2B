'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Save, Building2, Phone, Mail, Globe, Instagram, MessageCircle,
  Truck, MessageSquare, CreditCard, CheckCircle, AlertCircle, Loader2,
  Eye, EyeOff, Plus, Trash2, Palette, ShieldCheck, Upload,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/cn';
import { DEFAULT_THEME, type ThemeSettings } from '@/components/wholesale/ThemeApply';
import { useImageUpload } from '@/lib/hooks/useImageUpload';
import { EMPTY_ENAMAD, applyEnamadHtmlPaste, enamadLogoUrl, resolveMediaUrl, type EnamadSealConfig } from '@/lib/enamad';
import { EnamadSeal } from '@/components/shared/EnamadSeal';

// ── Types ─────────────────────────────────────────────────────

interface InstallmentRule {
  id: string;
  minDownPaymentPercent: number;
  maxMonths: number;
  categoryId: string | null;
}

interface SettingsPayload {
  business: {
    businessName: string; ownerName: string; phone: string; email: string;
    website: string; instagram: string; telegram: string;
    address: string; officeAddress: string;
    minOrderToman: number; defaultCreditDays: number;
    limitedStockMultiplier?: number;
    newBadgeDays?: number;
    enamadWholesale: EnamadSealConfig;
    enamadRetail: EnamadSealConfig;
  };
  shipping: {
    /** @deprecated Prefer retail.* — mirrored from retail for API compat */
    baseFee: number; perKgFee: number; freeThreshold: number;
    /** @deprecated Prefer retail.kgPerPiece */
    kgPerPiece?: number;
    retail: {
      baseFee: number;
      perKgFee: number;
      freeThreshold: number;
      kgPerPiece: number;
      detailsText: string;
    };
    wholesale: {
      baseFee: number;
      freeThreshold: number;
      detailsText: string;
    };
    companies: Array<{ id: string; label: string; isActive: boolean; sort: number }>;
    methods: Record<string, boolean>;
  };
  sms: {
    enabled: boolean; apiKey: string; lineNumber: string; otpTemplateId: number;
    adminPhoneWholesale: string;
    adminPhoneWholesale2: string;
    adminPhoneRetail: string;
    adminPhoneRetail2: string;
    events: Record<string, boolean>;
    templates: Record<string, string>;
  };
  payment: {
    enabled: boolean; wholesaleEnabled: boolean; merchantId: string; sandbox: boolean;
    callbackUrl: string;
    retailEnabled: boolean; retailMerchantId: string; retailSandbox: boolean;
    retailCallbackUrl: string;
    manualCardNumber: string; manualCardOwner: string;
  };
  installments: {
    /** @deprecated legacy — kept for API compat; prefer rules[] */
    minDownPaymentPercent: number;
    /** @deprecated legacy — kept for API compat */
    minDownPaymentAmount: number;
    /** @deprecated legacy — kept for API compat; prefer rules[] */
    maxMonths: number;
    rules: InstallmentRule[];
    minActiveInvoices?: number;
  };
  theme: ThemeSettings;
  marketing: {
    feedBrandName: string;
    ga4WholesaleId: string;
    ga4RetailId: string;
    gtmWholesaleId: string;
    gtmRetailId: string;
    gscWholesaleVerification: string;
    gscRetailVerification: string;
    yektanetPixelId: string;
    metaPixelId: string;
    adroScriptUrl: string;
    adroAccountId: string;
    afferScriptUrl: string;
    afsonaScriptUrl: string;
    takhfifanScriptUrl: string;
    yektanetPostbackUrl: string;
    afferPostbackUrl: string;
    afsonaPostbackUrl: string;
    takhfifanPostbackUrl: string;
    postbackUrl: string;
    broadcastPostbacks: boolean;
    basalamEnabled: boolean;
    basalamAccessToken: string;
    basalamVendorId: string;
    torobOrderSyncEnabled: boolean;
  };
}

type TabId = 'business' | 'shipping' | 'sms' | 'payment' | 'installments' | 'theme' | 'marketing';

const TABS: { id: TabId; label: string; icon: any }[] = [
  { id: 'business', label: 'کسب‌وکار', icon: Building2 },
  { id: 'shipping', label: 'روش‌های ارسال', icon: Truck },
  { id: 'sms',      label: 'پیامک (sms.ir)', icon: MessageSquare },
  { id: 'payment',  label: 'درگاه پرداخت', icon: CreditCard },
  { id: 'installments', label: 'قوانین اقساط', icon: CreditCard },
  { id: 'marketing', label: 'Google / پیکسل', icon: Globe },
  { id: 'theme', label: 'تنظیمات تم ترنم', icon: Palette },
];

const SMS_CUSTOMER_EVENTS: Record<string, string> = {
  orderRegistered: 'پیامک ثبت سفارش جدید (به مشتری)',
  orderConfirmed:  'پیامک تأیید سفارش (به مشتری)',
  orderShipped:    'پیامک ارسال مرسوله + کد رهگیری (به مشتری)',
  paymentReceived: 'پیامک دریافت پرداخت (به مشتری)',
  wholesaleApproved: 'پیامک تأیید حساب عمده (به مشتری)',
};

const SMS_ADMIN_EVENTS: Record<string, string> = {
  orderRegisteredAdmin: 'پیامک ثبت سفارش جدید (به ادمین)',
  wholesaleRegistrationAdmin: 'پیامک ثبت‌نام عمده جدید (به ادمین)',
};

/** Default bodies — must match API `SMS_TEMPLATE_DEFAULTS` */
const SMS_TEMPLATE_DEFAULTS: Record<string, string> = {
  otpFallback: 'پوشاک ترنم\nکد تایید شما: {code}',
  orderRegistered:
    'پوشاک ترنم\nسفارش {orderNumber} ثبت شد و در انتظار بررسی است.\nپیگیری: poshaktaranom.com/portal',
  orderRegisteredAdmin: 'پوشاک ترنم\nسفارش جدید {site}\nشماره: {orderNumber}{customerLine}',
  wholesaleRegistrationAdmin: 'پوشاک ترنم\nثبت‌نام عمده جدید\n{customerName}\n{phone}',
  wholesaleApproved: 'پوشاک ترنم\n{greet}حساب عمده شما تأیید شد.\nورود: poshaktaranom.com/portal',
  orderConfirmed: 'پوشاک ترنم\nسفارش {orderNumber} تایید شد و آماده‌سازی آن آغاز شده است.',
  orderShipped: 'پوشاک ترنم\nسفارش {orderNumber} ارسال شد.{trackingLine}',
  paymentReceived: 'پوشاک ترنم\nپرداخت {amountToman} تومان با موفقیت ثبت شد.\nکد پیگیری: {refId}',
};

const SMS_TEMPLATE_META: Array<{
  key: string;
  label: string;
  placeholders: string;
}> = [
  { key: 'otpFallback', label: 'OTP (وقتی قالب sms.ir ست نشده)', placeholders: '{code}' },
  { key: 'orderRegistered', label: SMS_CUSTOMER_EVENTS.orderRegistered, placeholders: '{orderNumber}' },
  { key: 'orderConfirmed', label: SMS_CUSTOMER_EVENTS.orderConfirmed, placeholders: '{orderNumber}' },
  { key: 'orderShipped', label: SMS_CUSTOMER_EVENTS.orderShipped, placeholders: '{orderNumber} {trackingLine} {trackingCode}' },
  { key: 'paymentReceived', label: SMS_CUSTOMER_EVENTS.paymentReceived, placeholders: '{amountToman} {refId}' },
  { key: 'wholesaleApproved', label: SMS_CUSTOMER_EVENTS.wholesaleApproved, placeholders: '{greet} {customerName}' },
  { key: 'orderRegisteredAdmin', label: SMS_ADMIN_EVENTS.orderRegisteredAdmin, placeholders: '{site} {orderNumber} {customerLine}' },
  { key: 'wholesaleRegistrationAdmin', label: SMS_ADMIN_EVENTS.wholesaleRegistrationAdmin, placeholders: '{customerName} {phone}' },
];

// ── Component ─────────────────────────────────────────────────

export function AdminSettings() {
  const [tab, setTab] = useState<TabId>('business');
  const [data, setData] = useState<SettingsPayload | null>(null);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<TabId | null>(null);
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
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
      setData({
        ...res,
        business: {
          ...res.business,
          limitedStockMultiplier: res.business?.limitedStockMultiplier ?? 2,
          newBadgeDays: res.business?.newBadgeDays ?? 7,
          enamadWholesale: {
            ...EMPTY_ENAMAD,
            ...(res.business?.enamadWholesale ?? {}),
            enabled: res.business?.enamadWholesale?.enabled === true,
          },
          enamadRetail: {
            ...EMPTY_ENAMAD,
            ...(res.business?.enamadRetail ?? {}),
            enabled: res.business?.enamadRetail?.enabled === true,
          },
        },
        shipping: (() => {
          const ship = res.shipping ?? ({} as SettingsPayload['shipping']);
          const retailDefaults = {
            baseFee: ship.baseFee ?? 1_500_000,
            perKgFee: ship.perKgFee ?? 250_000,
            freeThreshold: ship.freeThreshold ?? 50_000_000,
            kgPerPiece: ship.kgPerPiece ?? 0.45,
            detailsText: [
              'وزن تقریبی: ceil(تعداد × وزن‌هر‌عدد × ۱۰) / ۱۰ کیلوگرم',
              'هزینه: کارمزد پایه + ceil(وزن) × کارمزد هر کیلو',
              'پیک تهران / اسنپ‌باکس: حداکثر برابر کارمزد پایه. اگر مبلغ فاکتور ≥ آستانه ارسال رایگان → هزینه صفر.',
            ].join('\n'),
          };
          const wholesaleDefaults = {
            baseFee: ship.baseFee ?? 1_500_000,
            freeThreshold: ship.freeThreshold ?? 50_000_000,
            detailsText: [
              'هزینه ثابت = کارمزد پایه (بدون ضرب وزن)، مگر اینکه مبلغ پس از تخفیف ≥ آستانه ارسال رایگان باشد.',
              'شرکت‌های حمل فعال در checkout نمایش داده می‌شوند.',
            ].join('\n'),
          };
          const retail = {
            ...retailDefaults,
            ...(ship.retail ?? {}),
            baseFee: ship.retail?.baseFee ?? retailDefaults.baseFee,
            perKgFee: ship.retail?.perKgFee ?? retailDefaults.perKgFee,
            freeThreshold: ship.retail?.freeThreshold ?? retailDefaults.freeThreshold,
            kgPerPiece: ship.retail?.kgPerPiece ?? retailDefaults.kgPerPiece,
            detailsText: ship.retail?.detailsText || retailDefaults.detailsText,
          };
          const wholesale = {
            ...wholesaleDefaults,
            ...(ship.wholesale ?? {}),
            baseFee: ship.wholesale?.baseFee ?? wholesaleDefaults.baseFee,
            freeThreshold: ship.wholesale?.freeThreshold ?? wholesaleDefaults.freeThreshold,
            detailsText: ship.wholesale?.detailsText || wholesaleDefaults.detailsText,
          };
          return {
            ...ship,
            baseFee: retail.baseFee,
            perKgFee: retail.perKgFee,
            freeThreshold: retail.freeThreshold,
            kgPerPiece: retail.kgPerPiece,
            retail,
            wholesale,
            companies: ship.companies ?? [],
            methods: ship.methods ?? {},
          };
        })(),
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
          templates: {
            ...SMS_TEMPLATE_DEFAULTS,
            ...(res.sms?.templates ?? {}),
          },
        },
        payment: {
          enabled: res.payment?.enabled ?? true,
          wholesaleEnabled: res.payment?.wholesaleEnabled !== false,
          merchantId: res.payment?.merchantId ?? '',
          sandbox: !!res.payment?.sandbox,
          callbackUrl:
            res.payment?.callbackUrl ??
            'https://poshaktaranom.com/payment/callback',
          retailEnabled: res.payment?.retailEnabled !== false,
          retailMerchantId: res.payment?.retailMerchantId ?? '',
          retailSandbox: !!res.payment?.retailSandbox,
          retailCallbackUrl:
            res.payment?.retailCallbackUrl ??
            'https://www.poshaktaranom.ir/payment/callback',
          manualCardNumber: res.payment?.manualCardNumber ?? '',
          manualCardOwner: res.payment?.manualCardOwner ?? '',
        },
        installments: {
          ...installments,
          rules,
          minActiveInvoices: installments.minActiveInvoices ?? 2,
        },
        theme: {
          ...DEFAULT_THEME,
          ...(res.theme ?? {}),
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
    } catch { /* keep null → show error banner */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!data) return;
    setSaving(true);
    try {
      let payload: SettingsPayload[TabId] = data[tab];
      if (tab === 'installments') {
        const inst = data.installments;
        const rules = inst.rules ?? [];
        payload = {
          ...inst,
          rules,
          minDownPaymentPercent: rules[0]?.minDownPaymentPercent ?? inst.minDownPaymentPercent ?? 0,
          maxMonths: Math.max(...rules.map((r) => r.maxMonths), inst.maxMonths || 1),
          minActiveInvoices: inst.minActiveInvoices ?? 2,
        };
      }
      if (tab === 'shipping') {
        const ship = data.shipping;
        // Mirror retail → legacy flat fields so older consumers stay in sync
        payload = {
          ...ship,
          baseFee: ship.retail.baseFee,
          perKgFee: ship.retail.perKgFee,
          freeThreshold: ship.retail.freeThreshold,
          kgPerPiece: ship.retail.kgPerPiece,
          retail: ship.retail,
          wholesale: ship.wholesale,
        };
      }
      await apiClient.put(`/settings/admin/${tab}`, payload);
      setSaved(tab);
      setTimeout(() => setSaved(null), 2500);
    } catch (e: any) {
      alert(e?.message ?? 'خطا در ذخیره تنظیمات');
    } finally { setSaving(false); }
  };

  const patch = <K extends TabId>(group: K, updater: (g: SettingsPayload[K]) => SettingsPayload[K]) => {
    setData((prev) => prev ? { ...prev, [group]: updater(prev[group]) } : prev);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="card p-8 text-center">
        <AlertCircle className="h-10 w-10 text-error mx-auto mb-3" />
        <p className="text-gray-700 font-medium">اتصال به سرور تنظیمات برقرار نشد</p>
        <button onClick={load} className="btn btn-primary btn-sm mt-4">تلاش مجدد</button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">تنظیمات سیستم</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          همه تنظیمات کسب‌وکار و یکپارچه‌سازی‌ها را از اینجا کنترل کنید — تغییرات به‌صورت زنده روی سایت اعمال می‌شوند
        </p>
        <a
          href="/admin/site-content"
          className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5 text-sm font-semibold text-primary hover:bg-primary/10"
        >
          تنظیمات محتوای صفحات (هیرو، آمار، فوتر، FAQ، …) →
        </a>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-100 flex flex-wrap gap-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                active
                  ? 'text-primary border-primary'
                  : 'text-gray-500 border-transparent hover:text-gray-800 hover:border-gray-200'
              )}
            >
              <Icon className="h-4 w-4" />{t.label}
            </button>
          );
        })}
      </div>

      {/* Business tab */}
      {tab === 'business' && (
        <div className="card p-6 space-y-4 max-w-3xl">
          <div className="grid grid-cols-2 gap-4">
            <TextField label="نام برند" value={data.business.businessName}
              onChange={(v) => patch('business', (b) => ({ ...b, businessName: v }))} icon={<Building2 className="h-4 w-4" />} />
            <TextField label="نام مدیر" value={data.business.ownerName}
              onChange={(v) => patch('business', (b) => ({ ...b, ownerName: v }))} icon={<Building2 className="h-4 w-4" />} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <TextField label="شماره تماس" value={data.business.phone}
              onChange={(v) => patch('business', (b) => ({ ...b, phone: v }))} icon={<Phone className="h-4 w-4" />} dir="ltr" />
            <TextField label="ایمیل" value={data.business.email}
              onChange={(v) => patch('business', (b) => ({ ...b, email: v }))} icon={<Mail className="h-4 w-4" />} type="email" dir="ltr" />
          </div>
          <TextAreaField label="آدرس کارگاه" value={data.business.address}
            onChange={(v) => patch('business', (b) => ({ ...b, address: v }))} />
          <TextAreaField label="آدرس دفتر پخش" value={data.business.officeAddress}
            onChange={(v) => patch('business', (b) => ({ ...b, officeAddress: v }))} />
          <div className="grid grid-cols-3 gap-4">
            <TextField label="وب‌سایت" value={data.business.website}
              onChange={(v) => patch('business', (b) => ({ ...b, website: v }))} icon={<Globe className="h-4 w-4" />} dir="ltr" />
            <TextField label="اینستاگرام" value={data.business.instagram}
              onChange={(v) => patch('business', (b) => ({ ...b, instagram: v }))} icon={<Instagram className="h-4 w-4" />} dir="ltr" />
            <TextField label="تلگرام" value={data.business.telegram}
              onChange={(v) => patch('business', (b) => ({ ...b, telegram: v }))} icon={<MessageCircle className="h-4 w-4" />} dir="ltr" />
          </div>
          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100">
            <NumberField label="حداقل سفارش (تومان)" value={data.business.minOrderToman}
              onChange={(v) => patch('business', (b) => ({ ...b, minOrderToman: v }))} />
            <NumberField label="اعتبار پیش‌فرض نسیه (روز)" value={data.business.defaultCreditDays}
              onChange={(v) => patch('business', (b) => ({ ...b, defaultCreditDays: v }))} />
          </div>
          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100">
            <NumberField
              label="ضریب موجودی محدود"
              value={data.business.limitedStockMultiplier ?? 2}
              onChange={(v) => patch('business', (b) => ({ ...b, limitedStockMultiplier: Math.max(1, v) }))}
              help="نشان «موجودی محدود» وقتی موجودی ≤ حداقل‌سفارش × این ضریب — برای هر دو سایت"
            />
            <NumberField
              label="روزهای نشان جدید"
              value={data.business.newBadgeDays ?? 7}
              onChange={(v) => patch('business', (b) => ({ ...b, newBadgeDays: Math.max(1, v) }))}
              help="مدت نمایش خودکار نشان «جدید» پس از ایجاد محصول — برای هر دو سایت"
            />
          </div>

          <div className="pt-4 border-t border-gray-100 space-y-4">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                نماد اعتماد الکترونیکی (اینماد)
              </h3>
              <p className="mt-1 text-xs text-gray-500 leading-relaxed">
                برای هر دامنه یک اینماد جدا در{' '}
                <a
                  href="https://enamad.ir"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  enamad.ir
                </a>{' '}
                بگیرید. ساده‌ترین راه: کد HTML پنل را بچسبانید تا شناسه/Code خودکار پر شود.
                می‌توانید تصویر نشان را هم آپلود کنید. نشان در فوتر همان سایت نمایش داده می‌شود.
              </p>
            </div>
            <EnamadEditor
              title="عمده — poshaktaranom.com"
              value={data.business.enamadWholesale}
              onChange={(next) =>
                patch('business', (b) => ({ ...b, enamadWholesale: next }))
              }
            />
            <EnamadEditor
              title="تکی — www.poshaktaranom.ir"
              value={data.business.enamadRetail}
              onChange={(next) =>
                patch('business', (b) => ({ ...b, enamadRetail: next }))
              }
            />
          </div>
        </div>
      )}

      {/* Shipping tab */}
      {tab === 'shipping' && (
        <div className="card p-6 space-y-6 max-w-3xl">
          <div className="rounded-2xl border border-primary-100 bg-primary-50/60 px-4 py-4 space-y-4 text-sm text-gray-800">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-bold text-primary">جزئیات محاسبه هزینه ارسال</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  متن راهنما برای هر کانال قابل ویرایش است — فقط نمایش ادمین؛ منطق محاسبه از اعداد زیر پیروی می‌کند.
                </p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-white/80 border border-primary-100/80 p-3 space-y-2">
                <p className="text-xs font-bold text-gray-900">فروشگاه تکی (.ir)</p>
                <textarea
                  value={data.shipping.retail.detailsText}
                  onChange={(e) => patch('shipping', (s) => ({
                    ...s,
                    retail: { ...s.retail, detailsText: e.target.value },
                  }))}
                  rows={5}
                  className="input w-full text-xs leading-relaxed resize-y min-h-[6rem]"
                  dir="rtl"
                />
              </div>
              <div className="rounded-xl bg-white/80 border border-primary-100/80 p-3 space-y-2">
                <p className="text-xs font-bold text-gray-900">سایت عمده (.com)</p>
                <textarea
                  value={data.shipping.wholesale.detailsText}
                  onChange={(e) => patch('shipping', (s) => ({
                    ...s,
                    wholesale: { ...s.wholesale, detailsText: e.target.value },
                  }))}
                  rows={5}
                  className="input w-full text-xs leading-relaxed resize-y min-h-[6rem]"
                  dir="rtl"
                />
              </div>
            </div>
            {(() => {
              const base = Math.round((data.shipping.retail.baseFee ?? 0) / 10);
              const perKg = Math.round((data.shipping.retail.perKgFee ?? 0) / 10);
              const kg = Number(data.shipping.retail.kgPerPiece) > 0 ? Number(data.shipping.retail.kgPerPiece) : 0.45;
              const samplePieces = 2;
              const weightKg = Math.ceil(samplePieces * kg * 10) / 10;
              const sampleFee = base + Math.ceil(weightKg) * perKg;
              const wholesaleFee = Math.round((data.shipping.wholesale.baseFee ?? 0) / 10);
              return (
                <div className="space-y-1 text-xs text-gray-500">
                  <p>
                    نمونه تکی برای {samplePieces.toLocaleString('fa-IR')} عدد (وزن تقریبی{' '}
                    {weightKg.toLocaleString('fa-IR')} کیلو):{' '}
                    <span className="font-bold text-gray-800 tabular-nums">
                      {sampleFee.toLocaleString('fa-IR')} تومان
                    </span>
                  </p>
                  <p>
                    نمونه عمده (هزینه ثابت):{' '}
                    <span className="font-bold text-gray-800 tabular-nums">
                      {wholesaleFee.toLocaleString('fa-IR')} تومان
                    </span>
                  </p>
                </div>
              );
            })()}
          </div>

          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
            همه مبالغ به تومان وارد می‌شوند و در سرور به‌صورت ریال ذخیره می‌گردند. تنظیمات تکی و عمده جدا هستند.
          </p>

          {/* Retail fees */}
          <div className="rounded-2xl border border-gray-100 p-4 space-y-4">
            <h3 className="font-bold text-gray-800 text-sm">فروشگاه تکی (.ir) — کارمزد و آستانه</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <NumberField
                label="کارمزد پایه (تومان)"
                value={Math.round((data.shipping.retail.baseFee ?? 0) / 10)}
                onChange={(v) => patch('shipping', (s) => ({
                  ...s,
                  retail: { ...s.retail, baseFee: Math.max(0, v) * 10 },
                  baseFee: Math.max(0, v) * 10,
                }))}
                help="پایه فرمول وزن‌محور تکی"
              />
              <NumberField
                label="کارمزد هر کیلوگرم (تومان)"
                value={Math.round((data.shipping.retail.perKgFee ?? 0) / 10)}
                onChange={(v) => patch('shipping', (s) => ({
                  ...s,
                  retail: { ...s.retail, perKgFee: Math.max(0, v) * 10 },
                  perKgFee: Math.max(0, v) * 10,
                }))}
                help="در محاسبه وزن‌محور فروشگاه تکی"
              />
              <NumberField
                label="وزن تقریبی هر عدد (کیلو)"
                value={Number(data.shipping.retail.kgPerPiece) > 0 ? Number(data.shipping.retail.kgPerPiece) : 0.45}
                step="0.01"
                min={0.05}
                onChange={(v) => {
                  const kg = Math.max(0.05, Math.round(v * 100) / 100 || 0.45);
                  patch('shipping', (s) => ({
                    ...s,
                    retail: { ...s.retail, kgPerPiece: kg },
                    kgPerPiece: kg,
                  }));
                }}
                help="پیش‌فرض ۰٫۴۵ کیلو — برای مانتو با بسته‌بندی"
              />
              <NumberField
                label="آستانه ارسال رایگان (تومان)"
                value={Math.round((data.shipping.retail.freeThreshold ?? 0) / 10)}
                onChange={(v) => patch('shipping', (s) => ({
                  ...s,
                  retail: { ...s.retail, freeThreshold: Math.max(0, v) * 10 },
                  freeThreshold: Math.max(0, v) * 10,
                }))}
                help="اگر مبلغ فاکتور ≥ این مقدار → ارسال رایگان تکی"
              />
            </div>
          </div>

          {/* Wholesale fees */}
          <div className="rounded-2xl border border-gray-100 p-4 space-y-4">
            <h3 className="font-bold text-gray-800 text-sm">سایت عمده (.com) — کارمزد و آستانه</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <NumberField
                label="هزینه ثابت ارسال (تومان)"
                value={Math.round((data.shipping.wholesale.baseFee ?? 0) / 10)}
                onChange={(v) => patch('shipping', (s) => ({
                  ...s,
                  wholesale: { ...s.wholesale, baseFee: Math.max(0, v) * 10 },
                }))}
                help="هزینه ثابت ارسال عمده (بدون ضرب وزن)"
              />
              <NumberField
                label="آستانه ارسال رایگان (تومان)"
                value={Math.round((data.shipping.wholesale.freeThreshold ?? 0) / 10)}
                onChange={(v) => patch('shipping', (s) => ({
                  ...s,
                  wholesale: { ...s.wholesale, freeThreshold: Math.max(0, v) * 10 },
                }))}
                help="اگر مبلغ پس از تخفیف ≥ این مقدار → ارسال رایگان عمده"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 className="font-bold text-gray-800 text-sm">شرکت‌های حمل (قابل مدیریت)</h3>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => patch('shipping', (s) => ({
                  ...s,
                  companies: [
                    ...(s.companies ?? []),
                    { id: `SHIP_${Date.now()}`, label: 'شرکت جدید', isActive: true, sort: (s.companies?.length ?? 0) * 10 + 10 },
                  ],
                }))}
              >
                افزودن
              </button>
            </div>

            <div className="space-y-3">
              {(data.shipping.companies ?? []).map((c, idx) => (
                <div key={c.id} className="rounded-2xl border border-gray-100 p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-6 gap-3 items-end">
                    <div className="sm:col-span-3">
                      <TextField
                        label="نام شرکت"
                        value={c.label}
                        onChange={(v) => patch('shipping', (s) => ({
                          ...s,
                          companies: s.companies.map((x) => x.id === c.id ? { ...x, label: v } : x),
                        }))}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <NumberField
                        label="اولویت نمایش"
                        value={c.sort}
                        onChange={(v) => patch('shipping', (s) => ({
                          ...s,
                          companies: s.companies.map((x) => x.id === c.id ? { ...x, sort: v } : x),
                        }))}
                      />
                    </div>
                    <div className="sm:col-span-1 flex items-center justify-between gap-2">
                      <ToggleRow
                        label="فعال"
                        value={c.isActive !== false}
                        onChange={(v) => patch('shipping', (s) => ({
                          ...s,
                          companies: s.companies.map((x) => x.id === c.id ? { ...x, isActive: v } : x),
                        }))}
                      />
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm text-error"
                        onClick={() => patch('shipping', (s) => ({
                          ...s,
                          companies: s.companies.filter((x) => x.id !== c.id),
                        }))}
                      >
                        حذف
                      </button>
                    </div>
                  </div>
                  {idx === 0 && (
                    <p className="text-xs text-gray-400 mt-2">این لیست مستقیماً در checkout نمایش داده می‌شود.</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SMS tab */}
      {tab === 'sms' && (
        <div className="card p-6 space-y-6 max-w-3xl">
          <ToggleRow label="فعال‌سازی سرویس پیامک"
            hint="با غیرفعال کردن، هیچ پیامکی از سرور ارسال نمی‌شود"
            value={data.sms.enabled}
            onChange={(v) => patch('sms', (s) => ({ ...s, enabled: v }))} />

          <div className="border-t border-gray-100 pt-5">
            <h3 className="font-bold text-gray-800 mb-3 text-sm">اطلاعات پنل sms.ir</h3>
            <div className="space-y-4">
              <SecretField
                label="کلید API"
                value={data.sms.apiKey}
                shown={!!showSecret.smsApiKey}
                onToggle={() => setShowSecret((p) => ({ ...p, smsApiKey: !p.smsApiKey }))}
                onChange={(v) => patch('sms', (s) => ({ ...s, apiKey: v }))}
                help="از پنل sms.ir → توسعه‌دهنده → کلید API"
              />
              <div className="grid grid-cols-2 gap-4">
                <TextField label="شماره خط ارسال" value={data.sms.lineNumber} dir="ltr"
                  onChange={(v) => patch('sms', (s) => ({ ...s, lineNumber: v }))} help="خط اختصاصی sms.ir شما" />
                <NumberField label="شناسه قالب OTP" value={data.sms.otpTemplateId}
                  onChange={(v) => patch('sms', (s) => ({ ...s, otpTemplateId: v }))} help="برای کد ورود — اختیاری" />
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-5">
            <h3 className="font-bold text-gray-800 mb-1 text-sm">شماره اعلان ادمین</h3>
            <p className="text-xs text-gray-500 mb-3">
              برای هر سایت تا دو شماره — نفر دوم اختیاری است. پیامک ثبت سفارش / ثبت‌نام به هر دو ارسال می‌شود.
            </p>
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium text-gray-600 mb-2">عمده (.com)</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <TextField
                    label="شماره ۱"
                    value={data.sms.adminPhoneWholesale}
                    dir="ltr"
                    onChange={(v) => patch('sms', (s) => ({ ...s, adminPhoneWholesale: v }))}
                    help="مثال: 09121234567"
                  />
                  <TextField
                    label="شماره ۲ (اختیاری)"
                    value={data.sms.adminPhoneWholesale2}
                    dir="ltr"
                    onChange={(v) => patch('sms', (s) => ({ ...s, adminPhoneWholesale2: v }))}
                    help="خالی بگذارید اگر فقط یک نفر کافی است"
                  />
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-600 mb-2">تک‌فروشی (.ir)</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <TextField
                    label="شماره ۱"
                    value={data.sms.adminPhoneRetail}
                    dir="ltr"
                    onChange={(v) => patch('sms', (s) => ({ ...s, adminPhoneRetail: v }))}
                    help="مثال: 09121234567"
                  />
                  <TextField
                    label="شماره ۲ (اختیاری)"
                    value={data.sms.adminPhoneRetail2}
                    dir="ltr"
                    onChange={(v) => patch('sms', (s) => ({ ...s, adminPhoneRetail2: v }))}
                    help="خالی بگذارید اگر فقط یک نفر کافی است"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-5">
            <h3 className="font-bold text-gray-800 mb-3 text-sm">رویدادهای پیامک به ادمین</h3>
            <div className="space-y-2">
              {Object.keys(SMS_ADMIN_EVENTS).map((ev) => (
                <ToggleRow
                  key={ev}
                  label={SMS_ADMIN_EVENTS[ev]}
                  value={data.sms.events[ev] !== false}
                  onChange={(v) => patch('sms', (s) => ({ ...s, events: { ...s.events, [ev]: v } }))}
                />
              ))}
            </div>
          </div>

          <div className="border-t border-gray-100 pt-5">
            <h3 className="font-bold text-gray-800 mb-3 text-sm">رویدادهای پیامک به مشتری</h3>
            <div className="space-y-2">
              {Object.keys(SMS_CUSTOMER_EVENTS).map((ev) => (
                <ToggleRow
                  key={ev}
                  label={SMS_CUSTOMER_EVENTS[ev]}
                  value={data.sms.events[ev] !== false}
                  onChange={(v) => patch('sms', (s) => ({ ...s, events: { ...s.events, [ev]: v } }))}
                />
              ))}
            </div>
          </div>

          <div className="border-t border-gray-100 pt-5">
            <h3 className="font-bold text-gray-800 mb-1 text-sm">متن پیامک‌ها</h3>
            <p className="text-xs text-gray-500 mb-4">
              متن هر رویداد قابل ویرایش است. مقادیر داخل {'{ }'} خودکار جایگزین می‌شوند.
              خالی گذاشتن یعنی همان متن پیش‌فرض فعلی.
            </p>
            <div className="space-y-4">
              {SMS_TEMPLATE_META.map((meta) => (
                <div key={meta.key} className="rounded-xl border border-gray-100 p-4 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-bold text-gray-800">{meta.label}</p>
                    <button
                      type="button"
                      className="text-xs text-primary font-medium hover:underline"
                      onClick={() => patch('sms', (s) => ({
                        ...s,
                        templates: {
                          ...s.templates,
                          [meta.key]: SMS_TEMPLATE_DEFAULTS[meta.key],
                        },
                      }))}
                    >
                      بازگردانی پیش‌فرض
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-400 font-mono dir-ltr text-left" dir="ltr">
                    {meta.placeholders}
                  </p>
                  <textarea
                    value={data.sms.templates?.[meta.key] ?? SMS_TEMPLATE_DEFAULTS[meta.key] ?? ''}
                    onChange={(e) => patch('sms', (s) => ({
                      ...s,
                      templates: { ...s.templates, [meta.key]: e.target.value },
                    }))}
                    rows={4}
                    className="input w-full text-sm leading-relaxed resize-y min-h-[5.5rem]"
                    dir="rtl"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Payment tab */}
      {tab === 'payment' && (
        <div className="card p-6 space-y-6 max-w-3xl">
          <ToggleRow label="فعال‌سازی پرداخت آنلاین (کلی)"
            hint="کلید اصلی؛ اگر خاموش باشد هیچ درگاهی کار نمی‌کند"
            value={data.payment.enabled}
            onChange={(v) => patch('payment', (p) => ({ ...p, enabled: v }))} />

          <div className="border-t border-gray-100 pt-5">
            <h3 className="font-bold text-gray-800 mb-1 text-sm">زرین‌پال عمده (.com)</h3>
            <p className="text-xs text-gray-500 mb-3">برای پورتال عمده‌فروشان — poshaktaranom.com</p>
            <div className="space-y-4">
              <ToggleRow
                label="فعال‌سازی درگاه عمده"
                hint="پرداخت آنلاین چک‌اوت عمده‌فروشی"
                value={data.payment.wholesaleEnabled !== false}
                onChange={(v) => patch('payment', (p) => ({ ...p, wholesaleEnabled: v }))}
              />
              <SecretField
                label="مرچنت کد عمده (Merchant ID / Token)"
                value={data.payment.merchantId}
                shown={!!showSecret.merchantId}
                onToggle={() => setShowSecret((p) => ({ ...p, merchantId: !p.merchantId }))}
                onChange={(v) => patch('payment', (p) => ({ ...p, merchantId: v }))}
                help="از پنل zarinpal.com → درگاه‌های پرداخت → مرچنت عمده"
              />
              <ToggleRow
                label="Sandbox عمده"
                hint="حالت آزمایشی برای درگاه عمده"
                value={data.payment.sandbox}
                onChange={(v) => patch('payment', (p) => ({ ...p, sandbox: v }))}
              />
              <TextField
                label="آدرس بازگشت (Callback) عمده"
                value={data.payment.callbackUrl ?? ''}
                dir="ltr"
                placeholder="https://poshaktaranom.com/payment/callback"
                onChange={(v) => patch('payment', (p) => ({ ...p, callbackUrl: v }))}
              />
            </div>
          </div>

          <div className="border-t border-emerald-100 pt-5">
            <h3 className="font-bold text-emerald-900 mb-1 text-sm">زرین‌پال فروشگاه تکی (.ir)</h3>
            <p className="text-xs text-gray-500 mb-3">
              مرچنت جدا برای دامنه www.poshaktaranom.ir — در پنل زرین‌پال درگاه را برای دامنه تکی فعال کنید
            </p>
            <div className="space-y-4">
              <ToggleRow
                label="فعال‌سازی درگاه تکی"
                hint="پرداخت آنلاین چک‌اوت فروشگاه تکی"
                value={data.payment.retailEnabled !== false}
                onChange={(v) => patch('payment', (p) => ({ ...p, retailEnabled: v }))}
              />
              <SecretField
                label="مرچنت کد / توکن تکی (Retail Merchant ID)"
                value={data.payment.retailMerchantId ?? ''}
                shown={!!showSecret.retailMerchantId}
                onToggle={() => setShowSecret((p) => ({ ...p, retailMerchantId: !p.retailMerchantId }))}
                onChange={(v) => patch('payment', (p) => ({ ...p, retailMerchantId: v }))}
                help="UUID مرچنت زرین‌پال مخصوص فروشگاه تکی"
              />
              <ToggleRow
                label="Sandbox تکی"
                hint="تست بدون کسر واقعی برای فروشگاه تکی"
                value={!!data.payment.retailSandbox}
                onChange={(v) => patch('payment', (p) => ({ ...p, retailSandbox: v }))}
              />
              <TextField
                label="آدرس بازگشت (Callback) تکی"
                value={data.payment.retailCallbackUrl ?? ''}
                dir="ltr"
                placeholder="https://www.poshaktaranom.ir/payment/callback"
                onChange={(v) => patch('payment', (p) => ({ ...p, retailCallbackUrl: v }))}
              />
            </div>
          </div>

          <div className="border-t border-gray-100 pt-5">
            <h3 className="font-bold text-gray-800 mb-3 text-sm">پرداخت کارت به کارت (دستی)</h3>
            <p className="text-xs text-gray-500 mb-3">این اطلاعات به مشتری برای واریز مستقیم نمایش داده می‌شود</p>
            <div className="grid grid-cols-2 gap-4">
              <TextField label="شماره کارت" value={data.payment.manualCardNumber} dir="ltr"
                placeholder="6037-XXXX-XXXX-XXXX"
                onChange={(v) => patch('payment', (p) => ({ ...p, manualCardNumber: v }))} />
              <TextField label="صاحب کارت" value={data.payment.manualCardOwner}
                placeholder="حامد رشید"
                onChange={(v) => patch('payment', (p) => ({ ...p, manualCardOwner: v }))} />
            </div>
          </div>
        </div>
      )}

      {/* Installments tab */}
      {tab === 'installments' && (
        <div className="card p-6 space-y-6 max-w-3xl">
          <div>
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 className="font-bold text-gray-800 text-sm">قوانین پرداخت اقساطی</h3>
              <button
                type="button"
                className="btn btn-outline btn-sm flex items-center gap-1.5"
                onClick={() => patch('installments', (x) => ({
                  ...x,
                  rules: [
                    ...(x.rules ?? []),
                    {
                      id: `rule_${Date.now()}`,
                      minDownPaymentPercent: 30,
                      maxMonths: 6,
                      categoryId: null,
                    },
                  ],
                }))}
              >
                <Plus className="h-3.5 w-3.5" />
                افزودن قانون
              </button>
            </div>
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 mb-4">
              اقساط فقط برای مشتریان با حداقل ۲ فاکتور فعال
            </p>
            <p className="text-xs text-gray-500 mb-4">
              هر قانون می‌تواند برای همه دسته‌ها یا یک دسته خاص اعمال شود. هنگام ثبت سفارش اقساطی اعتبارسنجی می‌شود.
            </p>

            <div className="space-y-3">
              {(data.installments.rules ?? []).map((rule) => (
                <div key={rule.id} className="rounded-2xl border border-gray-100 p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                    <NumberField
                      label="حداقل پیش‌پرداخت (%)"
                      value={rule.minDownPaymentPercent}
                      onChange={(v) => patch('installments', (x) => ({
                        ...x,
                        rules: x.rules.map((r) => r.id === rule.id ? { ...r, minDownPaymentPercent: v } : r),
                      }))}
                    />
                    <NumberField
                      label="حداکثر اقساط (ماه)"
                      value={rule.maxMonths}
                      onChange={(v) => patch('installments', (x) => ({
                        ...x,
                        rules: x.rules.map((r) => r.id === rule.id ? { ...r, maxMonths: Math.max(1, v) } : r),
                      }))}
                    />
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">دسته‌بندی</label>
                      <select
                        value={rule.categoryId ?? ''}
                        onChange={(e) => patch('installments', (x) => ({
                          ...x,
                          rules: x.rules.map((r) => r.id === rule.id
                            ? { ...r, categoryId: e.target.value || null }
                            : r),
                        }))}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      >
                        <option value="">همه</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm text-error flex items-center gap-1"
                        disabled={(data.installments.rules?.length ?? 0) <= 1}
                        onClick={() => patch('installments', (x) => ({
                          ...x,
                          rules: x.rules.filter((r) => r.id !== rule.id),
                        }))}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        حذف
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Theme tab — Taranom Theme Settings */}
      {tab === 'marketing' && data.marketing && (
        <div className="card space-y-6 p-6 max-w-4xl">
          <p className="text-sm text-gray-500">
            پیکسل‌ها و فیدهای مارکت‌پلیس برای فروشگاه تکی. پارامترهای کلیک مثل{' '}
            <code dir="ltr">?aff=</code> / <code dir="ltr">?affer=</code> / <code dir="ltr">?yn=</code> روی سفارش ذخیره می‌شوند.
            پست‌بک سرور پس از پرداخت موفق اجرا می‌شود. پلیس‌هولدرها:{' '}
            <code dir="ltr">{'{click_id} {order_id} {order_number} {amount} {amount_toman} {status}'}</code>
          </p>

          <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 text-sm text-emerald-900 space-y-3">
            <p className="font-bold">ترب — دو آدرس جدا (اشتباه نگیرید)</p>
            <div className="space-y-2 text-xs leading-relaxed">
              <p>
                <span className="font-bold">۱) فید محصولات (XML)</span> — برای ثبت کاتالوگ در پنل ترب، نه صفحه همگام‌سازی سفارش:
              </p>
              <p className="font-mono break-all" dir="ltr">
                https://www.poshaktaranom.ir/api/v1/feeds/torob.xml
              </p>
              <p>
                <span className="font-bold">۲) API همگام‌سازی سفارش (JSON)</span> — همان فیلد «آدرس API» در صفحه
                تنظیمات همگام‌سازی سفارش‌ها:
              </p>
              <p className="font-mono break-all" dir="ltr">
                https://www.poshaktaranom.ir/api/torob/v1/orders
              </p>
              <p className="text-emerald-800/80">
                مسیر باید دقیقاً به <code dir="ltr">/torob/v1/orders</code> ختم شود و پاسخ JSON باشد. فید XML آنجا خطا می‌دهد.
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={!!data.marketing.torobOrderSyncEnabled}
                onChange={(e) =>
                  patch('marketing', (m) => ({ ...m, torobOrderSyncEnabled: e.target.checked }))
                }
                className="rounded border-emerald-300"
              />
              فعال‌سازی همگام‌سازی سفارش ترب (بدون این، API به ترب کد ۴۰۳ می‌دهد)
            </label>
            <ul className="list-disc pr-5 space-y-1 font-mono text-[11px]" dir="ltr">
              <li>Bam CSV → /v1/feeds/bam.csv</li>
              <li>Bam XML → /v1/feeds/bam.xml</li>
              <li>فهرست فیدها → /v1/feeds</li>
            </ul>
          </div>

          <div className="rounded-xl border border-sky-100 bg-sky-50/70 p-4 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-sky-950">Google Analytics 4 + Search Console</h3>
              <p className="mt-1 text-xs text-sky-900/80 leading-relaxed">
                برای هر دامنه یک Property جدا در GA4 و یک Property جدا در Search Console بسازید.
                راهنمای کامل: <code className="font-mono">docs/GOOGLE-SETUP.md</code>
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {([
                ['ga4WholesaleId', 'GA4 عمده (G-…)', 'poshaktaranom.com'],
                ['ga4RetailId', 'GA4 تکی (G-…)', 'www.poshaktaranom.ir'],
                ['gtmWholesaleId', 'GTM عمده اختیاری (GTM-…)', ''],
                ['gtmRetailId', 'GTM تکی اختیاری (GTM-…)', ''],
                ['gscWholesaleVerification', 'کد تأیید GSC عمده', 'محتوای meta google-site-verification'],
                ['gscRetailVerification', 'کد تأیید GSC تکی', 'محتوای meta google-site-verification'],
              ] as const).map(([key, label, hint]) => (
                <div key={key}>
                  <label className="mb-1 block text-xs font-medium text-sky-950">
                    {label}
                    {hint ? <span className="text-sky-800/60"> — {hint}</span> : null}
                  </label>
                  <input
                    className="w-full rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm font-mono"
                    value={(data.marketing as any)[key] ?? ''}
                    onChange={(e) => patch('marketing', (m) => ({ ...m, [key]: e.target.value.trim() }))}
                    dir="ltr"
                    placeholder={key.startsWith('ga4') ? 'G-XXXXXXXX' : key.startsWith('gtm') ? 'GTM-XXXXXXX' : 'verification-token'}
                  />
                </div>
              ))}
            </div>
            <ul className="list-disc pr-5 text-[11px] text-sky-900/80 space-y-1" dir="ltr">
              <li>Sitemap عمده → https://poshaktaranom.com/sitemap.xml</li>
              <li>Sitemap تکی → https://www.poshaktaranom.ir/sitemap.xml</li>
              <li>robots.txt هر دامنه به‌صورت خودکار به sitemap همان دامنه اشاره می‌کند</li>
            </ul>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">نام برند در فید</label>
            <input
              className="w-full max-w-md rounded-lg border px-3 py-2 text-sm"
              value={data.marketing.feedBrandName}
              onChange={(e) => patch('marketing', (m) => ({ ...m, feedBrandName: e.target.value }))}
            />
          </div>

          <h3 className="text-sm font-bold text-gray-800">پیکسل / اسکریپت هد</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {([
              ['yektanetPixelId', 'Yektanet Pixel ID', 'yektanet.com/advertisers'],
              ['metaPixelId', 'Meta Pixel ID', ''],
              ['adroScriptUrl', 'Adro Script URL (از پنل)', 'adro.co/advertisers'],
              ['adroAccountId', 'Adro Account ID', ''],
              ['afferScriptUrl', 'Affer Pixel/Script URL', 'affer.com/advertiser'],
              ['afsonaScriptUrl', 'Afsona Pixel/Script URL', 'afsona.com'],
              ['takhfifanScriptUrl', 'Takhfifan Tracking Script URL', 'business.takhfifan.com'],
            ] as const).map(([key, label, hint]) => (
              <div key={key}>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  {label}{hint ? <span className="text-gray-400"> — {hint}</span> : null}
                </label>
                <input
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  value={(data.marketing as any)[key] ?? ''}
                  onChange={(e) => patch('marketing', (m) => ({ ...m, [key]: e.target.value }))}
                  dir="ltr"
                />
              </div>
            ))}
          </div>

          <h3 className="text-sm font-bold text-gray-800">پست‌بک S2S (همکاری در فروش)</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {([
              ['yektanetPostbackUrl', 'Yektanet Postback URL'],
              ['afferPostbackUrl', 'Affer Postback URL'],
              ['afsonaPostbackUrl', 'Afsona Callback URL'],
              ['takhfifanPostbackUrl', 'Takhfifan Postback URL'],
              ['postbackUrl', 'Generic Postback URL'],
            ] as const).map(([key, label]) => (
              <div key={key} className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
                <input
                  className="w-full rounded-lg border px-3 py-2 text-sm font-mono"
                  value={(data.marketing as any)[key] ?? ''}
                  onChange={(e) => patch('marketing', (m) => ({ ...m, [key]: e.target.value }))}
                  dir="ltr"
                  placeholder="https://example.com/postback?click={click_id}&order={order_number}&amount={amount_toman}"
                />
              </div>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={!!data.marketing.broadcastPostbacks}
              onChange={(e) => patch('marketing', (m) => ({ ...m, broadcastPostbacks: e.target.checked }))}
            />
            ارسال پست‌بک حتی بدون click id (معمولاً خاموش بماند)
          </label>

          <h3 className="text-sm font-bold text-gray-800">باسلام (API)</h3>
          <p className="text-xs text-gray-500">
            مستندات: <a className="text-primary underline" href="https://doc.basalam.com" target="_blank" rel="noreferrer">doc.basalam.com</a>
            {' · '}
            <a className="text-primary underline" href="https://developers.basalam.com" target="_blank" rel="noreferrer">developers.basalam.com</a>
            — پس از ذخیره، از API ادمین <code dir="ltr">POST /v1/basalam/sync-inventory</code> استفاده کنید.
          </p>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={!!data.marketing.basalamEnabled}
              onChange={(e) => patch('marketing', (m) => ({ ...m, basalamEnabled: e.target.checked }))}
            />
            فعال‌سازی همگام‌سازی باسلام
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Basalam Vendor ID</label>
              <input
                className="w-full rounded-lg border px-3 py-2 text-sm"
                value={data.marketing.basalamVendorId}
                onChange={(e) => patch('marketing', (m) => ({ ...m, basalamVendorId: e.target.value }))}
                dir="ltr"
              />
            </div>
            <div>
              <label className="mb-1 flex items-center justify-between text-xs font-medium text-gray-600">
                Access Token
                <button
                  type="button"
                  className="text-gray-400"
                  onClick={() => setShowSecret((s) => ({ ...s, basalam: !s.basalam }))}
                >
                  {showSecret.basalam ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </label>
              <input
                type={showSecret.basalam ? 'text' : 'password'}
                className="w-full rounded-lg border px-3 py-2 text-sm font-mono"
                value={data.marketing.basalamAccessToken}
                onChange={(e) => patch('marketing', (m) => ({ ...m, basalamAccessToken: e.target.value }))}
                dir="ltr"
              />
            </div>
          </div>
        </div>
      )}

      {/* Theme tab — Taranom Theme Settings */}
      {tab === 'theme' && (
        <div className="card p-6 space-y-6 max-w-3xl">
          <p className="text-sm text-primary-dark bg-primary-50 border border-primary-100 rounded-xl px-4 py-3">
            تنظیمات ظاهر سایت عمومی (Soft UI + شیشه‌ای). رنگ‌های پیش‌فرض برند سبز و طلایی هستند.
          </p>

          <div>
            <h3 className="font-bold text-gray-800 text-sm mb-3">رنگ‌ها</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">رنگ اصلی (Primary)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={data.theme.primaryColor}
                    onChange={(e) => patch('theme', (t) => ({ ...t, primaryColor: e.target.value }))}
                    className="h-10 w-14 cursor-pointer rounded border border-gray-200"
                  />
                  <input
                    type="text"
                    dir="ltr"
                    value={data.theme.primaryColor}
                    onChange={(e) => patch('theme', (t) => ({ ...t, primaryColor: e.target.value }))}
                    className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">رنگ ثانویه (Secondary)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={data.theme.secondaryColor}
                    onChange={(e) => patch('theme', (t) => ({ ...t, secondaryColor: e.target.value }))}
                    className="h-10 w-14 cursor-pointer rounded border border-gray-200"
                  />
                  <input
                    type="text"
                    dir="ltr"
                    value={data.theme.secondaryColor}
                    onChange={(e) => patch('theme', (t) => ({ ...t, secondaryColor: e.target.value }))}
                    className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-bold text-gray-800 text-sm mb-3">حالت نمایش پس‌زمینه</h3>
            <div className="flex flex-wrap gap-2">
              {([
                { id: 'light', label: 'روشن' },
                { id: 'dark', label: 'تیره' },
                { id: 'customImage', label: 'تصویر سفارشی' },
              ] as const).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => patch('theme', (t) => ({ ...t, displayMode: m.id }))}
                  className={cn(
                    'rounded-lg border px-4 py-2 text-sm font-medium cursor-pointer transition-colors',
                    data.theme.displayMode === m.id
                      ? 'border-primary bg-primary text-white'
                      : 'border-gray-200 text-gray-700 hover:border-primary/40',
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {data.theme.displayMode === 'customImage' && (
              <div className="mt-3">
                <TextField
                  label="آدرس تصویر پس‌زمینه"
                  value={data.theme.backgroundImageUrl}
                  onChange={(v) => patch('theme', (t) => ({ ...t, backgroundImageUrl: v }))}
                  dir="ltr"
                  placeholder="https://…"
                  help="URL کامل تصویر کارگاه یا پارچه لینن"
                />
              </div>
            )}
          </div>

          <div>
            <h3 className="font-bold text-gray-800 text-sm mb-3">شدت بلور شیشه‌ای</h3>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={0}
                max={28}
                step={1}
                value={data.theme.glassBlurPx}
                onChange={(e) => patch('theme', (t) => ({ ...t, glassBlurPx: Number(e.target.value) }))}
                className="flex-1 accent-primary cursor-pointer"
              />
              <span className="text-sm font-mono text-gray-700 w-14 text-left" dir="ltr">
                {data.theme.glassBlurPx}px
              </span>
            </div>
            <p className="text-[11px] text-gray-400 mt-1">پیشنهاد: ۱۲px — مقدارهای خیلی بالا روی موبایل سنگین‌ترند</p>
          </div>

          <div className="border-t border-gray-100 pt-4 space-y-4">
            <h3 className="font-bold text-gray-800 text-sm">پاپ‌آپ‌های لندینگ</h3>

            {(['boutique', 'newsletter'] as const).map((key) => {
              const popup = data.theme.popups[key];
              const label = key === 'boutique' ? 'پاپ‌آپ بوتیک‌دار' : 'پاپ‌آپ خبرنامه';
              return (
                <div key={key} className="rounded-2xl border border-gray-100 p-4 space-y-3">
                  <ToggleRow
                    label={label}
                    hint="پس از بستن توسط کاربر، تا پاک‌شدن localStorage دوباره نشان داده نمی‌شود"
                    value={popup.enabled}
                    onChange={(v) => patch('theme', (t) => ({
                      ...t,
                      popups: { ...t.popups, [key]: { ...t.popups[key], enabled: v } },
                    }))}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">زمان نمایش</label>
                      <select
                        value={popup.trigger}
                        onChange={(e) => patch('theme', (t) => ({
                          ...t,
                          popups: {
                            ...t.popups,
                            [key]: { ...t.popups[key], trigger: e.target.value as 'delay' | 'exit' },
                          },
                        }))}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      >
                        <option value="delay">بعد از چند ثانیه</option>
                        <option value="exit">قصد خروج (exit-intent)</option>
                      </select>
                    </div>
                    <NumberField
                      label="تأخیر (ثانیه)"
                      value={popup.delaySeconds}
                      onChange={(v) => patch('theme', (t) => ({
                        ...t,
                        popups: { ...t.popups, [key]: { ...t.popups[key], delaySeconds: Math.max(1, v) } },
                      }))}
                    />
                  </div>
                  <TextField
                    label="عنوان"
                    value={popup.title}
                    onChange={(v) => patch('theme', (t) => ({
                      ...t,
                      popups: { ...t.popups, [key]: { ...t.popups[key], title: v } },
                    }))}
                  />
                  <TextAreaField
                    label="متن"
                    value={popup.body}
                    onChange={(v) => patch('theme', (t) => ({
                      ...t,
                      popups: { ...t.popups, [key]: { ...t.popups[key], body: v } },
                    }))}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <TextField
                      label="متن دکمه"
                      value={popup.ctaLabel}
                      onChange={(v) => patch('theme', (t) => ({
                        ...t,
                        popups: { ...t.popups, [key]: { ...t.popups[key], ctaLabel: v } },
                      }))}
                    />
                    <TextField
                      label="لینک دکمه"
                      value={popup.ctaUrl}
                      onChange={(v) => patch('theme', (t) => ({
                        ...t,
                        popups: { ...t.popups, [key]: { ...t.popups[key], ctaUrl: v } },
                      }))}
                      dir="ltr"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Save bar */}
      <div className="sticky bottom-0 py-3 bg-white/95 backdrop-blur border-t border-gray-100 flex items-center gap-4">
        <button onClick={save} disabled={saving}
          className="btn btn-primary btn-md flex items-center gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          ذخیره تغییرات
        </button>
        {saved === tab && (
          <p className="text-sm text-success font-medium flex items-center gap-1.5">
            <CheckCircle className="h-4 w-4" />تنظیمات ذخیره شد
          </p>
        )}
      </div>
    </div>
  );
}

// ── Reusable field components ─────────────────────────────────

function EnamadEditor({
  title,
  value,
  onChange,
}: {
  title: string;
  value: EnamadSealConfig;
  onChange: (v: EnamadSealConfig) => void;
}) {
  const { upload, uploading } = useImageUpload();
  const preview = resolveMediaUrl(value.imageUrl) || (value.id && value.code ? enamadLogoUrl(value.id, value.code) : '');

  const set = (patch: Partial<EnamadSealConfig>) => onChange({ ...value, ...patch });

  return (
    <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold text-emerald-950">{title}</p>
        <label className="flex items-center gap-2 text-xs font-medium text-emerald-900 cursor-pointer">
          <input
            type="checkbox"
            checked={value.enabled}
            onChange={(e) => set({ enabled: e.target.checked })}
            className="rounded border-emerald-300"
          />
          نمایش در فوتر
        </label>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">
          کد HTML از پنل اینماد (پیشنهادی)
        </label>
        <textarea
          value={value.htmlSnippet}
          onChange={(e) => onChange(applyEnamadHtmlPaste(value, e.target.value))}
          rows={4}
          dir="ltr"
          placeholder={"<a referrerpolicy='origin' target='_blank' href='https://trustseal.enamad.ir/?id=…&Code=…'><img referrerpolicy='origin' src='https://trustseal.enamad.ir/logo.aspx?id=…&Code=…' …></a>"}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y"
        />
        <p className="mt-1 text-[11px] text-gray-500">
          با چسباندن کد، شناسه و Code به‌صورت خودکار پر می‌شوند و نمایش فوتر روشن می‌شود.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          label="شناسه اینماد (id)"
          value={value.id}
          onChange={(v) => set({ id: v.trim(), enabled: v.trim() || value.code ? true : value.enabled })}
          dir="ltr"
          placeholder="مثلاً 123456"
          help="از لینک trustseal.enamad.ir/?id=…"
        />
        <TextField
          label="کد اینماد (Code)"
          value={value.code}
          onChange={(v) => set({ code: v.trim(), enabled: value.id || v.trim() ? true : value.enabled })}
          dir="ltr"
          placeholder="مثلاً AbCdEf"
          help="پارامتر Code در لینک تأیید اینماد"
        />
      </div>

      <TextField
        label="لینک تأیید (اختیاری)"
        value={value.linkUrl}
        onChange={(v) => set({ linkUrl: v.trim() })}
        dir="ltr"
        placeholder="https://trustseal.enamad.ir/?id=…&Code=…"
        help="اگر خالی باشد از id و Code ساخته می‌شود"
      />

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">تصویر نشان (آپلود اختیاری)</label>
        <div className="flex flex-wrap items-center gap-3">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt="پیش‌نمایش اینماد"
              className="h-16 w-16 rounded-lg border border-emerald-200 bg-white object-contain p-1"
              referrerPolicy="origin"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-emerald-200 bg-white text-[10px] text-gray-400">
              بدون تصویر
            </div>
          )}
          <div className="flex flex-col gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-medium text-emerald-900 hover:bg-emerald-50">
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {uploading ? 'در حال آپلود…' : 'آپلود تصویر نشان'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploading}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (!file) return;
                  const url = await upload(file);
                  if (url) set({ imageUrl: url, enabled: true });
                }}
              />
            </label>
            {value.imageUrl ? (
              <button
                type="button"
                className="text-[11px] text-red-600 hover:underline text-right"
                onClick={() => set({ imageUrl: '' })}
              >
                حذف تصویر آپلودشده / سفارشی
              </button>
            ) : (
              <p className="text-[11px] text-gray-400">اگر خالی باشد، لوگوی رسمی اینماد استفاده می‌شود</p>
            )}
          </div>
        </div>
        <input
          className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-xs font-mono"
          dir="ltr"
          placeholder="/media/... یا URL تصویر"
          value={value.imageUrl}
          onChange={(e) => set({ imageUrl: e.target.value.trim() })}
        />
      </div>

      <div className="rounded-lg border border-emerald-200/80 bg-white p-3">
        <p className="mb-2 text-[11px] font-medium text-gray-500">پیش‌نمایش فوتر</p>
        {value.enabled ? (
          <EnamadSeal config={value} size={72} />
        ) : (
          <p className="text-xs text-gray-400">برای دیدن نشان، «نمایش در فوتر» را روشن کنید.</p>
        )}
      </div>
    </div>
  );
}

function TextField({ label, value, onChange, icon, type = 'text', placeholder, dir = 'rtl', help }: {
  label: string; value: string; onChange: (v: string) => void;
  icon?: React.ReactNode; type?: string; placeholder?: string; dir?: 'rtl' | 'ltr'; help?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <div className="relative">
        {icon && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">{icon}</span>}
        <input type={type} value={value ?? ''} onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder} dir={dir}
          className={cn(
            'w-full rounded-lg border border-gray-200 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30',
            icon ? 'px-3 pr-9' : 'px-3',
          )} />
      </div>
      {help && <p className="text-[11px] text-gray-400 mt-1">{help}</p>}
    </div>
  );
}

function NumberField({ label, value, onChange, help, step, min }: {
  label: string; value: number; onChange: (v: number) => void; help?: string;
  step?: string | number; min?: number;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input
        type="number"
        step={step}
        min={min}
        value={value ?? 0}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
      {help && <p className="text-[11px] text-gray-400 mt-1">{help}</p>}
    </div>
  );
}

function TextAreaField({ label, value, onChange }: {
  label: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <textarea value={value ?? ''} onChange={(e) => onChange(e.target.value)} rows={2}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
    </div>
  );
}

function SecretField({ label, value, onChange, shown, onToggle, help }: {
  label: string; value: string; onChange: (v: string) => void;
  shown: boolean; onToggle: () => void; help?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <div className="relative">
        <input type={shown ? 'text' : 'password'} value={value ?? ''}
          onChange={(e) => onChange(e.target.value)} dir="ltr"
          placeholder="•••••••••••••"
          className="w-full rounded-lg border border-gray-200 px-3 py-2 pr-10 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30" />
        <button type="button" onClick={onToggle}
          className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 p-1">
          {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {help && <p className="text-[11px] text-gray-400 mt-1">{help}</p>}
    </div>
  );
}

function ToggleRow({ label, hint, value, onChange }: {
  label: string; hint?: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
      <div>
        <p className="text-sm font-medium text-gray-800">{label}</p>
        {hint && <p className="text-[11px] text-gray-400 mt-0.5">{hint}</p>}
      </div>
      <button type="button" onClick={() => onChange(!value)}
        className={cn(
          'relative h-6 w-11 rounded-full transition-colors flex-shrink-0',
          value ? 'bg-primary' : 'bg-gray-200',
        )}>
        <span className={cn(
          'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
          value ? 'right-0.5' : 'right-[calc(100%-1.375rem)]',
        )} />
      </button>
    </label>
  );
}
