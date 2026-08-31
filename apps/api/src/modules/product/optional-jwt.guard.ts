import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser>(err: unknown, user: TUser): TUser | null {
    return user ?? null;
  }
}

export function isAdminActor(user?: { role?: string } | null): boolean {
  return String(user?.role || '').toUpperCase() === 'ADMIN';
}
