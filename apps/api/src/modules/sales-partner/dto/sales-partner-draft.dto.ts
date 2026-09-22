import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { normalizePhone } from '../../auth/phone.util';

export class SalesPartnerDraftItemInputDto {
  @ApiProperty()
  @IsUUID()
  productId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  variantId?: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(20)
  quantity: number;
}

export class CreateSalesPartnerDraftDto {
  @ApiProperty({ type: [SalesPartnerDraftItemInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => SalesPartnerDraftItemInputDto)
  items: SalesPartnerDraftItemInputDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (value ? normalizePhone(String(value)) : undefined))
  @Matches(/^09[0-9]{9}$/, { message: 'شماره موبایل معتبر نیست' })
  customerPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  customerName?: string;
}

export class PatchSalesPartnerDraftDto {
  @ApiPropertyOptional({ type: [SalesPartnerDraftItemInputDto] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => SalesPartnerDraftItemInputDto)
  items?: SalesPartnerDraftItemInputDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (value ? normalizePhone(String(value)) : undefined))
  @Matches(/^09[0-9]{9}$/, { message: 'شماره موبایل معتبر نیست' })
  customerPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  customerName?: string;
}

export class ConfirmSalesPartnerDraftDto {
  @ApiProperty()
  @IsString()
  @MaxLength(80)
  recipientName: string;

  @ApiProperty()
  @IsString()
  @MaxLength(80)
  province: string;

  @ApiProperty()
  @IsString()
  @MaxLength(80)
  city: string;

  @ApiProperty()
  @IsString()
  @MaxLength(400)
  address: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['ONLINE', 'CASH'])
  paymentMethod?: 'ONLINE' | 'CASH';

  @ApiProperty()
  @IsBoolean()
  consent: boolean;
}
