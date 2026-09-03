export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export function validateNewPassword(password: string, phone?: string): string | null {
  if (typeof password !== 'string') return 'رمز عبور نامعتبر است';
  if (password.length < PASSWORD_MIN_LENGTH) return 'رمز عبور حداقل ۸ کاراکتر باشد';
  if (password.length > PASSWORD_MAX_LENGTH) return 'رمز عبور خیلی طولانی است';
  if (/\s/.test(password)) return 'رمز عبور نباید فاصله داشته باشد';
  if (phone && password === phone) return 'رمز عبور نباید همان شماره موبایل باشد';
  if (/^(.)\1+$/.test(password)) return 'رمز عبور نباید یک کاراکتر تکراری باشد';
  return null;
}
