const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

export function toPersianDigits(input: string | number): string {
  return String(input).replace(/\d/g, (d) => PERSIAN_DIGITS[parseInt(d)]);
}

export function toLatinDigits(input: string): string {
  return input.replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)));
}

/** Format IRR (Rials) as Tomans with Persian digits and separator */
export function formatToman(rials: number, options?: { persian?: boolean }): string {
  const tomans = Math.floor(rials / 10);
  const formatted = tomans.toLocaleString('fa-IR');
  if (options?.persian === false) {
    return `${tomans.toLocaleString('en-US')} تومان`;
  }
  return `${formatted} تومان`;
}

/** Format IRR as compact (e.g., ۱.۵ میلیون تومان) */
export function formatTomanCompact(rials: number): string {
  const tomans = Math.floor(rials / 10);
  if (tomans >= 1_000_000) {
    const millions = (tomans / 1_000_000).toFixed(1);
    return `${toPersianDigits(millions)} میلیون تومان`;
  }
  if (tomans >= 1_000) {
    const thousands = Math.floor(tomans / 1_000);
    return `${toPersianDigits(thousands)} هزار تومان`;
  }
  return formatToman(rials);
}

/** Parse Toman string back to Rials (BIGINT-safe) */
export function parseTomanToRials(tomanStr: string): number {
  const digits = toLatinDigits(tomanStr).replace(/[^\d]/g, '');
  return parseInt(digits, 10) * 10;
}
