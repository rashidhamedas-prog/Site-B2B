/**
 * Persian primary labels for omnichannel delivery/outbox errors + freshness helper.
 * Technical code stays available for title/tooltip.
 */

export const ERROR_LABELS: Record<string, string> = {
  invalid_credential: 'توکن ربات نامعتبر است، روی سرور تنظیم نشده یا ربات از کانال حذف شده',
  rate_limited: 'پیام‌رسان محدودیت نرخ داد؛ خودکار دوباره تلاش می‌شود',
  provider_unavailable: 'پیام‌رسان در دسترس نبود؛ دوباره تلاش می‌شود',
  timeout: 'پاسخ پیام‌رسان دیر شد؛ دوباره تلاش می‌شود',
  duplicate: 'قبلاً همین محتوا ارسال/ویرایش شده بود',
  validate_failed: 'پیام‌رسان درخواست را رد کرد (شناسه یا محتوای پست را بررسی کنید)',
  chat_not_found: 'چت پیدا نشد؛ ربات را به کانال اضافه کنید یا شناسه را درست وارد کنید',
  permission_denied: 'ربات ادمین کانال نیست یا اجازهٔ ارسال ندارد — در تنظیمات کانال، ربات را ادمین کنید (ارسال / ویرایش / حذف پیام)',
  destination_missing: 'شناسه مقصد خالی است',
  provider_message_missing: 'شناسه پیام روی پیام‌رسان ثبت نشده بود',
  webhook_active: 'روی این ربات وب‌هوک فعال است؛ getUpdates کار نمی‌کند. وب‌هوک را بردارید یا شناسه را دستی وارد کنید',
  delete_window_expired: 'بله فقط پیام‌های کمتر از ۴۸ ساعت را حذف می‌کند؛ این پیام قدیمی‌تر بود',
  unknown_provider: 'پلتفرم این اتصال پشتیبانی نمی‌شود',
  cancelled_by_admin: 'با دستور ادمین از صف لغو شد (عمدی)',
  publication_withdrawn: 'انتشار از کانال برداشته شده بود (عمدی)',
  'connector is disabled': 'ارسال از سرور خاموش بود؛ با روشن‌بودن کانکتور می‌توان بازتلاش کرد',
  superseded_duplicate: 'ارسال تکراری بود و کنار گذاشته شد (عمدی)',
  stale_needs_reapproval: 'پست قدیمی است و قبل از ارسال باید دوباره تأیید شود',
  uncertain_after_timeout: 'نتیجهٔ ارسال معلوم نیست (تایم‌اوت)؛ قبل از تلاش دوباره کانال را چک کنید',
  send_unconfirmed: 'نتیجهٔ ارسال معلوم نیست؛ قبل از تلاش دوباره کانال را چک کنید',
  held_by_ops_no_live_until_canary_go: 'ارسال زنده تا تأیید canary متوقف است (نگهداری عملیاتی)',
  WEBPAGE_CURL_FAILED: 'پیام‌رسان نتوانست تصویر را از اینترنت بگیرد؛ حالت آپلود رسانه را بررسی کنید',
  '42P08': 'خطای داخلی پایگاه‌داده در رزرو ارسال (رفع‌شده در نسخهٔ جدید؛ این ردیف قدیمی است)',
  'inconsistent types deduced for parameter $2':
    'خطای داخلی پایگاه‌داده در رزرو ارسال (رفع‌شده در نسخهٔ جدید؛ این ردیف قدیمی است)',
  daily_cap: 'سقف ارسال امروز پر است؛ به روز بعد موکول شد',
  min_gap: 'فاصلهٔ حداقل بین ارسال‌ها رعایت نشده؛ کمی بعد دوباره تلاش می‌شود',
  rate_limit: 'سقف نرخ ارسال پر است؛ یک دقیقه بعد دوباره تلاش می‌شود',
  unsupported_media: 'تصویر خراب، ناقص یا بیش از حد بزرگ است — اول فایل را اصلاح کنید؛ تلاش دوباره بی‌فایده است',
};

/** Prefer longest/most-specific code match for tooltip. */
export function errorTechnicalCode(error?: string | null): string {
  if (!error) return '';
  const key = String(error).trim();
  if (ERROR_LABELS[key]) return key;
  const preferred = [
    'inconsistent types deduced for parameter $2',
    'held_by_ops_no_live_until_canary_go',
    'uncertain_after_timeout',
    'superseded_duplicate',
    'WEBPAGE_CURL_FAILED',
    '42P08',
  ];
  for (const code of preferred) {
    if (key.toLowerCase().includes(code.toLowerCase())) return code;
  }
  for (const code of Object.keys(ERROR_LABELS)) {
    if (key.includes(code)) return code;
  }
  return key.slice(0, 80);
}

export function errorLabel(error?: string | null): string {
  if (!error) return '';
  const key = String(error).trim();
  if (ERROR_LABELS[key]) return ERROR_LABELS[key];
  for (const [code, label] of Object.entries(ERROR_LABELS)) {
    if (key.toLowerCase().includes(code.toLowerCase())) return label;
  }
  return key;
}

export function errorLabelWithCodeTitle(error?: string | null): { label: string; title: string } {
  const label = errorLabel(error);
  const code = errorTechnicalCode(error);
  return { label, title: code && code !== label ? code : String(error || '') };
}

export type ErrorFreshness = {
  stale: boolean;
  /** Persian line for UI; never presents stale as current «آخرین خطا». */
  displayFa: string;
  muted: boolean;
};

function tehranDateShort(iso: string): string {
  try {
    return new Intl.DateTimeFormat('fa-IR', {
      timeZone: 'Asia/Tehran',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 16);
  }
}

/**
 * If lastErrorAt is missing or older than lastSuccessAt, treat as archive — not current red error.
 */
export function classifyErrorFreshness(input: {
  lastError?: string | null;
  lastErrorAt?: string | null;
  lastSuccessAt?: string | null;
}): ErrorFreshness | null {
  const err = String(input.lastError || '').trim();
  if (!err) return null;
  const label = errorLabel(err);
  const errAt = input.lastErrorAt ? Date.parse(input.lastErrorAt) : NaN;
  const okAt = input.lastSuccessAt ? Date.parse(input.lastSuccessAt) : NaN;
  const hasErrAt = Number.isFinite(errAt);
  const hasOkAt = Number.isFinite(okAt);
  if (hasOkAt && (!hasErrAt || errAt! < okAt!)) {
    const when = hasErrAt ? tehranDateShort(input.lastErrorAt!) : 'بدون تاریخ';
    return {
      stale: true,
      muted: true,
      displayFa: `آخرین خطا (آرشیو · ${when}): ${label}`,
    };
  }
  return {
    stale: false,
    muted: false,
    displayFa: `آخرین خطا: ${label}`,
  };
}
