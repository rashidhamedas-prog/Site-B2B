import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RequestRetailOtpDto {
  @ApiProperty({ example: '09151234567' })
  @Matches(/^09[0-9]{9}$/, { message: 'شماره موبایل معتبر نیست' })
  phone: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;
}

export class VerifyRetailOtpDto {
  @ApiProperty({ example: '09151234567' })
  @Matches(/^09[0-9]{9}$/, { message: 'شماره موبایل معتبر نیست' })
  phone: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Matches(/^[0-9]{4,8}$/, { message: 'کد تایید نامعتبر است' })
  code: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;
}

export class UpdateProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  ownerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  email?: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(6)
  current: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;
}
