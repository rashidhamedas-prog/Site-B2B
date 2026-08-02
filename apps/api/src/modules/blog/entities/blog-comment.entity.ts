import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

@Entity('blog_comments')
export class BlogCommentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  articleId: string;

  @Column()
  name: string;

  @Column()
  email: string;

  @Column({ type: 'text' })
  content: string;

  /** PENDING | APPROVED | REJECTED | SPAM */
  @Column({ default: 'PENDING' })
  @Index()
  status: string;

  @Column({ type: 'uuid', nullable: true })
  parentId: string | null;

  @Column({ nullable: true })
  ipHash: string | null;

  @Column({ nullable: true, type: 'text' })
  userAgent: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
