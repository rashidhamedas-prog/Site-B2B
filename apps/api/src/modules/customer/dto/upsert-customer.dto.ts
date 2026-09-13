import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

const TYPES = ['B2B', 'B2C', 'WHOLESALE', 'RETAIL'] as const;
const BUSINESS_TYPES = ['RETAIL', 'WHOLESALE', 'ONLINE', 'BOUTIQUE'] as const;
const SEGMENTS = ['VIP', 'A', 'B', 'C'] as const;
const STATUSES = ['PENDING', 'ACTIVE', 'INACTIVE'] as const;

/** Create/update whitelist — never accepts balance, code, or id. */
export class UpsertCustomerDto {
  @ApiProperty({ example: 'بوتیک گل رز' })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  businessName: string;

  @ApiProperty({ example: 'محمد احمدی' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  ownerName: string;

  @ApiProperty({ example: '09120000000' })
  @IsString()
  @MinLength(10)
  @MaxLength(20)
  phone: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone2?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v !== '' && v != null)
  @IsEmail()
  @MaxLength(160)
  email?: string;

  @ApiProperty({ example: 'تهران' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  province: string;

  @ApiProperty({ example: 'تهران' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  city: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  nationalId?: string;

  @ApiPropertyOptional({ enum: TYPES })
  @IsOptional()
  @IsIn(TYPES)
  type?: string;

  @ApiPropertyOptional({ enum: BUSINESS_TYPES })
  @IsOptional()
  @IsIn(BUSINESS_TYPES)
  businessType?: string;

  @ApiPropertyOptional({ enum: SEGMENTS })
  @IsOptional()
  @IsIn(SEGMENTS)
  segment?: string;

  @ApiPropertyOptional({ enum: STATUSES })
  @IsOptional()
  @IsIn(STATUSES)
  status?: string;

  @ApiPropertyOptional({ description: 'سقف اعتبار به ریال' })
  @IsOptional()
  @IsInt()
  @Min(0)
  creditLimit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  referredBy?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  assignedAgentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  telegramId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  instagramHandle?: string;
}
