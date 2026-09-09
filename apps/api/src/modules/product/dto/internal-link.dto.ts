import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsIn, IsNumber, MaxLength } from 'class-validator';

export const INTERNAL_LINK_TARGET_TYPES = ['PRODUCT', 'CATEGORY', 'BLOG', 'CUSTOM'] as const;
export const INTERNAL_LINK_RELS = ['dofollow', 'nofollow', 'sponsored'] as const;

/**
 * One internal link as sent by the admin UI. `id` is a client-generated uuid
 * used only for stable React keys; the server reassigns its own PK on save.
 */
export class InternalLinkItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  id?: string;

  @ApiPropertyOptional({ enum: INTERNAL_LINK_TARGET_TYPES })
  @IsString()
  @IsNotEmpty()
  @IsIn(INTERNAL_LINK_TARGET_TYPES as unknown as string[])
  targetType: string;

  @ApiPropertyOptional({ description: 'شناسه هدف برای PRODUCT/CATEGORY/BLOG' })
  @IsOptional()
  @IsString()
  targetId?: string | null;

  @ApiPropertyOptional({ description: 'URL حل‌شده (برای CUSTOM یا denormalized)' })
  @IsString()
  @IsNotEmpty()
  targetUrl: string;

  @ApiPropertyOptional({ description: 'متن انکر (۱ تا ۶۰ کاراکتر)' })
  @IsString()
  @IsNotEmpty()
  anchorText: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string | null;

  @ApiPropertyOptional({ description: 'تصویر راهنما (آپلود ادمین؛ اختیاری)' })
  @IsOptional()
  @IsString()
  @MaxLength(700)
  imageUrl?: string | null;

  @ApiPropertyOptional({ description: 'توضیح کوتاه راهنما (اختیاری، حداکثر ۱۴۰ کاراکتر)' })
  @IsOptional()
  @IsString()
  @MaxLength(180)
  excerpt?: string | null;

  @ApiPropertyOptional({ enum: INTERNAL_LINK_RELS, default: 'dofollow' })
  @IsOptional()
  @IsIn(INTERNAL_LINK_RELS as unknown as string[])
  rel?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

/** Shape returned to clients (admin + storefront). */
export interface InternalLinkView {
  id: string;
  targetType: string;
  targetId: string | null;
  targetUrl: string;
  anchorText: string;
  title: string | null;
  /** Admin override; empty means use the target page image. */
  imageUrl: string | null;
  /** Admin override; empty means use the target page excerpt. */
  excerpt: string | null;
  /** Merged display image (override or target). */
  cardImageUrl: string | null;
  /** Merged display excerpt (override or target). */
  cardExcerpt: string | null;
  rel: string;
  sortOrder: number;
}
