export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export const GENERIC_PASSWORD_FORGOT_MESSAGE =
  'اگر این شماره در سیستم باشد، کد تأیید پیامک می‌شود.';

export function validateNewPassword(password: string, phone?: string): string | null {
  if (typeof password !== 'string') return 'رمز عبور نامعتبر است';
  if (password.length < PASSWORD_MIN_LENGTH) return 'رمز عبور حداقل ۸ کاراکتر باشد';
  if (password.length > PASSWORD_MAX_LENGTH) return 'رمز عبور خیلی طولانی است';
  if (/\s/.test(password)) return 'رمز عبور نباید فاصله داشته باشد';
  if (phone && password === phone) return 'رمز عبور نباید همان شماره موبایل باشد';
  if (/^(.)\1+$/.test(password)) return 'رمز عبور نباید یک کاراکتر تکراری باشد';
  return null;
}

export function canSetPasswordWithoutCurrent(args: {
  dbRole: string;
  purpose?: string;
  hasOtpSession: boolean;
  isStaffRole: (role: string) => boolean;
}): boolean {
  if (args.isStaffRole(args.dbRole)) return false;
  if (args.purpose === 'admin') return false;
  return args.hasOtpSession;
}

export function canIssuePasswordReset(args: {
  user: { role: string; customerId?: string | null } | null;
  customer: { status: string } | null;
  isStaffRole: (role: string) => boolean;
}): boolean {
  const { user, customer, isStaffRole } = args;
  if (!user?.customerId || isStaffRole(user.role)) return false;
  if (!customer) return false;
  if (customer.status === 'BLOCKED' || customer.status === 'SUSPENDED') return false;
  return true;
}
