import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, Unique,
} from 'typeorm';

/**
 * Visual + textual content for storefront pages (hero, banners, copy, images).
 * One row per (channel, pageKey).
 */
@Entity('site_contents')
@Unique(['channel', 'pageKey'])
export class SiteContentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** WHOLESALE | RETAIL */
  @Column()
  @Index()
  channel: string;

  /** e.g. home, about, contact, shipping, returns, products, collections */
  @Column()
  @Index()
  pageKey: string;

  @Column()
  title: string;

  /** Structured blocks: { id, type, props }[] */
  @Column({ type: 'jsonb', default: [] })
  blocks: Array<Record<string, unknown>>;

  @Column({ nullable: true, type: 'jsonb' })
  seo: Record<string, string> | null;

  @Column({ default: true })
  isPublished: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
