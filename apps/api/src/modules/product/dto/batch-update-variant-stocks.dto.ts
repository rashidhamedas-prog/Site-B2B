import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class VariantStockItemDto {
  @ApiProperty({ description: 'شناسه واریانت' })
  @IsUUID()
  id: string;

  @ApiPropertyOptional({ example: 6 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  wholesaleStock?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  retailStock?: number;
}

export class BatchUpdateVariantStocksDto {
  @ApiProperty({ type: [VariantStockItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => VariantStockItemDto)
  items: VariantStockItemDto[];
}
