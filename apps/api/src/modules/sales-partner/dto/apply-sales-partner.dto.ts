import { IsBoolean, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { normalizePhone } from '../../auth/phone.util';

export class ApplySalesPartnerDto {
  @ApiProperty()
  @IsString()
  @MaxLength(80)
  displayName: string;

  @ApiProperty({ example: '09151234567' })
  @Transform(({ value }) => normalizePhone(String(value ?? '')))
  @Matches(/^09[0-9]{9}$/, { message: 'شماره موبایل معتبر نیست' })
  phone: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  instagram?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  telegram?: string;

  @ApiProperty()
  @IsBoolean()
  acceptTerms: boolean;
}

export class VerifySalesPartnerApplicationDto {
  @ApiProperty()
  @Transform(({ value }) => normalizePhone(String(value ?? '')))
  @Matches(/^09[0-9]{9}$/, { message: 'شماره موبایل معتبر نیست' })
  phone: string;

  @ApiProperty()
  @IsString()
  @MaxLength(8)
  code: string;
}

export class SalesPartnerOtpDto {
  @ApiProperty()
  @Transform(({ value }) => normalizePhone(String(value ?? '')))
  @Matches(/^09[0-9]{9}$/, { message: 'شماره موبایل معتبر نیست' })
  phone: string;
}

export class SalesPartnerOtpVerifyDto extends SalesPartnerOtpDto {
  @ApiProperty()
  @IsString()
  @MaxLength(8)
  code: string;
}

export class SalesPartnerPasswordLoginDto extends SalesPartnerOtpDto {
  @ApiProperty()
  @IsString()
  password: string;
}

export class ReviewSalesPartnerDto {
  @ApiProperty({ enum: ['APPROVE', 'NEED_INFO', 'REJECT'] })
  @IsString()
  @Matches(/^(APPROVE|NEED_INFO|REJECT)$/)
  action: 'APPROVE' | 'NEED_INFO' | 'REJECT';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class PatchSalesPartnerStatusDto {
  @ApiProperty({ enum: ['ACTIVE', 'SUSPENDED', 'CLOSED'] })
  @IsString()
  @Matches(/^(ACTIVE|SUSPENDED|CLOSED)$/)
  status: 'ACTIVE' | 'SUSPENDED' | 'CLOSED';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
