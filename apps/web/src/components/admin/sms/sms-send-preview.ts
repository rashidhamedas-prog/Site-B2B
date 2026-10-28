/** Segment preview request/response helpers (no React). */

/** Debounce for live segment preview requests. */
export const PREVIEW_DEBOUNCE_MS = 400;

export const AUDIENCE_SOURCE_OPTIONS = [
  { id: 'WHOLESALE', label: 'عمده' },
  { id: 'WHOLESALE_REFERRAL', label: 'معرف عمده' },
  { id: 'SALES_PARTNER', label: 'همکار فروش' },
  { id: 'RETAIL', label: 'خرده‌فروشی' },
] as const;

export type AudienceSourceId = (typeof AUDIENCE_SOURCE_OPTIONS)[number]['id'];

export const WIZARD_STEPS = ['مخاطبان', 'متن', 'زمان‌بندی', 'بازبینی و تأیید'] as const;

export type CitySegmentRule = { field: 'city'; op: 'in'; value: string[] };

export type SegmentFilterRule = {
  field: string;
  op: string;
  value: unknown;
};

export type AudienceFieldValue = string | { value: string; count?: number };

export type AudienceFieldDef = {
  field: string;
  ops: string[];
  values?: AudienceFieldValue[];
};

export function canEditUnitPrice(role: string | null | undefined): boolean {
  return role === 'ADMIN' || role === 'SMS_MANAGER';
}

/** Empty input → null. Invalid / negative → null (server rejects negatives). */
export function parseUnitPriceInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

export type SegmentPreviewFunnel = {
  total: number;
  duplicates: number;
  optedOut: number;
  blacklisted: number;
  noConsent: number;
  invalid: number;
  notApplicable: number;
  final: number;
  partsPerMsg: number;
  totalParts: number;
  estimatedCost: number | null;
  partialSources: string[];
  unitPricePerPart?: number | null;
};

/** Normalize Persian/Arabic yeh/kaf and collapse whitespace (matches server normalizeFa). */
export function normalizeFaCity(value: string): string {
  return String(value || '')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\u200c/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function formatFaNumber(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return Math.floor(n).toLocaleString('fa-IR');
}

export function countManualPhones(csv: string): number {
  return String(csv || '')
    .split(/[\r\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean).length;
}

/** Same city rule the wizard uses when creating a campaign. Accepts one city or many. */
export function buildCitySegmentRules(city: string | string[]): CitySegmentRule[] {
  const list = (Array.isArray(city) ? city : [city])
    .map((item) => String(item || '').trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const values: string[] = [];
  for (const item of list) {
    const key = normalizeFaCity(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    values.push(item.trim());
  }
  return values.length ? [{ field: 'city', op: 'in', value: values }] : [];
}

export function mergeSegmentRules(
  cityRules: CitySegmentRule[],
  filterRules: SegmentFilterRule[],
): SegmentFilterRule[] {
  return [...cityRules, ...filterRules];
}

export function priceCaption(unitPricePerPart: number | null | undefined): string {
  if (unitPricePerPart == null) return 'قیمت تنظیم نشده';
  return `${Math.floor(unitPricePerPart).toLocaleString('fa-IR')} ریال`;
}

export function costCaption(
  estimatedCost: number | null | undefined,
  unitPricePerPart: number | null | undefined,
): string {
  if (unitPricePerPart == null || estimatedCost == null) return 'قیمت تنظیم نشده';
  return `${Math.floor(estimatedCost).toLocaleString('fa-IR')} ریال`;
}

/** Request body for segment preview — always send footer-applied previewBody as `text`. */
export function buildSegmentPreviewPayload(
  sources: string[],
  previewBody: string,
  messageClass: string,
  rules: SegmentFilterRule[] = [],
) {
  return {
    sources,
    text: previewBody,
    messageClass,
    rules,
  };
}

export function consumeSegmentPreviewFunnel(row: Partial<SegmentPreviewFunnel>): SegmentPreviewFunnel {
  return {
    total: Number(row.total) || 0,
    duplicates: Number(row.duplicates) || 0,
    optedOut: Number(row.optedOut) || 0,
    blacklisted: Number(row.blacklisted) || 0,
    noConsent: Number(row.noConsent) || 0,
    invalid: Number(row.invalid) || 0,
    notApplicable: Number(row.notApplicable) || 0,
    final: Number(row.final) || 0,
    partsPerMsg: Number(row.partsPerMsg) || 0,
    totalParts: Number(row.totalParts) || 0,
    estimatedCost: row.estimatedCost == null ? null : Number(row.estimatedCost),
    partialSources: Array.isArray(row.partialSources) ? row.partialSources.map(String) : [],
    unitPricePerPart: row.unitPricePerPart ?? null,
  };
}

export function formatRecipientPreviewStatus(funnel: SegmentPreviewFunnel): {
  text: string;
  tone: 'ok' | 'warn' | 'error';
} {
  if (funnel.partialSources.length > 0) {
    return {
      text: `خطا در بارگذاری منابع: ${funnel.partialSources.join('، ')}`,
      tone: 'error',
    };
  }
  if (funnel.final === 0 && funnel.noConsent > 0) {
    const n = funnel.noConsent.toLocaleString('fa-IR');
    return {
      text: `${n} مخاطب پیدا شد، اما برای پیام تبلیغاتی رضایت ثبت‌شده ندارند`,
      tone: 'warn',
    };
  }
  const price = priceCaption(funnel.unitPricePerPart ?? null);
  return {
    text: `${funnel.final.toLocaleString('fa-IR')} گیرنده نهایی${price ? ` · ${price}` : ''}`,
    tone: 'ok',
  };
}

export type PreviewPanelPhase = 'idle' | 'no-sources' | 'calculating' | 'ready' | 'zero' | 'error';

export type PreviewPanelView = {
  phase: PreviewPanelPhase;
  funnel: SegmentPreviewFunnel | null;
  /** Keep showing prior numbers while calculating (faded); never invent ۰. */
  displayFunnel: SegmentPreviewFunnel | null;
  faded: boolean;
  banner: string | null;
  bannerTone: 'info' | 'warn' | 'error' | null;
  zeroReason: string | null;
};

export function buildZeroRecipientReason(funnel: SegmentPreviewFunnel): string {
  if (funnel.noConsent > 0) {
    return `${funnel.noConsent.toLocaleString('fa-IR')} مخاطب پیدا شد، اما برای پیام تبلیغاتی رضایت ثبت‌شده ندارند`;
  }
  if (funnel.notApplicable > 0) {
    return 'با این فیلترها گیرنده‌ای باقی نماند (برخی منابع فیلتر شهر ندارند)';
  }
  return 'با این فیلترها گیرنده‌ای باقی نماند';
}

export function buildPreviewPanelView(input: {
  sources: string[];
  loading: boolean;
  error: string | null;
  funnel: SegmentPreviewFunnel | null;
  previousFunnel: SegmentPreviewFunnel | null;
}): PreviewPanelView {
  if (!input.sources.length) {
    return {
      phase: 'no-sources',
      funnel: null,
      displayFunnel: null,
      faded: false,
      banner: 'هیچ منبعی انتخاب نشده',
      bannerTone: 'info',
      zeroReason: null,
    };
  }
  if (input.loading) {
    return {
      phase: 'calculating',
      funnel: input.funnel,
      displayFunnel: input.previousFunnel ?? input.funnel,
      faded: true,
      banner: 'در حال محاسبه',
      bannerTone: 'info',
      zeroReason: null,
    };
  }
  if (input.error) {
    return {
      phase: 'error',
      funnel: input.funnel,
      displayFunnel: input.funnel ?? input.previousFunnel,
      faded: false,
      banner: input.error,
      bannerTone: 'error',
      zeroReason: null,
    };
  }
  if (!input.funnel) {
    return {
      phase: 'idle',
      funnel: null,
      displayFunnel: null,
      faded: false,
      banner: null,
      bannerTone: null,
      zeroReason: null,
    };
  }
  if (input.funnel.partialSources.length > 0) {
    return {
      phase: 'error',
      funnel: input.funnel,
      displayFunnel: input.funnel,
      faded: false,
      banner: `خطا در بارگذاری منابع: ${input.funnel.partialSources.join('، ')}`,
      bannerTone: 'error',
      zeroReason: null,
    };
  }
  if (input.funnel.final === 0) {
    const zeroReason = buildZeroRecipientReason(input.funnel);
    return {
      phase: 'zero',
      funnel: input.funnel,
      displayFunnel: input.funnel,
      faded: false,
      banner: zeroReason,
      bannerTone: 'warn',
      zeroReason,
    };
  }
  return {
    phase: 'ready',
    funnel: input.funnel,
    displayFunnel: input.funnel,
    faded: false,
    banner: null,
    bannerTone: null,
    zeroReason: null,
  };
}

export const CONTINUE_REASON_ID = 'sms-audience-continue-reason';

/** Gate for step-0 «بعدی: متن پیام». Manual phones can unlock when sources are empty. */
export function audienceContinueGate(input: {
  phase: PreviewPanelPhase;
  final: number;
  manualCount: number;
}): { disabled: boolean; reason: string | null } {
  if (input.phase === 'calculating') {
    return { disabled: true, reason: 'پیش‌نمایش در حال محاسبه است' };
  }
  if (input.phase === 'error') {
    return { disabled: true, reason: 'خطای پیش‌نمایش — ابتدا تلاش مجدد کنید' };
  }
  if (input.phase === 'no-sources' && input.manualCount === 0) {
    return { disabled: true, reason: 'هیچ منبعی انتخاب نشده' };
  }
  if (input.phase === 'zero' && input.manualCount === 0) {
    return { disabled: true, reason: 'گیرنده نهایی صفر است' };
  }
  if (input.final === 0 && input.manualCount === 0 && input.phase !== 'no-sources') {
    return { disabled: true, reason: 'گیرنده نهایی صفر است' };
  }
  return { disabled: false, reason: null };
}

/** Map internal wizard step (0..4) onto 4 visual steps; confirm shares review step. */
export function visualWizardStep(step: number): number {
  if (step <= 0) return 0;
  if (step === 1) return 1;
  if (step === 2) return 2;
  return 3;
}

export function sourcesNeedCityWarning(sources: string[]): boolean {
  return sources.includes('SALES_PARTNER') || sources.includes('WHOLESALE_REFERRAL');
}

export function parseAudienceFieldValues(
  values: AudienceFieldValue[] | undefined,
): Array<{ value: string; count: number | null }> {
  if (!Array.isArray(values)) return [];
  return values
    .map((item) => {
      if (typeof item === 'string') return { value: item, count: null as number | null };
      if (item && typeof item === 'object' && typeof item.value === 'string') {
        const count = item.count == null ? null : Number(item.count);
        return { value: item.value, count: count != null && Number.isFinite(count) ? count : null };
      }
      return null;
    })
    .filter((row): row is { value: string; count: number | null } => Boolean(row?.value));
}

export function filterCitySuggestions(
  options: Array<{ value: string; count: number | null }>,
  query: string,
): Array<{ value: string; count: number | null }> {
  const q = normalizeFaCity(query);
  if (!q) return options.slice(0, 40);
  return options.filter((opt) => normalizeFaCity(opt.value).includes(q)).slice(0, 40);
}

export function matchCityOption(
  options: Array<{ value: string; count: number | null }>,
  query: string,
): string | null {
  const q = normalizeFaCity(query);
  if (!q) return null;
  const exact = options.find((opt) => normalizeFaCity(opt.value) === q);
  return exact?.value ?? null;
}

export const FIELD_LABELS: Record<string, string> = {
  source: 'منبع',
  province: 'استان',
  city: 'شهر',
  orderStatus: 'وضعیت سفارش',
  lastOrderAt: 'تاریخ آخرین سفارش',
  orderCount: 'تعداد سفارش',
  customerSegment: 'سگمنت مشتری',
  partnerStatus: 'وضعیت همکار',
  referralStatus: 'وضعیت معرف',
  createdAt: 'تاریخ عضویت',
};

export const OP_LABELS: Record<string, string> = {
  in: 'یکی از',
  'any-in': 'شامل یکی از',
  before: 'قبل از',
  after: 'بعد از',
  withinDays: 'در … روز اخیر',
  never: 'هرگز',
  gte: 'بیشتر یا مساوی',
  lte: 'کمتر یا مساوی',
};

export function optedOutBlacklistTotal(funnel: SegmentPreviewFunnel): number {
  return funnel.optedOut + funnel.blacklisted;
}

/** Display helper: never render literal fake zero while loading/error without data. */
export function previewCellText(
  phase: PreviewPanelPhase,
  value: number | null | undefined,
  fadedHasValue: boolean,
): string {
  if (phase === 'no-sources') return '—';
  if (phase === 'calculating' && !fadedHasValue) return '…';
  if (phase === 'error' && value == null) return '—';
  if (value == null) return '—';
  return formatFaNumber(value);
}
