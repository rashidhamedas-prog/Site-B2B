/** Normalize an Iranian phone number to 09XXXXXXXXX format */
export function normalizeIranianPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('98')) return '0' + digits.slice(2);
  if (digits.startsWith('9') && digits.length === 10) return '0' + digits;
  return digits;
}

/** Validate Iranian mobile number */
export function isValidIranianPhone(phone: string): boolean {
  const normalized = normalizeIranianPhone(phone);
  return /^09[0-9]{9}$/.test(normalized);
}

/** Format phone as ۰۹۱۵-۲۴۲-۴۶۲۴ */
export function formatPhoneFa(phone: string): string {
  const normalized = normalizeIranianPhone(phone);
  if (normalized.length !== 11) return phone;
  const formatted = `${normalized.slice(0, 4)}-${normalized.slice(4, 7)}-${normalized.slice(7)}`;
  return formatted.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(d)]);
}

/** Format national ID (کد ملی) with dashes */
export function formatNationalId(id: string): string {
  const digits = id.replace(/\D/g, '');
  if (digits.length !== 10) return id;
  return `${digits.slice(0, 3)}-${digits.slice(3, 9)}-${digits.slice(9)}`;
}

/** Validate Iranian national ID checksum */
export function isValidNationalId(id: string): boolean {
  const digits = id.replace(/\D/g, '');
  if (digits.length !== 10 || /^(\d)\1{9}$/.test(digits)) return false;
  const check = parseInt(digits[9]);
  const sum = digits.slice(0, 9).split('').reduce((acc, d, i) => acc + parseInt(d) * (10 - i), 0);
  const remainder = sum % 11;
  return remainder < 2 ? check === remainder : check === 11 - remainder;
}
