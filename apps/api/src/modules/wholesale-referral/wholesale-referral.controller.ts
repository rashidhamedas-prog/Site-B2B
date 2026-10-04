import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminOnly } from '../auth/decorators/admin-only.decorator';
import { WholesaleReferralService } from './wholesale-referral.service';

class ApplyDto {
  @IsString() @MinLength(2) displayName: string;
  @IsString() phone: string;
  @IsBoolean() termsAccepted: boolean;
}

class VerifyDto {
  @IsString() phone: string;
  @IsString() code: string;
}

class LoginDto {
  @IsString() phone: string;
}

class ManualDto {
  @IsString() @MinLength(2) boutiqueName: string;
  @IsString() phone: string;
  @IsBoolean() consentToShareContact: boolean;
}

class DisputeDto {
  @IsString() introductionId: string;
  @IsString() @MinLength(8) message: string;
}

class PayoutDto {
  @IsString() iban: string;
  @IsString() @MinLength(2) beneficiary: string;
}

class StatusDto {
  @IsString() toStatus: string;
  @IsOptional() @IsString() reasonCode?: string;
  @IsOptional() @IsString() partnerExplanation?: string;
  @IsOptional() @IsString() internalNote?: string;
  @IsOptional() @IsString() nextAction?: string;
  @IsOptional() @IsString() assignedStaffId?: string;
}

class OverrideDto {
  @IsString() @MinLength(8) reason: string;
}

class SyncDto {
  @IsString() orderId: string;
}

class TransitionDto {
  @IsIn(['held', 'available', 'paid'])
  to: 'held' | 'available' | 'paid';
}

class ClickDto {
  @IsString() code: string;
}

class SettingsDto {
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsIn(['OFF', 'PREVIEW', 'CANARY', 'LIVE']) mode?: 'OFF' | 'PREVIEW' | 'CANARY' | 'LIVE';
  @IsOptional() @IsBoolean() applyOpen?: boolean;
  @IsOptional() @IsString() termsVersion?: string;
  @IsOptional() @IsString() termsBody?: string;
  @IsOptional() @IsArray() pilotPhones?: string[];
  @IsOptional() @IsIn(['RATE_BPS', 'FIXED']) rewardKind?: 'RATE_BPS' | 'FIXED';
  @IsOptional() @IsInt() rewardRateBps?: number;
  @IsOptional() @IsInt() rewardFixedAmount?: number;
  @IsOptional() @IsInt() rewardCap?: number;
  @IsOptional() @IsInt() ownershipWindowDays?: number;
  @IsOptional() @IsInt() holdDays?: number;
  @IsOptional() @IsInt() minPayout?: number;
  @IsOptional() @IsString() payoutSchedule?: string;
  @IsOptional() @IsInt() salesResponseTargetHours?: number;
  @IsOptional() @IsString() boutiqueEligibilityNote?: string;
}

class ResolveDto {
  @IsString() @MinLength(8) resolution: string;
}

type AuthRequest = { user?: { id?: string; role?: string; referralPartnerId?: string } };

@Controller('boutique-referral')
export class WholesaleReferralPublicController {
  constructor(private readonly referrals: WholesaleReferralService) {}

  @Get('public-settings')
  publicSettings() {
    return this.referrals.publicSettings();
  }

  @Post('clicks')
  click(@Body() body: ClickDto) {
    return this.referrals.recordClick(body.code || '');
  }

  @Post('applications')
  apply(@Body() dto: ApplyDto) {
    return this.referrals.apply(dto);
  }

  @Post('applications/verify')
  verify(@Body() dto: VerifyDto) {
    return this.referrals.verifyApplication(dto);
  }

  @Post('auth/otp/request')
  requestLogin(@Body() dto: LoginDto) {
    return this.referrals.requestLogin(dto.phone);
  }

  @Post('auth/otp/verify')
  verifyLogin(@Body() dto: VerifyDto) {
    return this.referrals.verifyLogin(dto.phone, dto.code);
  }
}

@Controller('boutique-referral/me')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('REFERRAL_PARTNER')
export class WholesaleReferralPartnerController {
  constructor(private readonly referrals: WholesaleReferralService) {}

  @Get()
  home(@Req() req: AuthRequest) {
    return this.referrals.home(this.partnerId(req));
  }

  @Get('toolkit')
  toolkit(@Req() req: AuthRequest) {
    return this.referrals.toolkit(this.partnerId(req));
  }

  @Get('introductions')
  list(@Req() req: AuthRequest, @Query('q') q?: string) {
    return this.referrals.listMine(this.partnerId(req), q);
  }

  @Get('introductions/:id')
  one(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.referrals.getMine(this.partnerId(req), id);
  }

  @Post('introductions')
  manual(@Req() req: AuthRequest, @Body() dto: ManualDto) {
    return this.referrals.manualIntro(this.partnerId(req), dto);
  }

  @Post('disputes')
  dispute(@Req() req: AuthRequest, @Body() dto: DisputeDto) {
    return this.referrals.openDispute(this.partnerId(req), dto.introductionId, dto.message);
  }

  @Post('payout-profile')
  payout(@Req() req: AuthRequest, @Body() dto: PayoutDto) {
    return this.referrals.savePayout(this.partnerId(req), dto.iban, dto.beneficiary);
  }

  @Get('rewards')
  async rewards(@Req() req: AuthRequest) {
    const home = await this.referrals.home(this.partnerId(req));
    return {
      availableForPayout: home.availableForPayout,
      buckets: home.buckets,
      bucketLabels: home.bucketLabels,
      bucketDefinitions: home.bucketDefinitions,
      freshnessNote: home.freshnessNote,
    };
  }

  private partnerId(req: AuthRequest): string {
    return req.user?.referralPartnerId || '';
  }
}

@Controller('admin/boutique-referrals')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class WholesaleReferralAdminController {
  constructor(private readonly referrals: WholesaleReferralService) {}

  @Get('applications')
  applications(@Req() req: AuthRequest) {
    return this.referrals.adminApplications(req.user?.role || '');
  }

  @Post('applications/:id/approve')
  approve(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.referrals.approvePartner(req.user?.id || '', req.user?.role || '', id);
  }

  @Get('introductions')
  queue(@Req() req: AuthRequest, @Query('stage') stage?: string) {
    return this.referrals.adminQueue(req.user?.role || '', stage);
  }

  @Patch('introductions/:id')
  status(@Req() req: AuthRequest, @Param('id') id: string, @Body() dto: StatusDto) {
    return this.referrals.updateStatus(req.user?.id || '', req.user?.role || '', id, dto);
  }

  @Post('introductions/:id/ownership')
  override(@Req() req: AuthRequest, @Param('id') id: string, @Body() dto: OverrideDto) {
    return this.referrals.overrideOwnership(req.user?.id || '', req.user?.role || '', id, dto.reason);
  }

  @Post('orders/sync')
  sync(@Req() req: AuthRequest, @Body() dto: SyncDto) {
    return this.referrals.syncOrder(req.user?.id || '', req.user?.role || '', dto.orderId);
  }

  @Post('introductions/:id/reward')
  reward(@Req() req: AuthRequest, @Param('id') id: string, @Body() dto: TransitionDto) {
    return this.referrals.transitionReward(req.user?.id || '', req.user?.role || '', id, dto.to);
  }

  @Post('disputes/:id/resolve')
  resolve(@Req() req: AuthRequest, @Param('id') id: string, @Body() dto: ResolveDto) {
    return this.referrals.resolveDispute(req.user?.id || '', req.user?.role || '', id, dto.resolution);
  }

  @Get('report')
  report(@Req() req: AuthRequest) {
    return this.referrals.report(req.user?.role || '');
  }

  @Get('settings')
  @AdminOnly()
  adminSettings(@Req() req: AuthRequest) {
    return this.referrals.adminSettings(req.user?.role || '');
  }

  @Patch('settings')
  @AdminOnly()
  saveSettings(@Req() req: AuthRequest, @Body() body: SettingsDto) {
    return this.referrals.saveSettings(req.user?.id || '', req.user?.role || '', { ...body });
  }
}
