export type UiLocale = 'fa' | 'en';

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

function toPersianDigitChars(input: string): string {
  return input.replace(/\d/g, (d) => PERSIAN_DIGITS[Number(d)] ?? d);
}

function toLatinDigitChars(input: string): string {
  return input.replace(/[۰-۹]/g, (d) => {
    const i = PERSIAN_DIGITS.indexOf(d);
    return i >= 0 ? String(i) : d;
  });
}

/**
 * Canonical storage is Latin digits. Shape for the active UI language at render.
 * Does not translate words — only 0-9 / ۰-۹.
 */
export function shapeDigitsInText(input: string | number, locale: UiLocale = 'fa'): string {
  const latin = toLatinDigitChars(String(input));
  return locale === 'en' ? latin : toPersianDigitChars(latin);
}

export const DEFAULT_UI_LOCALE: UiLocale = 'fa';
