import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateVariantDto {
  @ApiProperty({ example: 'سفید' })
  @IsString()
  @IsNotEmpty()
  color: string;

  @ApiPropertyOptional({ example: '#FFFFFF' })
  @IsOptional()
  @IsString()
  colorHex?: string;

  @ApiPropertyOptional({ example: 'سایز ۱', description: 'اگر خالی باشد از sizeType محصول پر می‌شود' })
  @IsOptional()
  @IsString()
  size?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  barcode?: string;

  /** Absolute wholesale stock for this color/size (synced onto product) */
  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  wholesaleStock?: number;

  /** Absolute retail stock for this color/size */
  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  retailStock?: number;

  /** Legacy alias — applied to wholesaleStock when wholesaleStock omitted */
  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  stock?: number;

  /** Optional photo URL for this color (applied to all size rows) */
  @ApiPropertyOptional({ example: 'https://cdn.example.com/products/red.jpg' })
  @IsOptional()
  @IsString()
  imageUrl?: string;
}
