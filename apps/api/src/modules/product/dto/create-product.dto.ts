import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString, IsNotEmpty, IsOptional, IsNumber, Min, IsBoolean,
  IsArray, IsIn,
} from 'class-validator';

export class CreateProductDto {
  @ApiPropertyOptional({ example: 'LINEN-00001', description: 'اگر ارسال نشود، از روی دسته‌بندی تولید می‌شود' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  sku?: string;

  @ApiPropertyOptional({ description: 'شناسه دسته‌بندی برای تولید خودکار SKU' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiProperty({ example: 'مانتو بهار' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'لینن' })
  @IsString()
  @IsNotEmpty()
  fabric: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fabricComposition?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'قیمت عمده به ریال' })
  @IsNumber()
  @Min(0)
  wholesalePrice: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  retailPrice?: number;

  @ApiPropertyOptional({ default: 5 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  minOrderQty?: number;

  @ApiPropertyOptional({ enum: ['ACTIVE', 'ARCHIVED', 'OUT_OF_STOCK'] })
  @IsOptional()
  @IsIn(['ACTIVE', 'ARCHIVED', 'OUT_OF_STOCK'])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isNew?: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];
}
