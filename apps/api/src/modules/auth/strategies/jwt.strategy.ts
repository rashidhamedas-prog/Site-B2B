import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService, private readonly authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get('JWT_SECRET', 'taranom-secret-change-in-prod'),
    });
  }

  async validate(payload: { sub: string; phone: string; role: string }) {
    const user = await this.authService.findById(payload.sub);
    if (!user || !user.isActive) throw new UnauthorizedException();
    return { sub: user.id, id: user.id, phone: user.phone, role: user.role, customerId: user.customerId };
  }
}
