import { IsArray, IsIn, IsInt, IsOptional, IsString, Min, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';

export class ErpMatrixVariantDto {
  @IsString()
  erpVariantSku: string;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsString()
  color: string;

  @IsString()
  size: string;

  @IsInt()
  @Min(0)
  qty: number;
}

export class ErpMatrixUpsertDto {
  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @IsIn(['WHOLESALE', 'RETAIL'])
  channel: 'WHOLESALE' | 'RETAIL';

  @IsString()
  productSku: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ErpMatrixVariantDto)
  variants: ErpMatrixVariantDto[];

  /** When true, resolve mapping only — do not write stock. */
  @IsOptional()
  dryRun?: boolean;
}

export class ErpMatrixBulkDto {
  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ErpMatrixUpsertDto)
  items: ErpMatrixUpsertDto[];
}
