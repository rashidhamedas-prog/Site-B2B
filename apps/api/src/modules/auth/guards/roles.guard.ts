import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { ADMIN_ONLY_KEY } from '../decorators/admin-only.decorator';
import { isStaffRole } from '../staff-access';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles?.length) return true;

    const adminOnly = this.reflector.getAllAndOverride<boolean>(ADMIN_ONLY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const { user } = context.switchToHttp().getRequest();
    if (!user?.role) throw new ForbiddenException('دسترسی غیرمجاز');
    const allowsCustomer = requiredRoles.includes('CUSTOMER');
    if (!allowsCustomer && user.purpose === 'storefront') {
      throw new ForbiddenException('دسترسی غیرمجاز');
    }

    if (adminOnly) {
      if (user.role !== 'ADMIN') throw new ForbiddenException('فقط مدیر کل دسترسی دارد');
      return true;
    }

    if (requiredRoles.includes(user.role)) return true;
    if (requiredRoles.includes('ADMIN') && isStaffRole(user.role)) return true;

    throw new ForbiddenException('دسترسی غیرمجاز');
  }
}
