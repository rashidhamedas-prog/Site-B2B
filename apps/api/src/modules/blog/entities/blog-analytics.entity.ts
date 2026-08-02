import {
  Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn, Index,
} from 'typeorm';

@Entity('blog_analytics')
export class BlogAnalyticsEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  @Index()
  articleId: string;

  @Column({ type: 'int', default: 0 })
  pageViews: number;

  @Column({ type: 'int', default: 0 })
  uniqueViews: number;

  @Column({ type: 'float', nullable: true })
  avgEngagementTime: number | null;

  @Column({ type: 'int', default: 0 })
  scroll25: number;

  @Column({ type: 'int', default: 0 })
  scroll50: number;

  @Column({ type: 'int', default: 0 })
  scroll75: number;

  @Column({ type: 'int', default: 0 })
  scroll90: number;

  @Column({ type: 'int', default: 0 })
  ctaClicks: number;

  @Column({ type: 'int', default: 0 })
  productClicks: number;

  @Column({ type: 'int', default: 0 })
  internalLinkClicks: number;

  @UpdateDateColumn()
  updatedAt: Date;
}
