import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ConfirmSalesPartnerPayoutDto {
  @ApiProperty()
  @IsUUID()
  salesPartnerId: string;

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

export class PatchSalesPartnerIbanDto {
  @ApiProperty()
  @IsString({ message: 'شماره شبا معتبر نیست' })
  @MinLength(24, { message: 'شماره شبا باید ۲۴ رقم بعد از IR باشد' })
  @MaxLength(80, { message: 'شماره شبا معتبر نیست' })
  iban: string;
}
