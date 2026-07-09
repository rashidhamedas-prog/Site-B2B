import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
  DeleteDateColumn, Index,
} from 'typeorm';

@Entity('blog_posts')
export class BlogPostEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  slug: string;

  @Column()
  title: string;

  @Column({ nullable: true, type: 'text' })
  excerpt: string;

  @Column({ type: 'text' })
  content: string; // Markdown

  @Column({ nullable: true })
  coverImage: string;

  @Column({ default: 'عمومی' })
  category: string;

  @Column({ type: 'simple-array', nullable: true })
  tags: string[];

  // DRAFT | PUBLISHED
  @Column({ default: 'DRAFT' })
  @Index()
  status: string;

  @Column({ nullable: true })
  publishedAt: Date;

  @Column({ default: 0 })
  views: number;

  @Column({ nullable: true })
  seoTitle: string;

  @Column({ nullable: true, type: 'text' })
  seoDescription: string;

  @Column({ nullable: true })
  authorName: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
