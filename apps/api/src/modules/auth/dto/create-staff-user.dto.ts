import { IsEmail, IsIn, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { normalizePhone } from '../phone.util';
import { STAFF_ROLES } from '../staff-access';
import { BLOG_ROLES } from '../../blog/blog-roles';

export class CreateStaffUserDto {
  @ApiProperty({ example: '09151234567' })
  @Transform(({ value }) => normalizePhone(String(value ?? '')))
  @Matches(/^09[0-9]{9}$/, { message: 'شماره موبایل معتبر نیست' })
  phone: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' && value.trim() ? value.trim() : undefined))
  @IsEmail({}, { message: 'ایمیل معتبر نیست' })
  email?: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'رمز عبور حداقل ۸ کاراکتر' })
  password: string;

  @ApiProperty({ enum: STAFF_ROLES, default: 'ADMIN' })
  @IsOptional()
  @IsIn([...STAFF_ROLES], { message: 'نقش نامعتبر است' })
  role?: string;

  @ApiPropertyOptional({ enum: BLOG_ROLES })
  @IsOptional()
  @IsIn([...BLOG_ROLES], { message: 'نقش وبلاگ نامعتبر است' })
  blogRole?: string;
}
