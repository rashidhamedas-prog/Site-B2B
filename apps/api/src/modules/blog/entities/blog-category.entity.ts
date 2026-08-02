import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';

@Entity('blog_categories')
@Index('UQ_blog_categories_channel_slug', ['channel', 'slug'], { unique: true })
export class BlogCategoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** WHOLESALE | RETAIL */
  @Column()
  @Index()
  channel: string;

  @Column()
  name: string;

  @Column()
  slug: string;

  @Column({ nullable: true, type: 'text' })
  description: string | null;

  @Column({ nullable: true })
  seoTitle: string | null;

  @Column({ nullable: true, type: 'text' })
  metaDescription: string | null;

  @Column({ nullable: true })
  focusKeyword: string | null;

  @Column({ nullable: true, type: 'text' })
  canonicalUrl: string | null;

  @Column({ default: true })
  robotsIndex: boolean;

  @Column({ default: true })
  robotsFollow: boolean;

  @Column({ nullable: true })
  featuredImage: string | null;

  @Column({ type: 'uuid', nullable: true })
  parentId: string | null;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;
}
