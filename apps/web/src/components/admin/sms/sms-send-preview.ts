/** Segment preview request/response helpers (no React). */

export type CitySegmentRule = { field: 'city'; op: 'in'; value: string[] };

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

/** Same city rule the wizard uses when creating a campaign. */
export function buildCitySegmentRules(city: string): CitySegmentRule[] {
  const trimmed = city.trim();
  return trimmed ? [{ field: 'city', op: 'in', value: [trimmed] }] : [];
}

export function priceCaption(unitPricePerPart: number | null | undefined): string {
  if (unitPricePerPart == null) return 'قیمت تنظیم نشده';
  return `${Math.floor(unitPricePerPart).toLocaleString('fa-IR')} ریال`;
}

/** Request body for segment preview — always send footer-applied previewBody as `text`. */
export function buildSegmentPreviewPayload(
  sources: string[],
  previewBody: string,
  messageClass: string,
  rules: CitySegmentRule[] = [],
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
