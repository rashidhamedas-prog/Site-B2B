import { IsBoolean, IsEmail, IsIn, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { STAFF_ROLES } from '../staff-access';
import { BLOG_ROLES } from '../../blog/blog-roles';

export class UpdateStaffUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' && value.trim() ? value.trim() : undefined))
  @IsEmail({}, { message: 'ایمیل معتبر نیست' })
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ enum: STAFF_ROLES })
  @IsOptional()
  @IsIn([...STAFF_ROLES], { message: 'نقش نامعتبر است' })
  role?: string;

  @ApiPropertyOptional({ enum: BLOG_ROLES })
  @IsOptional()
  @IsIn([...BLOG_ROLES], { message: 'نقش وبلاگ نامعتبر است' })
  blogRole?: string | null;
}
