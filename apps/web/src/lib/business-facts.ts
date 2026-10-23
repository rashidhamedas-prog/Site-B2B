import { toPersianDigits } from '@taranom/persian-utils';

/**
 * Single source of truth for public business claims.
 * Verified facts only — see SEO-REMAINING-MANUAL-ACTIONS.md before editing numbers.
 */
export const BUSINESS_FACTS = {
  /** سال شمسی تأسیس تولیدی */
  foundedSolarYear: 1394,
  /** Gregorian founding year (for schema.org foundingDate) */
  foundedGregorianYear: 2015,
  /** اندازه تیم تولید */
  teamSize: 15,
  /** UNVERIFIED — tracked in SEO-REMAINING-MANUAL-ACTIONS.md; keep conservative */
  activeCustomers: 200,
  /** تعداد مدل فعال (approximate, conservative) */
  activeModels: 50,
} as const;

/** Years of operation computed from founding year (Gregorian). */
export function yearsOfOperation(now: Date = new Date()): number {
  return Math.max(1, now.getFullYear() - BUSINESS_FACTS.foundedGregorianYear);
}

/** e.g. "۱۱+" — years of operation in Persian digits with a '+' suffix. */
export function yearsOfOperationFa(): string {
  return `${toPersianDigits(yearsOfOperation())}+`;
}
