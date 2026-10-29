/**
 * Persian labels for defer / hold / gate reasons (PR-10; also used by queue/status).
 */
export const OMNICHANNEL_REASON_LABELS: Record<string, string> = {
  quiet_hours: 'ساعت سکوت',
  quiet: 'ساعت سکوت',
  daily_cap: 'سقف روزانه',
  min_gap: 'فاصلهٔ حداقل بین ارسال',
  mode_off: 'حالت انتشار خاموش',
  flags_off: 'پرچم کانکتور/اتوپابلیش خاموش',
  event_not_chosen: 'رویداد در لیست اتوماسیون نیست',
  emergency_hold: 'توقف اضطراری مقصد',
  category_not_allowed: 'دسته در allowlist نیست',
  no_canary: 'مقصد آزمایشی تنظیم نشده',
  no_destination: 'مقصدی نیست',
  none: 'بدون مانع',
};

export function omnichannelReasonLabel(key: string | null | undefined): string {
  const raw = String(key || '').trim();
  if (!raw) return '—';
  return OMNICHANNEL_REASON_LABELS[raw] || raw;
}
