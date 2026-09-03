import { IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { normalizeOtpCode, normalizePhone } from '../phone.util';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../password-policy';

export class ForgotPasswordDto {
  @ApiProperty({ example: '09151234567' })
  @Transform(({ value }) => normalizePhone(String(value ?? '')))
  @Matches(/^09[0-9]{9}$/, { message: 'شماره موبایل معتبر نیست' })
  phone: string;
}

export class ResetPasswordDto {
  @ApiProperty({ example: '09151234567' })
  @Transform(({ value }) => normalizePhone(String(value ?? '')))
  @Matches(/^09[0-9]{9}$/, { message: 'شماره موبایل معتبر نیست' })
  phone: string;

  @ApiProperty({ example: '123456' })
  @Transform(({ value }) => normalizeOtpCode(String(value ?? '')))
  @IsString()
  @Matches(/^[0-9]{4,8}$/, { message: 'کد تایید نامعتبر است' })
  code: string;

  @ApiProperty({ minLength: PASSWORD_MIN_LENGTH })
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH, { message: 'رمز عبور حداقل ۸ کاراکتر باشد' })
  @MaxLength(PASSWORD_MAX_LENGTH)
  password: string;

  @ApiProperty({ required: false, enum: ['retail', 'wholesale', 'portal'] })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase() : value))
  @IsIn(['retail', 'wholesale', 'portal'])
  purpose?: 'retail' | 'wholesale' | 'portal';
}

export class SetPasswordDto {
  @ApiProperty({ minLength: PASSWORD_MIN_LENGTH })
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH, { message: 'رمز عبور حداقل ۸ کاراکتر باشد' })
  @MaxLength(PASSWORD_MAX_LENGTH)
  password: string;
}
