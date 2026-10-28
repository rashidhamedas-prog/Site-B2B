import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  OMNICHANNEL_MIN_ROLE_KEY,
  OMNICHANNEL_OWNER_WHEN_LIVE_KEY,
  OMNICHANNEL_REQUIRES_GO_REF_KEY,
} from '../decorators/omnichannel-role.decorator';
import {
  assertGoRefPresent,
  GO_REF_REQUIRED_MESSAGE,
  isOmnichannelRbacEnabled,
  roleMeetsMinimum,
  type OmnichannelRole,
} from '../omnichannel-rbac';
import { assertNoPlaintextSecrets } from '../omnichannel-secrets';

type OmniReq = {
  body?: { dryRun?: boolean; goRef?: string; confirm?: boolean };
  omnichannelActor?: { id: string; role: string; omnichannelRole?: OmnichannelRole };
};

@Injectable()
export class OmnichannelRoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (!isOmnichannelRbacEnabled()) return true;

    const minRole = this.reflector.getAllAndOverride<OmnichannelRole | undefined>(
      OMNICHANNEL_MIN_ROLE_KEY,
      [context.getHandler(), context.getClass()],
    );
    const requiresGoRef = this.reflector.getAllAndOverride<boolean>(
      OMNICHANNEL_REQUIRES_GO_REF_KEY,
      [context.getHandler(), context.getClass()],
    );
    const ownerWhenLive = this.reflector.getAllAndOverride<boolean>(
      OMNICHANNEL_OWNER_WHEN_LIVE_KEY,
      [context.getHandler(), context.getClass()],
    );

    const req = context.switchToHttp().getRequest<OmniReq>();
    const actual = req.omnichannelActor?.omnichannelRole || 'PUBLISHER';
    const body = req.body || {};

    let effectiveMin: OmnichannelRole = minRole || 'VIEWER';
    let needGoRef = requiresGoRef === true;

    if (ownerWhenLive) {
      const dryRun = body.dryRun === true;
      if (!dryRun) {
        effectiveMin = 'OWNER';
        needGoRef = true;
      }
    }

    if (!roleMeetsMinimum(actual, effectiveMin)) {
      throw new ForbiddenException(
        `این عملیات نیاز به نقش Omnichannel ${effectiveMin} دارد (نقش فعلی: ${actual})`,
      );
    }

    if (needGoRef) {
      try {
        const goRef = assertGoRefPresent(body.goRef);
        assertNoPlaintextSecrets({ goRef });
      } catch (err) {
        if (err instanceof BadRequestException) throw err;
        const msg = err instanceof Error ? err.message : GO_REF_REQUIRED_MESSAGE;
        if (msg === GO_REF_REQUIRED_MESSAGE || (err as { statusCode?: number }).statusCode === 400) {
          throw new BadRequestException(GO_REF_REQUIRED_MESSAGE);
        }
        throw err;
      }
    }

    return true;
  }
}
