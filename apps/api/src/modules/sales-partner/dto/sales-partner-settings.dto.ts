import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PatchSalesPartnerSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ enum: ['OFF', 'PREVIEW', 'CANARY', 'LIVE'] })
  @IsOptional()
  @IsIn(['OFF', 'PREVIEW', 'CANARY', 'LIVE'])
  mode?: 'OFF' | 'PREVIEW' | 'CANARY' | 'LIVE';

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  applyOpen?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(168)
  draftTtlHours?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(3600)
  confirmResendCooldownSeconds?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  confirmResendDailyCap?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(180)
  commissionHoldDays?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  minPayoutIrr?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  dailyDraftCap?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  blockSelfReferral?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  termsVersion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^$|^09[0-9]{9}$/)
  canaryPhone?: string;
}
