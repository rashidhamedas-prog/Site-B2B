import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
  IsBoolean,
  IsArray,
  IsIn,
  IsObject,
  ValidateIf,
} from 'class-validator';

export class CreateProductDto {
  @ApiPropertyOptional({
    example: 'LINEN-00001',
    description: 'اگر ارسال نشود، از روی دسته‌بندی تولید می‌شود',
  })
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

  @ApiPropertyOptional({ description: 'قدیمی — از specs.fabricType استفاده کنید' })
  @IsOptional()
  @IsString()
  fabric?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fabricComposition?: string;

  @ApiPropertyOptional({ description: 'توضیحات SEO' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'مشخصات محصول (توضیحات محصول)' })
  @IsOptional()
  @IsObject()
  specs?: Record<string, unknown>;

  @ApiPropertyOptional({ enum: ['TWO', 'THREE', 'FREE'], default: 'FREE' })
  @IsOptional()
  @IsIn(['TWO', 'THREE', 'FREE'])
  sizeType?: string;

  @ApiProperty({
    description:
      'قیمت نهایی عمده (بعد از تخفیف، ریال). ستون DB غیرقابل‌null است؛ همیشه مثبت الزامی است.',
  })
  @IsNumber()
  @Min(1)
  wholesalePrice: number;

  @ApiPropertyOptional({
    description:
      'قیمت نهایی تکی (بعد از تخفیف، ریال). وقتی showOnRetail !== false الزامی و مثبت است؛ وقتی کانال تکی خاموش است می‌تواند null باشد.',
  })
  @ValidateIf((o: CreateProductDto) => o.showOnRetail !== false)
  @IsNumber()
  @Min(1)
  retailPrice?: number | null;

  @ApiPropertyOptional({
    description:
      'قیمت قبل از تخفیف تکی / compare-at (ریال); اختیاری و باید اکیداً > retailPrice باشد',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  retailCompareAtPrice?: number | null;

  @ApiPropertyOptional({
    description:
      'قیمت قبل از تخفیف عمده / compare-at (ریال); اختیاری و باید اکیداً > wholesalePrice باشد',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  wholesaleCompareAtPrice?: number | null;

  @ApiPropertyOptional({ description: 'نمایش در عمده', default: true })
  @IsOptional()
  @IsBoolean()
  showOnWholesale?: boolean;

  @ApiPropertyOptional({ description: 'نمایش در فروشگاه تکی', default: true })
  @IsOptional()
  @IsBoolean()
  showOnRetail?: boolean;

  @ApiPropertyOptional({ description: 'ویژه در ویترین تکی', default: false })
  @IsOptional()
  @IsBoolean()
  retailFeatured?: boolean;

  @ApiPropertyOptional({ default: 5 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  minOrderQty?: number;

  @ApiPropertyOptional({
    description: 'اجازه انتخاب رنگ به مشتری عمده',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  allowWholesaleColorSelect?: boolean;

  @ApiPropertyOptional({
    description: 'حداقل تعداد رنگ قابل انتخاب در سفارش عمده',
    default: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  minWholesaleColors?: number;

  @ApiPropertyOptional({ enum: ['ACTIVE', 'ARCHIVED', 'OUT_OF_STOCK', 'COMING_SOON'] })
  @IsOptional()
  @IsIn(['ACTIVE', 'ARCHIVED', 'OUT_OF_STOCK', 'COMING_SOON'])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDiscounted?: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  seoMeta?: Record<string, string>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  collectionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPreOrder?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  preOrderDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  modelInfo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  videoUrl?: string;
}
