'use client';

import { AdminChannelTabs } from '@/components/admin/AdminChannelTabs';
import { NumberField, SecretField, TextAreaField, TextField, ToggleRow } from './fields';
import { SettingsSection } from './primitives';
import type { SaleChannel, SettingsPayload, SmsOpsSide } from './types';

const SMS_CUSTOMER_EVENTS: Record<string, string> = {
  orderRegistered: 'ثبت سفارش جدید (به مشتری)',
  orderConfirmed: 'تأیید سفارش (به مشتری)',
  orderShipped: 'ارسال مرسوله + کد رهگیری (به مشتری)',
  paymentReceived: 'دریافت پرداخت (به مشتری)',
  wholesaleApproved: 'تأیید حساب عمده (به مشتری)',
  fulfillmentPendingAccept: 'مرسوله جدید همکار — قبول ارسال (به همکار)',
};

const SMS_ADMIN_EVENTS: Record<string, string> = {
  orderRegisteredAdmin: 'ثبت سفارش جدید (به ادمین)',
  wholesaleRegistrationAdmin: 'ثبت‌نام عمده جدید (به ادمین)',
};

export const SMS_TEMPLATE_DEFAULTS: Record<string, string> = {
  otpFallback: 'پوشاک ترنم\nکد تایید شما: {code}',
  orderRegistered:
    'پوشاک ترنم\nسفارش {orderNumber} ثبت شد و در انتظار بررسی است.\nپیگیری: poshaktaranom.com/portal',
  orderRegisteredAdmin: 'پوشاک ترنم\nسفارش جدید {site}\nشماره: {orderNumber}{customerLine}',
  wholesaleRegistrationAdmin: 'پوشاک ترنم\nثبت‌نام عمده جدید\n{customerName}\n{phone}',
  wholesaleApproved: 'پوشاک ترنم\n{greet}حساب عمده شما تأیید شد.\nورود: poshaktaranom.com/portal',
  orderConfirmed: 'پوشاک ترنم\nسفارش {orderNumber} تایید شد و آماده‌سازی آن آغاز شده است.',
  orderShipped: 'پوشاک ترنم\nسفارش {orderNumber} ارسال شد.{trackingLine}',
  paymentReceived: 'پوشاک ترنم\nپرداخت {amountToman} تومان با موفقیت ثبت شد.\nکد پیگیری: {refId}',
  fulfillmentPendingAccept:
    'پوشاک ترنم\nمرسوله جدید برای ارسال\nسفارش {orderNumber}\nمهلت قبول: {slaHours} ساعت\nورود همکاران: {partnersUrl}',
};

const SMS_TEMPLATE_META: Array<{ key: string; label: string; placeholders: string }> = [
  { key: 'otpFallback', label: 'OTP (وقتی قالب sms.ir ست نشده)', placeholders: '{code}' },
  { key: 'orderRegistered', label: SMS_CUSTOMER_EVENTS.orderRegistered, placeholders: '{orderNumber}' },
  { key: 'orderConfirmed', label: SMS_CUSTOMER_EVENTS.orderConfirmed, placeholders: '{orderNumber}' },
  { key: 'orderShipped', label: SMS_CUSTOMER_EVENTS.orderShipped, placeholders: '{orderNumber} {trackingLine} {trackingCode}' },
  { key: 'paymentReceived', label: SMS_CUSTOMER_EVENTS.paymentReceived, placeholders: '{amountToman} {refId}' },
  { key: 'wholesaleApproved', label: SMS_CUSTOMER_EVENTS.wholesaleApproved, placeholders: '{greet} {customerName}' },
  { key: 'fulfillmentPendingAccept', label: SMS_CUSTOMER_EVENTS.fulfillmentPendingAccept, placeholders: '{orderNumber} {slaHours} {partnersUrl}' },
  { key: 'orderRegisteredAdmin', label: SMS_ADMIN_EVENTS.orderRegisteredAdmin, placeholders: '{site} {orderNumber} {customerLine}' },
  { key: 'wholesaleRegistrationAdmin', label: SMS_ADMIN_EVENTS.wholesaleRegistrationAdmin, placeholders: '{customerName} {phone}' },
];

const OPS_LABELS: Record<keyof SmsOpsSide, string> = {
  orderPaidAdmin: 'سفارش با پرداخت قطعی — پیامک به ادمین',
  abandonedCart: 'سبد رهاشده بعد از ۳۰ دقیقه — پیامک به مشتری',
  stockOutAdmin: 'اتمام موجودی محصول — پیامک به ادمین',
};

export function SmsTab({
  sms,
  smsOps,
  channel,
  onChannel,
  onSms,
  onOps,
  showSecret,
  onToggleSecret,
}: {
  sms: SettingsPayload['sms'];
  smsOps: SettingsPayload['smsOps'];
  channel: SaleChannel;
  onChannel: (ch: SaleChannel) => void;
  onSms: (next: SettingsPayload['sms']) => void;
  onOps: (next: SettingsPayload['smsOps']) => void;
  showSecret: boolean;
  onToggleSecret: () => void;
}) {
  const isRetail = channel === 'RETAIL';
  const ops = isRetail ? smsOps.retail : smsOps.wholesale;

  return (
    <div className="space-y-5">
      <SettingsSection
        title="سرویس sms.ir"
        hint="این بخش مشترک است؛ کلید و خط ارسال برای هر دو سایت یکی است."
      >
        <ToggleRow
          label="فعال‌سازی سرویس پیامک"
          hint="با خاموش کردن، هیچ پیامکی از سرور ارسال نمی‌شود"
          value={sms.enabled}
          onChange={(v) => onSms({ ...sms, enabled: v })}
        />
        <SecretField
          label="کلید API"
          value={sms.apiKey}
          shown={showSecret}
          onToggle={onToggleSecret}
          onChange={(v) => onSms({ ...sms, apiKey: v })}
          help="از پنل sms.ir → توسعه‌دهنده → کلید API"
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="شماره خط ارسال" value={sms.lineNumber} dir="ltr" onChange={(v) => onSms({ ...sms, lineNumber: v })} />
          <NumberField label="شناسه قالب OTP" value={sms.otpTemplateId} onChange={(v) => onSms({ ...sms, otpTemplateId: v })} help="برای کد ورود — اختیاری" />
        </div>
      </SettingsSection>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-gray-900">رویدادها و شماره‌های ادمین</h3>
          <p className="mt-1 text-xs text-gray-500">تکی و عمده جدا هستند. شماره ادمین همین تب برای هر سایت استفاده می‌شود.</p>
        </div>
        <AdminChannelTabs value={channel} onChange={onChannel} />
      </div>

      <SettingsSection
        tone={isRetail ? 'retail' : 'wholesale'}
        title={isRetail ? 'اعلان‌های فروشگاه تکی' : 'اعلان‌های سایت عمده'}
        badge={isRetail ? '.ir' : '.com'}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            label="شماره ادمین ۱"
            value={isRetail ? sms.adminPhoneRetail : sms.adminPhoneWholesale}
            dir="ltr"
            onChange={(v) => onSms(isRetail ? { ...sms, adminPhoneRetail: v } : { ...sms, adminPhoneWholesale: v })}
            help="مثال: 09121234567"
          />
          <TextField
            label="شماره ادمین ۲ (اختیاری)"
            value={isRetail ? sms.adminPhoneRetail2 : sms.adminPhoneWholesale2}
            dir="ltr"
            onChange={(v) => onSms(isRetail ? { ...sms, adminPhoneRetail2: v } : { ...sms, adminPhoneWholesale2: v })}
          />
        </div>
        <div className="space-y-1 rounded-xl bg-white/70">
          {(Object.keys(OPS_LABELS) as Array<keyof SmsOpsSide>).map((ev) => (
            <ToggleRow
              key={ev}
              label={OPS_LABELS[ev]}
              value={ops[ev] !== false}
              onChange={(v) => onOps({
                ...smsOps,
                [isRetail ? 'retail' : 'wholesale']: { ...ops, [ev]: v },
              })}
            />
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title="رویدادهای عمومی پیامک" hint="این سوئیچ‌ها روی هر دو سایت اعمال می‌شوند مگر اینکه رویداد مخصوص عمده باشد.">
        <p className="text-xs font-semibold text-gray-600">به ادمین</p>
        {Object.keys(SMS_ADMIN_EVENTS).map((ev) => (
          <ToggleRow
            key={ev}
            label={SMS_ADMIN_EVENTS[ev]}
            value={sms.events[ev] !== false}
            onChange={(v) => onSms({ ...sms, events: { ...sms.events, [ev]: v } })}
          />
        ))}
        <p className="pt-2 text-xs font-semibold text-gray-600">به مشتری</p>
        {Object.keys(SMS_CUSTOMER_EVENTS).map((ev) => (
          <ToggleRow
            key={ev}
            label={SMS_CUSTOMER_EVENTS[ev]}
            value={sms.events[ev] !== false}
            onChange={(v) => onSms({ ...sms, events: { ...sms.events, [ev]: v } })}
          />
        ))}
      </SettingsSection>

      <SettingsSection title="متن پیامک‌ها" hint="مقادیر داخل { } خودکار جایگزین می‌شوند. خالی یعنی پیش‌فرض.">
        <div className="space-y-4">
          {SMS_TEMPLATE_META.map((meta) => (
            <div key={meta.key} className="space-y-2 rounded-xl border border-gray-100 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold text-gray-800">{meta.label}</p>
                <button
                  type="button"
                  className="text-xs font-medium text-primary hover:underline"
                  onClick={() => onSms({
                    ...sms,
                    templates: { ...sms.templates, [meta.key]: SMS_TEMPLATE_DEFAULTS[meta.key] },
                  })}
                >
                  بازگردانی پیش‌فرض
                </button>
              </div>
              <p className="text-left font-mono text-[11px] text-gray-400" dir="ltr">{meta.placeholders}</p>
              <TextAreaField
                value={sms.templates?.[meta.key] ?? SMS_TEMPLATE_DEFAULTS[meta.key] ?? ''}
                onChange={(v) => onSms({ ...sms, templates: { ...sms.templates, [meta.key]: v } })}
                rows={4}
              />
            </div>
          ))}
        </div>
      </SettingsSection>
    </div>
  );
}
