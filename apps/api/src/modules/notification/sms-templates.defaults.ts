/**
 * Default SMS body templates (Persian).
 * Placeholders: {orderNumber} {trackingLine} {amountToman} {refId}
 * {customerName} {customerLabel} {phone} {site} {greet} {code}
 */
export const SMS_TEMPLATE_DEFAULTS = {
  otpFallback: 'پوشاک ترنم\nکد تایید شما: {code}',
  orderRegistered:
    'پوشاک ترنم\nسفارش {orderNumber} ثبت شد و در انتظار بررسی است.\nپیگیری: poshaktaranom.com/portal',
  orderRegisteredAdmin: 'پوشاک ترنم\nسفارش جدید {site}\nشماره: {orderNumber}{customerLine}',
  wholesaleRegistrationAdmin: 'پوشاک ترنم\nثبت‌نام عمده جدید\n{customerName}\n{phone}',
  wholesaleApproved: 'پوشاک ترنم\n{greet}حساب عمده شما تأیید شد.\nورود: poshaktaranom.com/portal',
  orderConfirmed: 'پوشاک ترنم\nسفارش {orderNumber} تایید شد و آماده‌سازی آن آغاز شده است.',
  orderShipped: 'پوشاک ترنم\nسفارش {orderNumber} ارسال شد.{trackingLine}',
  paymentReceived: 'پوشاک ترنم\nپرداخت {amountToman} تومان با موفقیت ثبت شد.\nکد پیگیری: {refId}',
} as const;

export type SmsTemplateKey = keyof typeof SMS_TEMPLATE_DEFAULTS;

export function fillSmsTemplate(template: string, vars: Record<string, string>): string {
  return String(template || '').replace(/\{(\w+)\}/g, (_, key: string) =>
    vars[key] != null ? String(vars[key]) : '',
  );
}

export function resolveSmsTemplates(raw?: Record<string, unknown> | null) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const out = { ...SMS_TEMPLATE_DEFAULTS } as Record<SmsTemplateKey, string>;
  for (const key of Object.keys(SMS_TEMPLATE_DEFAULTS) as SmsTemplateKey[]) {
    const v = src[key];
    if (typeof v === 'string' && v.trim()) out[key] = v;
  }
  return out;
}
