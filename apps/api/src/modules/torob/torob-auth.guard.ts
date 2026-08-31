import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { resolveTorobAudience, resolveTorobOrderAudience, verifyTorobJwt } from './torob-jwt';
import { extractClientIp } from '../../common/client-ip';

async function assertTorobToken(
  req: { headers: Record<string, unknown> },
  audience: string,
): Promise<void> {
  const token = String(req.headers['x-torob-token'] || '').trim();
  const version = String(req.headers['x-torob-token-version'] || '').trim();
  try {
    await verifyTorobJwt({ token, version, audience });
  } catch {
    throw new UnauthorizedException('توکن ترب نامعتبر است');
  }
  if (String(process.env.TOROB_IP_ALLOWLIST || '').trim() === '1') {
    const allow = String(process.env.TOROB_ALLOWED_IPS || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    if (allow.length && !allow.includes(extractClientIp(req as { ip?: string }))) {
      throw new UnauthorizedException('توکن ترب نامعتبر است');
    }
  }
}

/** Order-tracking endpoint: exact order audience, never the full shop-domain list. */
@Injectable()
export class TorobAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{
      headers: Record<string, unknown>;
      torobOrderProbe?: boolean;
    }>();
    if (!String(req.headers['x-torob-token'] || '').trim()) {
      req.torobOrderProbe = true;
      return true;
    }
    await assertTorobToken(req, resolveTorobOrderAudience());
    return true;
  }
}

/** Product API v3: exact TOROB_API_AUDIENCE (www.poshaktaranom.ir). Host cannot change it. */
@Injectable()
export class TorobProductAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    await assertTorobToken(context.switchToHttp().getRequest(), resolveTorobAudience());
    return true;
  }
}
