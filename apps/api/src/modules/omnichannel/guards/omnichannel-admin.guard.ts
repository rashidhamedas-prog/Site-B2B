import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../../auth/entities/user.entity';

export function isActiveAdmin(user?: { role?: string; isActive?: boolean } | null): boolean {
  return !!user && user.role === 'ADMIN' && user.isActive !== false;
}

/** JWT role is not enough — reload ADMIN from the users table. */
@Injectable()
export class OmnichannelAdminGuard implements CanActivate {
  constructor(
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{
      user?: { sub?: string; id?: string; role?: string };
      omnichannelActor?: { id: string; role: string };
    }>();
    const id = String(req.user?.sub || req.user?.id || '');
    if (!id) throw new ForbiddenException('دسترسی غیرمجاز');
    const row = await this.users.findOne({ where: { id }, select: ['id', 'role', 'isActive'] });
    if (!isActiveAdmin(row)) {
      throw new ForbiddenException('دسترسی غیرمجاز');
    }
    req.omnichannelActor = { id: row.id, role: row.role };
    return true;
  }
}
