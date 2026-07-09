import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
  DeleteDateColumn, Index,
} from 'typeorm';

// Static/managed content pages (about, terms, shipping-info, FAQ, banners...).
@Entity('cms_pages')
export class CmsPageEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  slug: string;

  @Column()
  title: string;

  @Column({ type: 'text' })
  content: string; // Markdown

  // PAGE | BANNER | FAQ
  @Column({ default: 'PAGE' })
  kind: string;

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
