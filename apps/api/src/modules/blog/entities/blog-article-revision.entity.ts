import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index,
} from 'typeorm';

@Entity('blog_article_revisions')
@Index('IDX_blog_revisions_article', ['articleId', 'versionNumber'])
export class BlogArticleRevisionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  articleId: string;

  @Column({ type: 'int' })
  versionNumber: number;

  @Column({ type: 'jsonb' })
  snapshot: Record<string, unknown>;

  @Column({ nullable: true, type: 'text' })
  changeSummary: string | null;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
