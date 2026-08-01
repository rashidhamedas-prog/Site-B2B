import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { importSPKI, jwtVerify } from 'jose';

/** Official Torob Ed25519 public key (Torob-Sync order_tracking_api.md). */
const TOROB_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAt6Mu4T0pBORY11W+QeM35UsmLO3vsf+6yKpFDEImFk0=
-----END PUBLIC KEY-----`;

const ALLOWED_AUDIENCES = [
  'www.poshaktaranom.ir',
  'poshaktaranom.ir',
  'api.poshaktaranom.com',
  'poshaktaranom.com',
  'www.poshaktaranom.com',
];

@Injectable()
export class TorobAuthGuard implements CanActivate {
  private keyPromise = importSPKI(TOROB_PUBLIC_KEY_PEM, 'EdDSA');

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const token = String(req.headers['x-torob-token'] || '').trim();
    if (!token) {
      throw new UnauthorizedException('missing X-Torob-Token');
    }

    const hostRaw = String(req.headers.host || '').trim().toLowerCase();
    const host = hostRaw.split(':')[0];
    const audiences = Array.from(
      new Set([host, hostRaw, ...ALLOWED_AUDIENCES].filter(Boolean)),
    );

    try {
      const key = await this.keyPromise;
      await jwtVerify(token, key, {
        algorithms: ['EdDSA'],
        audience: audiences,
      });
      return true;
    } catch {
      throw new UnauthorizedException('invalid Torob token');
    }
  }
}
