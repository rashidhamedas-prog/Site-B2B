import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { STAFF_ROLE_LABELS, type StaffRole } from '../auth/staff-access';

export const SMS_ROLES_KEY = 'sms_roles';

/** Exact SMS panel roles (ADMIN = مدیر کل). Does not widen ADMIN to all staff. */
export const SmsRoles = (...roles: string[]) => SetMetadata(SMS_ROLES_KEY, roles);

export function smsRoleLabel(role: string): string {
  return (STAFF_ROLE_LABELS as Record<string, string>)[role] || role;
}

@Injectable()
export class SmsRolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(SMS_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;
    const { user } = context.switchToHttp().getRequest();
    if (!user?.role || user.purpose !== 'admin') {
      throw new ForbiddenException({
        message: 'دسترسی غیرمجاز',
        code: 'SMS_FORBIDDEN',
      });
    }
    if (required.includes(user.role)) return true;
    const needed = required.map(smsRoleLabel).join('، ');
    throw new ForbiddenException({
      message: `این عملیات نیاز به نقش ${needed} دارد`,
      code: 'SMS_FORBIDDEN',
      requiredRoles: required,
    });
  }
}

export const SMS_ALL = ['ADMIN', 'SMS_MANAGER', 'SMS_OPERATOR', 'SMS_MARKETER'] as const;
export const SMS_MANAGERS = ['ADMIN', 'SMS_MANAGER'] as const;
export const SMS_SEND_SINGLE = ['ADMIN', 'SMS_MANAGER', 'SMS_OPERATOR', 'SMS_MARKETER'] as const;
export const SMS_MARKETERS = ['ADMIN', 'SMS_MANAGER', 'SMS_MARKETER'] as const;

export type { StaffRole };
