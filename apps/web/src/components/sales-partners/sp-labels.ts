/** Shared FA labels + presentation helpers for sales-partner admin + partner portal. */

export const SP_APP_STATUS_FA: Record<string, string> = {
  PENDING_REVIEW: 'در انتظار بررسی',
  NEED_INFO: 'نیاز به تکمیل اطلاعات',
  APPROVED: 'تأییدشده',
  REJECTED: 'ردشده',
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
  if (['PENDING_REVIEW', 'NEED_INFO', 'AWAITING_CUSTOMER_CONFIRMATION', 'DRAFT', 'HELD', 'CANARY', 'PREVIEW'].includes(s)) {
    return 'warn';
  }
  if (['REJECTED', 'SUSPENDED', 'CLOSED', 'CANCELLED', 'EXPIRED', 'REJECTED_BY_CUSTOMER', 'OFF'].includes(s)) {
    return 'danger';
  }
  if (s.includes('CONFIRM') || s.includes('PROCESS')) return 'info';
  return 'neutral';
}

export function spAuditLabel(action: string): string {
  return SP_AUDIT_ACTION_FA[action] || action;
}

export function spAppStatusLabel(status: string): string {
  return SP_APP_STATUS_FA[status] || status;
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
