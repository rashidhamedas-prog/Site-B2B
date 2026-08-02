import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';

@Entity('blog_tags')
@Index('UQ_blog_tags_channel_slug', ['channel', 'slug'], { unique: true })
export class BlogTagEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

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

  /** Low-content tags default noindex */
  @Column({ default: false })
  robotsIndex: boolean;

  @Column({ default: true })
  robotsFollow: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;
}
