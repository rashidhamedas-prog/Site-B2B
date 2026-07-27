import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
  DeleteDateColumn, Index, Unique,
} from 'typeorm';

// Static/managed content pages (about, terms, shipping-info, FAQ, banners...).
@Entity('cms_pages')
@Unique(['slug', 'channel'])
export class CmsPageEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  slug: string;

  @Column()
  title: string;

  @Column({ type: 'text', default: '' })
  content: string; // Markdown / plain fallback

  // PAGE | BANNER | FAQ | LANDING
  @Column({ default: 'PAGE' })
  kind: string;

  /** WHOLESALE | RETAIL */
  @Column({ default: 'WHOLESALE' })
  @Index()
  channel: string;

  /**
   * Structured page blocks selected in admin:
   * [{ id, type: 'hero'|'text'|'image'|'gallery'|'faq'|'cta'|'html'|'products', props }]
   */
  @Column({ type: 'jsonb', default: [] })
  blocks: Array<Record<string, unknown>>;

  // DRAFT | PUBLISHED
  @Column({ default: 'PUBLISHED' })
  @Index()
  status: string;

  @Column({ nullable: true })
  seoTitle: string;

  @Column({ nullable: true, type: 'text' })
  seoDescription: string;

  // Extra structured payload (banner image/link, FAQ items, etc.)
  @Column({ nullable: true, type: 'jsonb' })
  meta: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
