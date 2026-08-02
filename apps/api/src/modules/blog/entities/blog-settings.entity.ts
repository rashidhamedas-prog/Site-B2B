import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('blog_settings')
export class BlogSettingsEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  @Index()
  channel: string;

  @Column({ default: 'وبلاگ ترنم' })
  blogTitle: string;

  @Column({ type: 'text', default: '' })
  blogDescription: string;

  @Column({ type: 'int', default: 12 })
  articlesPerPage: number;

  @Column({ default: false })
  commentsEnabled: boolean;

  @Column({ default: true })
  rssEnabled: boolean;

  @Column({ type: 'uuid', nullable: true })
  defaultAuthorId: string | null;

  @Column({ type: 'uuid', nullable: true })
  defaultCategoryId: string | null;

  @Column({ nullable: true })
  defaultOgImage: string | null;

  @Column({ default: 'BlogPosting' })
  defaultSchemaType: string;

  @Column({ default: true })
  defaultRobotsIndex: boolean;

  @Column({ default: true })
  defaultRobotsFollow: boolean;

  @Column({ default: true })
  autoGenerateSlug: boolean;

  @Column({ default: true })
  autoCreateRedirect: boolean;

  @Column({ default: true })
  autoGenerateToc: boolean;

  @Column({ default: true })
  autoGenerateReadingTime: boolean;

  @Column({ default: true })
  showAuthor: boolean;

  @Column({ default: true })
  showPublishDate: boolean;

  @Column({ default: true })
  showReadingTime: boolean;

  @Column({ default: true })
  relatedArticlesEnabled: boolean;

  @Column({ default: true })
  relatedProductsEnabled: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
