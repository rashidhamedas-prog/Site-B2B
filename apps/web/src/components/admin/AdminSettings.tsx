'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Save, Building2, Phone, Mail, Globe, Instagram, MessageCircle,
  Truck, MessageSquare, CreditCard, CheckCircle, AlertCircle, Loader2,
  Eye, EyeOff, Plus, Trash2, Palette,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/cn';
import { DEFAULT_THEME, type ThemeSettings } from '@/components/wholesale/ThemeApply';

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
  };
  shipping: {
    baseFee: number; perKgFee: number; freeThreshold: number;
    companies: Array<{ id: string; label: string; isActive: boolean; sort: number }>;
    methods: Record<string, boolean>;
  };
  sms: {
    enabled: boolean; apiKey: string; lineNumber: string; otpTemplateId: number;
    events: Record<string, boolean>;
  };
  payment: {
    enabled: boolean; merchantId: string; sandbox: boolean;
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
  marketing: { yektanetPixelId: string; metaPixelId: string };
}

type TabId = 'business' | 'shipping' | 'sms' | 'payment' | 'installments' | 'theme' | 'marketing';

const TABS: { id: TabId; label: string; icon: any }[] = [
  { id: 'business', label: 'کسب‌وکار', icon: Building2 },
  { id: 'shipping', label: 'روش‌های ارسال', icon: Truck },
  { id: 'sms',      label: 'پیامک (sms.ir)', icon: MessageSquare },
  { id: 'payment',  label: 'درگاه پرداخت', icon: CreditCard },
  { id: 'installments', label: 'قوانین اقساط', icon: CreditCard },
  { id: 'marketing', label: 'پیکسل / افیلیت', icon: Globe },
  { id: 'theme', label: 'تنظیمات تم ترنم', icon: Palette },
];

const SMS_EVENT_LABELS: Record<string, string> = {
  orderRegistered: 'پیامک ثبت سفارش جدید',
  orderConfirmed:  'پیامک تأیید سفارش',
  orderShipped:    'پیامک ارسال مرسوله',
  paymentReceived: 'پیامک دریافت پرداخت',
};

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
          yektanetPixelId: res.marketing?.yektanetPixelId ?? '',
          metaPixelId: res.marketing?.metaPixelId ?? '',
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
        </div>
      )}

      {/* Shipping tab */}
      {tab === 'shipping' && (
        <div className="card p-6 space-y-6 max-w-3xl">
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
            هزینه‌های ارسال در هر فاکتور/سفارش تعیین می‌شود؛ اینجا فقط شرکت‌های حمل را مدیریت کنید.
          </p>

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
            <h3 className="font-bold text-gray-800 mb-3 text-sm">رویدادهای پیامک خودکار</h3>
            <div className="space-y-2">
              {Object.keys(SMS_EVENT_LABELS).map((ev) => (
                <ToggleRow
                  key={ev}
                  label={SMS_EVENT_LABELS[ev]}
                  value={data.sms.events[ev] !== false}
                  onChange={(v) => patch('sms', (s) => ({ ...s, events: { ...s.events, [ev]: v } }))}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Payment tab */}
      {tab === 'payment' && (
        <div className="card p-6 space-y-6 max-w-3xl">
          <ToggleRow label="فعال‌سازی پرداخت آنلاین"
            hint="با غیرفعال کردن، دکمه پرداخت آنلاین در پنل مشتریان مخفی می‌شود"
            value={data.payment.enabled}
            onChange={(v) => patch('payment', (p) => ({ ...p, enabled: v }))} />

          <div className="border-t border-gray-100 pt-5">
            <h3 className="font-bold text-gray-800 mb-3 text-sm">درگاه زرین‌پال</h3>
            <div className="space-y-4">
              <SecretField
                label="مرچنت کد (Merchant ID)"
                value={data.payment.merchantId}
                shown={!!showSecret.merchantId}
                onToggle={() => setShowSecret((p) => ({ ...p, merchantId: !p.merchantId }))}
                onChange={(v) => patch('payment', (p) => ({ ...p, merchantId: v }))}
                help="از پنل zarinpal.com → درگاه‌های پرداخت"
              />
              <ToggleRow
                label="حالت آزمایشی (Sandbox)"
                hint="در حالت آزمایشی مبلغ واقعی کسر نمی‌شود — برای تست"
                value={data.payment.sandbox}
                onChange={(v) => patch('payment', (p) => ({ ...p, sandbox: v }))}
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
        <div className="card space-y-4 p-6 max-w-3xl">
          <p className="text-sm text-gray-500">
            شناسه پیکسل یکتانت / متا را وارد کنید تا در فروشگاه تکی تزریق شود. پارامتر <code>?aff=</code> روی سفارش ذخیره می‌شود.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Yektanet Pixel ID</label>
              <input
                className="w-full rounded-lg border px-3 py-2 text-sm"
                value={data.marketing.yektanetPixelId}
                onChange={(e) =>
                  setData((d) =>
                    d
                      ? {
                          ...d,
                          marketing: {
                            ...(d.marketing ?? { yektanetPixelId: '', metaPixelId: '' }),
                            yektanetPixelId: e.target.value,
                          },
                        }
                      : d,
                  )
                }
                dir="ltr"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Meta Pixel ID</label>
              <input
                className="w-full rounded-lg border px-3 py-2 text-sm"
                value={data.marketing.metaPixelId}
                onChange={(e) =>
                  setData((d) =>
                    d
                      ? {
                          ...d,
                          marketing: {
                            ...(d.marketing ?? { yektanetPixelId: '', metaPixelId: '' }),
                            metaPixelId: e.target.value,
                          },
                        }
                      : d,
                  )
                }
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

function NumberField({ label, value, onChange, help }: {
  label: string; value: number; onChange: (v: number) => void; help?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input type="number" value={value ?? 0} onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
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
