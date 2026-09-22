import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { isJwtInvalidatedByPasswordChange } from '../jwt-invalidation';
import { actingRoleForPurpose, isStaffRole, resolveAuthPurpose } from '../staff-access';
import { canVendorLogin, isVendorRole } from '../../vendor/vendor-policy';
import { VendorEntity } from '../../vendor/entities/vendor.entity';
import { SalesPartnerProfileEntity } from '../../sales-partner/entities/sales-partner-profile.entity';
import { canSalesPartnerLogin } from '../../sales-partner/sales-partner-policy';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly authService: AuthService,
    @InjectRepository(VendorEntity)
    private readonly vendorRepo: Repository<VendorEntity>,
    @InjectRepository(SalesPartnerProfileEntity)
    private readonly salesPartnerRepo: Repository<SalesPartnerProfileEntity>,
  ) {
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

  async validate(payload: {
    sub: string;
    phone: string;
    role?: string;
    purpose?: string;
    iat?: number;
  }) {
    const user = await this.authService.findById(payload.sub);
    if (!user || !user.isActive) throw new UnauthorizedException();
    if (isJwtInvalidatedByPasswordChange(payload.iat, user.passwordChangedAt)) {
      throw new UnauthorizedException();
    }
    const purpose = resolveAuthPurpose(payload.purpose);
    if (purpose === 'admin' && !isStaffRole(user.role)) {
      throw new UnauthorizedException();
    }
    if (isVendorRole(user.role) && purpose !== 'vendor') {
      throw new UnauthorizedException();
    }
    if (purpose === 'vendor') {
      if (!isVendorRole(user.role)) throw new UnauthorizedException();
      const vendor = await this.vendorRepo.findOne({ where: { userId: user.id } });
      if (!vendor || !canVendorLogin(vendor.status)) throw new UnauthorizedException();
      return {
        sub: user.id,
        id: user.id,
        phone: user.phone,
        role: 'VENDOR',
        customerId: user.customerId,
        purpose,
        vendorId: vendor.id,
      };
    }
    if (purpose === 'sales_partner') {
      if (isVendorRole(user.role) || isStaffRole(user.role)) throw new UnauthorizedException();
      const partner = await this.salesPartnerRepo.findOne({ where: { userId: user.id } });
      if (!partner || !canSalesPartnerLogin(partner.status)) throw new UnauthorizedException();
      return {
        sub: user.id,
        id: user.id,
        phone: user.phone,
        role: 'SALES_PARTNER',
        customerId: user.customerId,
        purpose,
        salesPartnerId: partner.id,
      };
    }
    return {
      sub: user.id,
      id: user.id,
      phone: user.phone,
      role: actingRoleForPurpose(purpose, user.role),
      customerId: user.customerId,
      purpose,
    };
  }
}
