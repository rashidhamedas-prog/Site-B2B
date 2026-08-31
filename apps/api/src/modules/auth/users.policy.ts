import { isStaffRole } from './staff-access';

export type StaffMutationInput = {
  actorId: string;
  actorRole: string;
  targetId: string;
  targetRole: string;
  nextRole?: string;
  nextIsActive?: boolean;
  remainingActiveAdmins: number;
};

export function staffMutationError(input: StaffMutationInput): string | null {
  if (input.actorRole !== 'ADMIN') {
    return 'فقط مدیر کل می‌تواند کاربران سیستم را تغییر دهد';
  }
  if (input.nextRole && !isStaffRole(input.nextRole)) {
    return 'نقش نامعتبر است';
  }
  const demotingAdmin =
    input.targetRole === 'ADMIN' && Boolean(input.nextRole) && input.nextRole !== 'ADMIN';
  const deactivatingAdmin = input.targetRole === 'ADMIN' && input.nextIsActive === false;
  if ((demotingAdmin || deactivatingAdmin) && input.remainingActiveAdmins < 1) {
    return 'نمی‌توان آخرین مدیر فعال را حذف یا تغییر نقش داد';
  }
  if (input.targetId === input.actorId && input.nextIsActive === false) {
    return 'نمی‌توانید حساب خود را غیرفعال کنید';
  }
  return null;
}
