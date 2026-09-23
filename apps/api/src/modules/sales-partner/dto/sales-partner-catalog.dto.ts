import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { COMMISSION_SCOPES } from '../sales-commission-policy';

export class SetSalesPartnerEligibilityDto {
  @ApiProperty()
  @IsBoolean()
  eligible: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedImageKeys?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(80)
  partnerPercent?: number;
}

export class CreateSalesCommissionRuleDto {
  @ApiProperty({ enum: COMMISSION_SCOPES })
  @IsIn(COMMISSION_SCOPES)
  scope: (typeof COMMISSION_SCOPES)[number];

  @ApiProperty()
  @IsInt()
  @Min(0)
  @Max(80)
  percent: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  salesPartnerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(240)
  note?: string;
}

export class PreviewSalesCommissionDto {
  @ApiProperty()
  @IsUUID()
  salesPartnerId: string;

  @ApiProperty()
  @IsUUID()
  productId: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  lineTotalIrr: number;
}
