import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BLOG_PERMISSIONS_KEY } from '../decorators/blog-permissions.decorator';
import { UserEntity } from '../entities/user.entity';
import {
  hasBlogPermission,
  resolveBlogRole,
  type BlogPermission,
} from '../../blog/blog-roles';

@Injectable()
export class BlogPermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<BlogPermission[]>(
      BLOG_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required?.length) return true;

    const req = context.switchToHttp().getRequest();
    const jwtUser = req.user as { id?: string; sub?: string; role?: string } | undefined;
    if (!jwtUser?.role) throw new ForbiddenException('دسترسی غیرمجاز');

    const userId = jwtUser.id || jwtUser.sub;
    let blogRole: string | null = null;
    if (userId) {
      const row = await this.userRepo.findOne({
        where: { id: userId },
        select: ['id', 'role', 'blogRole'],
      });
      blogRole = row?.blogRole ?? null;
      req.blogUser = {
        id: userId,
        role: row?.role ?? jwtUser.role,
        blogRole,
        effectiveBlogRole: resolveBlogRole({
          role: row?.role ?? jwtUser.role,
          blogRole,
        }),
      };
    } else {
      req.blogUser = {
        id: undefined,
        role: jwtUser.role,
        blogRole: null,
        effectiveBlogRole: resolveBlogRole({ role: jwtUser.role, blogRole: null }),
      };
    }

    const allowed = required.some((p) =>
      hasBlogPermission({ role: req.blogUser.role, blogRole: req.blogUser.blogRole }, p),
    );
    if (!allowed) throw new ForbiddenException('سطح دسترسی وبلاگ کافی نیست');
    return true;
  }
}
