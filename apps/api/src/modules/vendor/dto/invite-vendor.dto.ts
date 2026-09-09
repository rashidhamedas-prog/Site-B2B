import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { normalizePhone } from '../../auth/phone.util';

export class InviteVendorDto {
  @ApiProperty({ example: 'کیف نور' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @ApiProperty({ example: '09151234567' })
  @Transform(({ value }) => normalizePhone(String(value ?? '')))
  @Matches(/^09[0-9]{9}$/, { message: 'شماره موبایل معتبر نیست' })
  phone: string;

  @ApiProperty({ example: 12, description: 'مهلت قبول سفارش (ساعت)' })
  @IsInt()
  @Min(1)
  @Max(168)
  acceptSlaHours: number;

  @ApiProperty({ example: 7, description: 'روز hold قبل از تسویه' })
  @IsInt()
  @Min(0)
  @Max(90)
  settlementHoldDays: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
