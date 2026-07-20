import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Authenticates CRM / external integrations via `x-api-key` or
 * `Authorization: Bearer <CRM_API_KEY>`.
 */
@Injectable()
export class CrmApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = (this.config.get<string>('CRM_API_KEY') ?? '').trim();
    if (!expected) {
      throw new UnauthorizedException('CRM API key is not configured');
    }

    const req = context.switchToHttp().getRequest();
    const headerKey = String(req.headers['x-api-key'] ?? '').trim();
    const auth = String(req.headers.authorization ?? '').trim();
    const bearer = auth.toLowerCase().startsWith('bearer ')
      ? auth.slice(7).trim()
      : '';

    const provided = headerKey || bearer;
    if (!provided || provided !== expected) {
      throw new UnauthorizedException('Invalid CRM API key');
    }
    return true;
  }
}
