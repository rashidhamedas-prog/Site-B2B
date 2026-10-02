import {
  IsArray,
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { normalizePhone } from '../../auth/phone.util';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../../auth/password-policy';

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  province?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10)
  nationalId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  salesExperience?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  primaryChannel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  referrer?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivation?: string;

  @ApiPropertyOptional({ description: 'Extra/custom field answers keyed by field key' })
  @IsOptional()
  @IsObject()
  answers?: Record<string, string | boolean>;

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

export class SalesPartnerSetPasswordDto {
  @ApiProperty({ minLength: PASSWORD_MIN_LENGTH })
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH, { message: 'رمز عبور حداقل ۸ کاراکتر باشد' })
  @MaxLength(PASSWORD_MAX_LENGTH)
  password: string;

  @ApiPropertyOptional({ description: 'Required when changing an existing known password' })
  @IsOptional()
  @IsString()
  @MaxLength(PASSWORD_MAX_LENGTH)
  currentPassword?: string;
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

export class ApplyFormFieldOptionDto {
  @ApiProperty()
  @IsString()
  @MaxLength(40)
  value: string;

  @ApiProperty()
  @IsString()
  @MaxLength(80)
  label: string;
}

export class ApplyFormFieldDto {
  @ApiProperty()
  @IsString()
  @MaxLength(40)
  key: string;

  @ApiProperty()
  @IsBoolean()
  enabled: boolean;

  @ApiProperty()
  @IsBoolean()
  required: boolean;

  @ApiProperty()
  @IsString()
  @MaxLength(80)
  label: string;

  @ApiProperty()
  order: number;

  @ApiProperty({ enum: ['text', 'textarea', 'select', 'phone', 'national_id', 'checkbox'] })
  @IsString()
  @Matches(/^(text|textarea|select|phone|national_id|checkbox)$/)
  type: 'text' | 'textarea' | 'select' | 'phone' | 'national_id' | 'checkbox';

  @ApiPropertyOptional({ type: [ApplyFormFieldOptionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApplyFormFieldOptionDto)
  options?: ApplyFormFieldOptionDto[];

  @ApiPropertyOptional()
  @IsOptional()
  maxLength?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  locked?: boolean;
}
