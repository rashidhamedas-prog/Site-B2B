/** Persian / Arabic-Indic → Latin digits. Storage stays ASCII. */

const FA = '۰۱۲۳۴۵۶۷۸۹';
const AR = '٠١٢٣٤٥٦٧٨٩';

export function latinDigits(raw: string): string {
  return String(raw || '')
    .replace(/[۰-۹]/g, (d) => String(FA.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(AR.indexOf(d)));
}

export function onlyDigits(raw: string): string {
  return latinDigits(raw).replace(/\D/g, '');
}

export function shapeFaDigits(raw: string): string {
  return latinDigits(raw).replace(/\d/g, (d) => FA[Number(d)] ?? d);
}
