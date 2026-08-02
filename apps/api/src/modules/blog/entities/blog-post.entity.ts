import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';

export type BlogPostStatus =
  | 'DRAFT'
  | 'IN_REVIEW'
  | 'NEEDS_REVISION'
  | 'APPROVED'
  | 'SCHEDULED'
  | 'PUBLISHED'
  | 'UNPUBLISHED'
  | 'ARCHIVED';

@Entity('blog_posts')
@Index('UQ_blog_posts_channel_slug', ['channel', 'slug'], { unique: true })
export class BlogPostEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  slug: string;

  @Column()
  title: string;

  @Column({ nullable: true, type: 'text' })
  excerpt: string;

  @Column({ type: 'text' })
  content: string;

  /** HTML | MARKDOWN | EDITOR_JSON */
  @Column({ default: 'MARKDOWN' })
  contentFormat: string;

  @Column({ nullable: true })
  coverImage: string;

  /** Legacy free-text category label (kept for backward compat) */
  @Column({ default: 'عمومی' })
  category: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  categoryId: string | null;

  /** WHOLESALE | RETAIL */
  @Column({ default: 'WHOLESALE' })
  @Index()
  channel: string;

  @Column({ type: 'simple-array', nullable: true })
  tags: string[];

  @Column({ default: 'DRAFT' })
  @Index()
  status: BlogPostStatus | string;

  @Column({ nullable: true })
  publishedAt: Date | null;

  @Column({ nullable: true })
  publishAt: Date | null;

  @Column({ default: 0 })
  views: number;

  @Column({ nullable: true })
  seoTitle: string;

  @Column({ nullable: true, type: 'text' })
  seoDescription: string;

  @Column({ nullable: true })
  focusKeyword: string;

  @Column({ type: 'simple-array', nullable: true })
  secondaryKeywords: string[];

  /** INFORMATIONAL | COMMERCIAL | TRANSACTIONAL | NAVIGATIONAL */
  @Column({ nullable: true })
  searchIntent: string;

  /** SELF | CUSTOM | NONE */
  @Column({ default: 'SELF' })
  canonicalType: string;

  @Column({ nullable: true, type: 'text' })
  canonicalUrl: string;

  @Column({ default: true })
  robotsIndex: boolean;

  @Column({ default: true })
  robotsFollow: boolean;

  @Column({ default: false })
  robotsNoArchive: boolean;

  @Column({ default: false })
  robotsNoSnippet: boolean;

  @Column({ type: 'int', nullable: true })
  maxSnippet: number | null;

  /** none | standard | large */
  @Column({ default: 'large' })
  maxImagePreview: string;

  @Column({ type: 'int', nullable: true })
  maxVideoPreview: number | null;

  @Column({ nullable: true })
  ogTitle: string;

  @Column({ nullable: true, type: 'text' })
  ogDescription: string;

  @Column({ nullable: true })
  ogImage: string;

  @Column({ nullable: true })
  twitterTitle: string;

  @Column({ nullable: true, type: 'text' })
  twitterDescription: string;

  @Column({ nullable: true })
  twitterImage: string;

  /** summary | summary_large_image */
  @Column({ default: 'summary_large_image' })
  twitterCard: string;

  /** Article | BlogPosting | NewsArticle | HowTo | FAQPage */
  @Column({ default: 'BlogPosting' })
  schemaType: string;

  @Column({ default: true })
  breadcrumbEnabled: boolean;

  @Column({ default: true })
  articleSchemaEnabled: boolean;

  @Column({ default: false })
  faqSchemaEnabled: boolean;

  @Column({ type: 'jsonb', nullable: true, default: [] })
  faqItems: Array<{
    id?: string;
    question: string;
    answer: string;
    sortOrder?: number;
    isVisible?: boolean;
    includeInSchema?: boolean;
  }> | null;

  @Column({ type: 'jsonb', nullable: true })
  primaryCta: {
    title: string;
    description?: string;
    buttonText: string;
    buttonUrl: string;
    openInNewTab?: boolean;
    style?: string;
  } | null;

  @Column({ type: 'jsonb', nullable: true })
  secondaryCta: {
    title: string;
    description?: string;
    buttonText: string;
    buttonUrl: string;
    openInNewTab?: boolean;
    style?: string;
  } | null;

  @Column({ type: 'simple-array', nullable: true })
  relatedProductIds: string[];

  @Column({ type: 'simple-array', nullable: true })
  relatedArticleIds: string[];

  @Column({ type: 'int', default: 0 })
  readingTimeMinutes: number;

  @Column({ type: 'int', default: 0 })
  wordCount: number;

  @Column({ default: true })
  tableOfContentsEnabled: boolean;

  @Column({ type: 'int', default: 3 })
  tableOfContentsDepth: number;

  @Column({ default: true })
  sitemapEnabled: boolean;

  @Column({ type: 'float', default: 0.6 })
  sitemapPriority: number;

  @Column({ default: 'monthly' })
  sitemapChangeFrequency: string;

  @Column({ default: true })
  rssEnabled: boolean;

  @Column({ default: false })
  isCornerstone: boolean;

  @Column({ default: false })
  isEvergreen: boolean;

  @Column({ default: true })
  redirectOnSlugChange: boolean;

  @Column({ nullable: true })
  authorName: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  authorId: string | null;

  @Column({ type: 'uuid', nullable: true })
  reviewerId: string | null;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string | null;

  @Column({ type: 'uuid', nullable: true })
  updatedBy: string | null;

  /** Optimistic lock / autosave version */
  @Column({ type: 'int', default: 1 })
  version: number;

  @Column({ type: 'jsonb', nullable: true })
  howToData: {
    name: string;
    description?: string;
    totalTime?: string;
    estimatedCost?: { currency: string; value: number };
    supplies?: string[];
    tools?: string[];
    steps?: Array<{
      id?: string;
      title: string;
      description: string;
      imageId?: string;
      urlAnchor?: string;
      sortOrder?: number;
    }>;
  } | null;

  @Column({ default: true })
  howToSchemaEnabled: boolean;

  @Column({ default: true })
  commentsEnabled: boolean;

  /** MANUAL | AUTOMATIC | HYBRID */
  @Column({ default: 'HYBRID' })
  relatedArticleMode: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;
}
