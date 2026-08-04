import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsArray,
  IsIn,
  IsUUID,
  MinLength,
  MaxLength,
  Min,
  Max,
  ValidateNested,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';

const STATUSES = [
  'DRAFT',
  'IN_REVIEW',
  'NEEDS_REVISION',
  'APPROVED',
  'SCHEDULED',
  'PUBLISHED',
  'UNPUBLISHED',
  'ARCHIVED',
] as const;

export class FaqItemDto {
  @IsOptional() @IsString() id?: string;
  @IsString() @MinLength(3) question!: string;
  @IsString() @MinLength(3) answer!: string;
  @IsOptional() @IsNumber() sortOrder?: number;
  @IsOptional() @IsBoolean() isVisible?: boolean;
  @IsOptional() @IsBoolean() includeInSchema?: boolean;
}

export class CtaDto {
  @IsString() title!: string;
  @IsOptional() @IsString() description?: string;
  @IsString() buttonText!: string;
  @IsString() buttonUrl!: string;
  @IsOptional() @IsBoolean() openInNewTab?: boolean;
  @IsOptional() @IsString() style?: string;
}

export class CreateBlogPostDto {
  @IsIn(['RETAIL', 'WHOLESALE'])
  channel!: 'RETAIL' | 'WHOLESALE';

  @IsString() @MinLength(5) @MaxLength(250)
  title!: string;

  @IsOptional() @IsString() @MaxLength(250)
  slug?: string;

  @IsOptional() @IsString() @MaxLength(600)
  excerpt?: string;

  @IsString() @MinLength(20)
  content!: string;

  @IsOptional() @IsIn(['HTML', 'MARKDOWN', 'EDITOR_JSON'])
  contentFormat?: string;

  @IsOptional() @IsString()
  coverImage?: string;

  @IsOptional() @IsString()
  category?: string;

  @IsOptional() @IsUUID()
  categoryId?: string;

  @IsOptional() @IsArray() @IsString({ each: true })
  tags?: string[];

  @IsOptional() @IsIn([...STATUSES])
  status?: string;

  @IsOptional() @IsString()
  seoTitle?: string;

  @IsOptional() @IsString()
  seoDescription?: string;

  @IsOptional() @IsString()
  focusKeyword?: string;

  @IsOptional() @IsArray() @IsString({ each: true })
  secondaryKeywords?: string[];

  @IsOptional() @IsIn(['INFORMATIONAL', 'COMMERCIAL', 'TRANSACTIONAL', 'NAVIGATIONAL'])
  searchIntent?: string;

  @IsOptional() @IsIn(['SELF', 'CUSTOM', 'NONE'])
  canonicalType?: string;

  @IsOptional() @IsString()
  canonicalUrl?: string;

  @IsOptional() @IsBoolean() robotsIndex?: boolean;
  @IsOptional() @IsBoolean() robotsFollow?: boolean;
  @IsOptional() @IsBoolean() robotsNoArchive?: boolean;
  @IsOptional() @IsBoolean() robotsNoSnippet?: boolean;
  @IsOptional() @IsNumber() maxSnippet?: number;
  @IsOptional() @IsIn(['none', 'standard', 'large']) maxImagePreview?: string;

  @IsOptional() @IsString() ogTitle?: string;
  @IsOptional() @IsString() ogDescription?: string;
  @IsOptional() @IsString() ogImage?: string;
  @IsOptional() @IsString() twitterTitle?: string;
  @IsOptional() @IsString() twitterDescription?: string;
  @IsOptional() @IsString() twitterImage?: string;
  @IsOptional() @IsIn(['summary', 'summary_large_image']) twitterCard?: string;

  @IsOptional() @IsIn(['Article', 'BlogPosting', 'NewsArticle', 'HowTo', 'FAQPage'])
  schemaType?: string;

  @IsOptional() @IsBoolean() breadcrumbEnabled?: boolean;
  @IsOptional() @IsBoolean() articleSchemaEnabled?: boolean;
  @IsOptional() @IsBoolean() faqSchemaEnabled?: boolean;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => FaqItemDto)
  faqItems?: FaqItemDto[];

  @IsOptional() @ValidateNested() @Type(() => CtaDto)
  primaryCta?: CtaDto;

  @IsOptional() @ValidateNested() @Type(() => CtaDto)
  secondaryCta?: CtaDto;

  @IsOptional() @IsArray() @IsString({ each: true }) relatedProductIds?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) relatedArticleIds?: string[];

  @IsOptional() @IsBoolean() tableOfContentsEnabled?: boolean;
  @IsOptional() @IsNumber() @Min(2) @Max(4) tableOfContentsDepth?: number;
  @IsOptional() @IsBoolean() sitemapEnabled?: boolean;
  @IsOptional() @IsNumber() @Min(0) @Max(1) sitemapPriority?: number;
  @IsOptional() @IsString() sitemapChangeFrequency?: string;
  @IsOptional() @IsBoolean() rssEnabled?: boolean;
  @IsOptional() @IsBoolean() isCornerstone?: boolean;
  @IsOptional() @IsBoolean() isEvergreen?: boolean;
  @IsOptional() @IsBoolean() redirectOnSlugChange?: boolean;
  @IsOptional() @IsString() authorName?: string;
  @IsOptional() @IsUUID() authorId?: string;
  @IsOptional() @IsUUID() reviewerId?: string;
  @IsOptional() @IsString() publishAt?: string;
  @IsOptional() @IsObject() howToData?: Record<string, unknown>;
  @IsOptional() @IsBoolean() howToSchemaEnabled?: boolean;
  @IsOptional() @IsBoolean() commentsEnabled?: boolean;
  @IsOptional() @IsIn(['MANUAL', 'AUTOMATIC', 'HYBRID']) relatedArticleMode?: string;
}

/** Partial update — all fields optional; validate only present ones */
export class UpdateBlogPostDto {
  @IsOptional() @IsIn(['RETAIL', 'WHOLESALE']) channel?: 'RETAIL' | 'WHOLESALE';
  @IsOptional() @IsString() @MinLength(5) @MaxLength(250) title?: string;
  @IsOptional() @IsString() @MaxLength(250) slug?: string;
  @IsOptional() @IsString() @MaxLength(600) excerpt?: string;
  @IsOptional() @IsString() @MinLength(20) content?: string;
  @IsOptional() @IsIn(['HTML', 'MARKDOWN', 'EDITOR_JSON']) contentFormat?: string;
  @IsOptional() @IsString() coverImage?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
  @IsOptional() @IsIn([...STATUSES]) status?: string;
  @IsOptional() @IsString() seoTitle?: string;
  @IsOptional() @IsString() seoDescription?: string;
  @IsOptional() @IsString() focusKeyword?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) secondaryKeywords?: string[];
  @IsOptional() @IsIn(['INFORMATIONAL', 'COMMERCIAL', 'TRANSACTIONAL', 'NAVIGATIONAL']) searchIntent?: string;
  @IsOptional() @IsIn(['SELF', 'CUSTOM', 'NONE']) canonicalType?: string;
  @IsOptional() @IsString() canonicalUrl?: string;
  @IsOptional() @IsBoolean() robotsIndex?: boolean;
  @IsOptional() @IsBoolean() robotsFollow?: boolean;
  @IsOptional() @IsBoolean() robotsNoArchive?: boolean;
  @IsOptional() @IsBoolean() robotsNoSnippet?: boolean;
  @IsOptional() @IsNumber() maxSnippet?: number;
  @IsOptional() @IsIn(['none', 'standard', 'large']) maxImagePreview?: string;
  @IsOptional() @IsString() ogTitle?: string;
  @IsOptional() @IsString() ogDescription?: string;
  @IsOptional() @IsString() ogImage?: string;
  @IsOptional() @IsString() twitterTitle?: string;
  @IsOptional() @IsString() twitterDescription?: string;
  @IsOptional() @IsString() twitterImage?: string;
  @IsOptional() @IsIn(['summary', 'summary_large_image']) twitterCard?: string;
  @IsOptional() @IsIn(['Article', 'BlogPosting', 'NewsArticle', 'HowTo', 'FAQPage']) schemaType?: string;
  @IsOptional() @IsBoolean() breadcrumbEnabled?: boolean;
  @IsOptional() @IsBoolean() articleSchemaEnabled?: boolean;
  @IsOptional() @IsBoolean() faqSchemaEnabled?: boolean;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => FaqItemDto) faqItems?: FaqItemDto[];
  @IsOptional() @ValidateNested() @Type(() => CtaDto) primaryCta?: CtaDto;
  @IsOptional() @ValidateNested() @Type(() => CtaDto) secondaryCta?: CtaDto;
  @IsOptional() @IsArray() @IsString({ each: true }) relatedProductIds?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) relatedArticleIds?: string[];
  @IsOptional() @IsBoolean() tableOfContentsEnabled?: boolean;
  @IsOptional() @IsNumber() @Min(2) @Max(4) tableOfContentsDepth?: number;
  @IsOptional() @IsBoolean() sitemapEnabled?: boolean;
  @IsOptional() @IsNumber() @Min(0) @Max(1) sitemapPriority?: number;
  @IsOptional() @IsString() sitemapChangeFrequency?: string;
  @IsOptional() @IsBoolean() rssEnabled?: boolean;
  @IsOptional() @IsBoolean() isCornerstone?: boolean;
  @IsOptional() @IsBoolean() isEvergreen?: boolean;
  @IsOptional() @IsBoolean() redirectOnSlugChange?: boolean;
  @IsOptional() @IsString() authorName?: string;
  @IsOptional() @IsUUID() authorId?: string;
  @IsOptional() @IsUUID() reviewerId?: string;
  @IsOptional() @IsString() publishAt?: string;
  @IsOptional() @IsObject() howToData?: Record<string, unknown>;
  @IsOptional() @IsBoolean() howToSchemaEnabled?: boolean;
  @IsOptional() @IsBoolean() commentsEnabled?: boolean;
  @IsOptional() @IsIn(['MANUAL', 'AUTOMATIC', 'HYBRID']) relatedArticleMode?: string;
}

export class DeleteBlogPostDto {
  @IsOptional() @IsIn(['REDIRECT_ARTICLE', 'REDIRECT_CATEGORY', 'GONE', 'UNPUBLISH'])
  strategy?: 'REDIRECT_ARTICLE' | 'REDIRECT_CATEGORY' | 'GONE' | 'UNPUBLISH';
  @IsOptional() @IsString() redirectTarget?: string;
  @IsOptional() @IsBoolean() hard?: boolean;
}

export class ImportBlogDto {
  @IsOptional() @IsIn(['json', 'markdown', 'html', 'text']) format?: string;
  @IsOptional() @IsObject() article?: Record<string, unknown>;
  @IsOptional() @IsString() markdown?: string;
  @IsOptional() @IsIn(['RETAIL', 'WHOLESALE']) channel?: 'RETAIL' | 'WHOLESALE';
}

export class CreateCategoryDto {
  @IsIn(['RETAIL', 'WHOLESALE']) channel!: 'RETAIL' | 'WHOLESALE';
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsOptional() @IsString() slug?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() seoTitle?: string;
  @IsOptional() @IsString() metaDescription?: string;
  @IsOptional() @IsBoolean() robotsIndex?: boolean;
  @IsOptional() @IsBoolean() robotsFollow?: boolean;
  @IsOptional() @IsNumber() sortOrder?: number;
}

export class CreateTagDto {
  @IsIn(['RETAIL', 'WHOLESALE']) channel!: 'RETAIL' | 'WHOLESALE';
  @IsString() @MinLength(2) @MaxLength(80) name!: string;
  @IsOptional() @IsString() slug?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsBoolean() robotsIndex?: boolean;
}

export class CreateRedirectDto {
  @IsIn(['RETAIL', 'WHOLESALE']) channel!: 'RETAIL' | 'WHOLESALE';
  @IsString() sourcePath!: string;
  @IsOptional() @IsString() destinationUrl?: string;
  @IsOptional() @IsIn([301, 302, 307, 308, 410]) statusCode?: number;
  @IsOptional() @IsIn(['SLUG_CHANGED', 'ARTICLE_DELETED', 'CONTENT_MERGED', 'MANUAL', 'GONE']) reason?: string;
}

export class CreateAuthorDto {
  @IsOptional() @IsUUID() userId?: string;
  @IsString() @MinLength(2) displayName!: string;
  @IsOptional() @IsString() slug?: string;
  @IsOptional() @IsString() bio?: string;
  @IsOptional() @IsString() avatarUrl?: string;
  @IsOptional() @IsString() jobTitle?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) expertise?: string[];
  @IsOptional() @IsBoolean() authorPageEnabled?: boolean;
  @IsOptional() @IsBoolean() robotsIndex?: boolean;
  @IsOptional() @IsString() instagramUrl?: string;
  @IsOptional() @IsString() linkedinUrl?: string;
  @IsOptional() @IsString() websiteUrl?: string;
}

export class TransitionDto {
  @IsOptional() @IsString() note?: string;
  @IsOptional() @IsString() publishAt?: string;
}
