import {
  COMPANY_PRODUCTION_YEARS_LABEL,
  COMPANY_PRODUCTION_YEARS_SUBLABEL,
  companyProductionYearsTitle,
  yearsOfOperationFa,
} from './business-facts';

/**
 * Company production-year claims only.
 * Founder marketing copy («تجربه در بازاریابی»، حامد) is a different entity and is left alone.
 * Matches a year claim, not a generic mention of the workshop.
 */
const COMPANY_YEAR_TITLE = /تجربه\s*تولیدی|سال\s*فعالیت\s*تولیدی|سال\s*تجربه/;

export function isCompanyProductionYearTitle(title: string): boolean {
  if (/بازاریابی|بنیان‌گذار|بنیانگذار|حامد/.test(title)) return false;
  return COMPANY_YEAR_TITLE.test(title);
}

export function isCompanyProductionYearStat(item: { label?: string; sublabel?: string }): boolean {
  const label = item.label ?? '';
  if (/بازاریابی|بنیان‌گذار|بنیانگذار|حامد/.test(label)) return false;
  if (/سال\s*تجربه|سال\s*فعالیت\s*تولیدی/.test(label)) return true;
  return (item.sublabel ?? '') === 'در بازار پوشاک' && /سال|تجربه/.test(label);
}

export function alignCompanyProductionFeature<T extends { title: string }>(
  item: T,
  now: Date = new Date()
): T {
  if (!isCompanyProductionYearTitle(item.title)) return item;
  return { ...item, title: companyProductionYearsTitle(now) };
}

export function alignCompanyProductionStat<
  T extends { value: string; label: string; sublabel?: string },
>(item: T, now: Date = new Date()): T {
  if (!isCompanyProductionYearStat(item)) return item;
  return {
    ...item,
    value: yearsOfOperationFa(now),
    label: COMPANY_PRODUCTION_YEARS_LABEL,
    ...(item.sublabel !== undefined ? { sublabel: COMPANY_PRODUCTION_YEARS_SUBLABEL } : {}),
  };
}
