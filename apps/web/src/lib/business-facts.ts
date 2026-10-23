/**
 * Single source of truth for public business claims.
 * Verified facts only — see SEO-REMAINING-MANUAL-ACTIONS.md before editing numbers.
 *
 * Company production tenure is a locked phrase. Do not derive a plus-count
 * from foundedGregorianYear.
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

/** Full locked claim: «بیش از ۱۰ سال فعالیت تولیدی». */
export const COMPANY_PRODUCTION_YEARS_CLAIM = 'بیش از ۱۰ سال فعالیت تولیدی';

/**
 * Homepage B0 stat split. Together with the label this is the locked claim;
 * «در مشهد» is the place sublabel.
 */
export const COMPANY_PRODUCTION_YEARS_STAT = {
  value: 'بیش از ۱۰',
  label: 'سال فعالیت تولیدی',
  sublabel: 'در مشهد',
} as const;

/**
 * Public company production-years claim.
 * Always the locked phrase — never a calendar N+ from 2015.
 */
export function yearsOfOperationFa(): string {
  return COMPANY_PRODUCTION_YEARS_CLAIM;
}
