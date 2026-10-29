/** Central Persian labels for modes / delivery statuses / ops verbs. */

export const MODE_LABELS_FA: Record<string, string> = {
  LIVE: 'زنده',
  CANARY: 'آزمایشی',
  OFF: 'خاموش',
  canary: 'آزمایشی',
};

export const STATUS_LABELS_FA: Record<string, string> = {
  RETRY: 'تلاش مجدد',
  DEAD: 'متوقف',
  HOLD: 'نگه‌داشته',
  stalled: 'گیرکرده',
  STALLED: 'گیرکرده',
  WITHDRAWN: 'برداشته‌شده',
  SUCCEEDED: 'موفق',
  PENDING: 'در انتظار',
  PROCESSING: 'در حال ارسال',
  FAILED: 'ناموفق',
  READY: 'آماده',
  PUBLISHED: 'منتشر',
  PARTIAL: 'ناقص',
};

export const OPS_LABELS_FA: Record<string, string> = {
  UPLOAD: 'آپلود',
  blast: 'ارسال دسته‌ای',
  BLAST: 'ارسال دسته‌ای',
  canary: 'آزمایشی',
  CANARY: 'آزمایشی',
};

export function modeLabelFa(mode?: string | null): string {
  if (!mode) return '—';
  return MODE_LABELS_FA[mode] || MODE_LABELS_FA[String(mode).toUpperCase()] || mode;
}

export function statusLabelFa(status?: string | null): string {
  if (!status) return '—';
  return STATUS_LABELS_FA[status] || STATUS_LABELS_FA[String(status).toUpperCase()] || status;
}

export function opsLabelFa(code?: string | null): string {
  if (!code) return '—';
  return OPS_LABELS_FA[code] || OPS_LABELS_FA[String(code).toUpperCase()] || code;
}

/** Counts line for health cards. */
export function countsTodayLineFa(counts: {
  retry: number;
  dead: number;
  hold: number;
  stalled: number;
}, format: (n: number) => string = String): string {
  return [
    `${statusLabelFa('RETRY')} ${format(counts.retry)}`,
    `${statusLabelFa('DEAD')} ${format(counts.dead)}`,
    `${statusLabelFa('HOLD')} ${format(counts.hold)}`,
    `${statusLabelFa('stalled')} ${format(counts.stalled)}`,
  ].join(' · ');
}
