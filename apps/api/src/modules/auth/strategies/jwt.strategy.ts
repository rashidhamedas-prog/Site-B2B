import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService, private readonly authService: AuthService) {
    const secret = config.get<string>('JWT_SECRET');
    const isProd = config.get<string>('NODE_ENV') === 'production';
    if (!secret || (isProd && secret.length < 32)) {
      throw new Error(
        'JWT_SECRET is required (min 32 chars in production). Refusing to start.',
      );
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: secret || 'dev-only-insecure-jwt-secret-change-me',
    });
  }

  async validate(payload: { sub: string; phone: string; role: string }) {
    const user = await this.authService.findById(payload.sub);
    if (!user || !user.isActive) throw new UnauthorizedException();
    return { sub: user.id, id: user.id, phone: user.phone, role: user.role, customerId: user.customerId };
  }
}
