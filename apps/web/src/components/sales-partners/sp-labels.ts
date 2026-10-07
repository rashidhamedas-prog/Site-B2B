/** Shared FA labels + presentation helpers for sales-partner admin + partner portal. */

/**
 * Application statuses mirrored from API `SALES_PARTNER_APPLICATION_STATUSES`.
 * Keep in sync with `apps/api/.../sales-partner-policy.ts` — specs assert coverage.
 */
export const SP_APPLICATION_STATUSES = [
  'PENDING_OTP',
  'PENDING_REVIEW',
  'NEEDS_INFORMATION',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
] as const;
export type SpApplicationStatus = (typeof SP_APPLICATION_STATUSES)[number];

/** Exhaustive FA labels for canonical application statuses. */
export const SP_APP_STATUS_FA = {
  PENDING_OTP: 'در انتظار تأیید پیامکی',
  PENDING_REVIEW: 'در انتظار بررسی',
  NEEDS_INFORMATION: 'نیاز به تکمیل اطلاعات',
  APPROVED: 'تأییدشده',
  REJECTED: 'ردشده',
  CANCELLED: 'لغوشده',
} as const satisfies Record<SpApplicationStatus, string>;

/** Legacy / alternate codes that still appear in older rows or filters. */
const SP_APP_STATUS_ALIASES_FA: Record<string, string> = {
  NEED_INFO: SP_APP_STATUS_FA.NEEDS_INFORMATION,
  WITHDRAWN: 'انصراف',
};

export const SP_PARTNER_STATUS_FA: Record<string, string> = {
  ACTIVE: 'فعال',
  SUSPENDED: 'تعلیق',
  CLOSED: 'بسته',
  PENDING_TERMS: 'در انتظار پذیرش شرایط',
};

export const SP_DRAFT_STATUS_FA: Record<string, string> = {
  DRAFT: 'در حال آماده‌سازی',
  AWAITING_CUSTOMER_CONFIRMATION: 'منتظر تأیید مشتری',
  CUSTOMER_CONFIRMED: 'مشتری تأیید کرد — تبدیل نشده',
  CONVERTED_TO_ORDER: 'خرید شد',
  REJECTED_BY_CUSTOMER: 'مشتری رد کرد',
  EXPIRED: 'منقضی شد',
  CANCELLED: 'لغو شد',
};

/** Short next-step hint for partner order cards. */
export function spDraftNextStep(status: string, stale?: boolean): string {
  if (stale) return 'قیمت یا موجودی عوض شده؛ قبل از ارسال دوباره بررسی کنید.';
  switch (status) {
    case 'DRAFT':
      return 'لینک تأیید را برای مشتری بفرستید.';
    case 'AWAITING_CUSTOMER_CONFIRMATION':
      return 'منتظر تصمیم مشتری روی پیامک هستید.';
    case 'CUSTOMER_CONFIRMED':
      return 'مشتری تأیید کرده؛ تبدیل به سفارش فروشگاه را بررسی کنید.';
    case 'CONVERTED_TO_ORDER':
      return 'پرداخت و ارسال با ترنم است؛ پورسانت بعد از تحویل حساب می‌شود.';
    case 'REJECTED_BY_CUSTOMER':
      return 'می‌توانید سفارش تازه‌ای بسازید.';
    case 'EXPIRED':
      return 'لینک منقضی شد؛ در صورت نیاز دوباره سفارش بسازید.';
    case 'CANCELLED':
      return 'این سفارش لغو شده است.';
    default:
      return 'جزئیات را باز کنید.';
  }
}

export const SP_AUDIT_ACTION_FA: Record<string, string> = {
  'application.approved': 'تأیید درخواست',
  'application.need_info': 'درخواست تکمیل اطلاعات',
  'application.rejected': 'رد درخواست',
  'profile.status_changed': 'تغییر وضعیت همکار',
  'profile.iban_updated': 'به‌روزرسانی شبا',
  'catalog.eligibility_changed': 'تغییر مجوز محصول',
  'rule.created': 'ثبت قانون پورسانت',
  'settings.updated': 'تغییر تنظیمات برنامه',
  'payout.confirmed': 'ثبت تسویه',
  'order.attribution_changed': 'تغییر attribution سفارش',
  'credentials.welcome_sms_sent': 'ارسال پیامک خوش‌آمد همکار',
};

export const SP_MODE_FA: Record<string, string> = {
  OFF: 'خاموش',
  PREVIEW: 'پیش‌نمایش ثبت‌نام',
  CANARY: 'آزمایشی',
  LIVE: 'زنده',
};

export function spStatusTone(status: string): 'ok' | 'warn' | 'danger' | 'neutral' | 'info' {
  const s = status.toUpperCase();
  if (['ACTIVE', 'APPROVED', 'PAID', 'CONVERTED_TO_ORDER', 'LIVE'].includes(s)) return 'ok';
  if (
    [
      'PENDING_OTP',
      'PENDING_REVIEW',
      'NEED_INFO',
      'NEEDS_INFORMATION',
      'AWAITING_CUSTOMER_CONFIRMATION',
      'CUSTOMER_CONFIRMED',
      'DRAFT',
      'HELD',
      'CANARY',
      'PREVIEW',
      'AWAITING_PAYMENT',
      'PENDING_TERMS',
    ].includes(s)
  ) {
    return 'warn';
  }
  if (['REJECTED', 'SUSPENDED', 'CLOSED', 'CANCELLED', 'EXPIRED', 'REJECTED_BY_CUSTOMER', 'OFF', 'WITHDRAWN'].includes(s)) {
    return 'danger';
  }
  if (s.includes('CONFIRM') || s.includes('PROCESS')) return 'info';
  return 'neutral';
}

export function spAuditLabel(action: string): string {
  return SP_AUDIT_ACTION_FA[action] || action;
}

/**
 * Resolve Persian application status label.
 * Prefer API `statusLabel` when it is already localized; otherwise map codes locally.
 */
export function spAppStatusLabel(status: string, apiLabel?: string | null): string {
  if (apiLabel && apiLabel.trim() && apiLabel !== status) return apiLabel.trim();
  if (status in SP_APP_STATUS_FA) {
    return SP_APP_STATUS_FA[status as SpApplicationStatus];
  }
  return SP_APP_STATUS_ALIASES_FA[status] || status;
}

export function spPartnerStatusLabel(status: string, fallback?: string | null): string {
  return fallback || SP_PARTNER_STATUS_FA[status] || status;
}

export function formatSpDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('fa-IR', {
      timeZone: 'Asia/Tehran',
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}
