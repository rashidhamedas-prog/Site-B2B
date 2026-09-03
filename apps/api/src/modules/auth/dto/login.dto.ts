import { IsIn, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { normalizePhone } from '../phone.util';

export class LoginDto {
  @ApiProperty({ example: '09151234567' })
  @Transform(({ value }) => normalizePhone(String(value ?? '')))
  @Matches(/^09[0-9]{9}$/, { message: 'شماره موبایل معتبر نیست' })
  phone: string;

  @ApiProperty({ minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;

  /** admin = staff-only; retail = .ir account; wholesale/portal/omitted = .com portal */
  @ApiPropertyOptional({ enum: ['admin', 'portal', 'retail', 'wholesale'] })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase() : value))
  @IsIn(['admin', 'portal', 'retail', 'wholesale'])
  purpose?: 'admin' | 'portal' | 'retail' | 'wholesale';
}
