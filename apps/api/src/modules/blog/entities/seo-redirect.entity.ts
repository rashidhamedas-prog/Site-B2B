import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('seo_redirects')
@Index('UQ_seo_redirects_channel_source', ['channel', 'sourcePath'], { unique: true })
export class SeoRedirectEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  channel: string;

  @Column()
  sourcePath: string;

  @Column({ type: 'text' })
  destinationUrl: string;

  /** 301 | 302 | 307 | 308 */
  @Column({ type: 'int', default: 301 })
  statusCode: number;

  /** SLUG_CHANGED | ARTICLE_DELETED | CONTENT_MERGED | MANUAL */
  @Column({ default: 'MANUAL' })
  reason: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'int', default: 0 })
  hitCount: number;

  @Column({ nullable: true })
  lastHitAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
