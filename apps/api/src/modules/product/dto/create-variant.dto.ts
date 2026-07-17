import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsNumber, Min } from 'class-validator';

export class CreateVariantDto {
  @ApiProperty({ example: 'سفید' })
  @IsString()
  @IsNotEmpty()
  color: string;

  @ApiPropertyOptional({ example: '#FFFFFF' })
  @IsOptional()
  @IsString()
  colorHex?: string;

  @ApiPropertyOptional({ example: 'محصول فری سایز', description: 'اگر خالی باشد از sizeType محصول پر می‌شود' })
  @IsOptional()
  @IsString()
  size?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  stock?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  barcode?: string;
}
