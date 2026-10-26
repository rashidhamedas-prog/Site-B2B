import { IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ConfirmSalesPartnerPayoutDto {
  @ApiProperty()
  @IsUUID()
  salesPartnerId: string;

  @ApiProperty({ description: 'Available balance the admin saw; must match allocation or confirm returns 409' })
  @IsInt()
  @Min(1)
  expectedAmountIrr: number;

  @ApiProperty()
  @IsString()
  @MinLength(4)
  @MaxLength(80)
  bankReference: string;

  @ApiProperty()
  @IsString()
  @MinLength(4)
  @MaxLength(80)
  idempotencyKey: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  method?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(240)
  note?: string;
}

export class ReverseSalesPartnerPayoutDto {
  @ApiProperty()
  @IsString()
  @MinLength(8)
  @MaxLength(240)
  reason: string;
}

export class PatchSalesPartnerIbanDto {
  @ApiProperty()
  @IsString({ message: 'شماره شبا معتبر نیست' })
  @MinLength(24, { message: 'شماره شبا باید ۲۴ رقم بعد از IR باشد' })
  @MaxLength(80, { message: 'شماره شبا معتبر نیست' })
  iban: string;

  @ApiPropertyOptional({ description: 'Required unless this session has a fresh OTP password grant' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  currentPassword?: string;
}
