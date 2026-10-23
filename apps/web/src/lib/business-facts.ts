import { toPersianDigits } from '@taranom/persian-utils';

/**
 * Single source of truth for public business claims.
 * Verified facts only — see SEO-REMAINING-MANUAL-ACTIONS.md before editing numbers.
 */
export const BUSINESS_FACTS = {
  /** سال شمسی تأسیس تولیدی */
  foundedSolarYear: 1394,
  /** Gregorian founding year (for schema.org foundingDate). Not used for the public year count. */
  foundedGregorianYear: 2015,
  /** اندازه تیم تولید */
  teamSize: 15,
  /** UNVERIFIED — tracked in SEO-REMAINING-MANUAL-ACTIONS.md; keep conservative */
  activeCustomers: 200,
  /** تعداد مدل فعال (approximate, conservative) */
  activeModels: 50,
} as const;

/** Company stat label — Option A: production activity, not vague market tenure. */
export const COMPANY_PRODUCTION_YEARS_LABEL = 'سال فعالیت تولیدی';

/** Where that production activity is claimed. */
export const COMPANY_PRODUCTION_YEARS_SUBLABEL = 'در مشهد';

function parseLocaleNumber(raw: string | undefined): number {
  if (!raw) return NaN;
  const normalized = raw.replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)));
  return Number(normalized);
}

/**
 * Jalali year in Asia/Tehran.
 * Gregorian `getFullYear() - 2015` matches this only after Nowruz; in January it is one year high.
 * Do not use `toJalali` from persian-utils here — that converter is not the solar year.
 */
export function currentSolarYear(now: Date = new Date()): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US-u-ca-persian', {
      timeZone: 'Asia/Tehran',
      year: 'numeric',
    }).formatToParts(now);
    const year = parseLocaleNumber(parts.find((part) => part.type === 'year')?.value);
    if (year >= 1300 && year <= 1700) return year;
  } catch {
    /* fall through to the March boundary approximation */
  }

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const year = parseLocaleNumber(parts.find((part) => part.type === 'year')?.value);
  const month = parseLocaleNumber(parts.find((part) => part.type === 'month')?.value);
  const day = parseLocaleNumber(parts.find((part) => part.type === 'day')?.value);
  if (!year || !month || !day) return BUSINESS_FACTS.foundedSolarYear;
  const beforeNowruz = month < 3 || (month === 3 && day < 21);
  return year - (beforeNowruz ? 622 : 621);
}

/** Completed solar years since foundedSolarYear (۱۳۹۴). */
export function yearsOfOperation(now: Date = new Date()): number {
  return Math.max(1, currentSolarYear(now) - BUSINESS_FACTS.foundedSolarYear);
}

/** e.g. "۱۱+" — solar years of production in Persian digits with a '+' suffix. */
export function yearsOfOperationFa(now: Date = new Date()): string {
  return `${toPersianDigits(yearsOfOperation(now))}+`;
}

/** Card title, e.g. "۱۱+ سال فعالیت تولیدی". */
export function companyProductionYearsTitle(now: Date = new Date()): string {
  return `${yearsOfOperationFa(now)} ${COMPANY_PRODUCTION_YEARS_LABEL}`;
}
