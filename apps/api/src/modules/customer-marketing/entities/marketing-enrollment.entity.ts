import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

@Entity('marketing_enrollments')
@Index('UQ_marketing_enrollments_customer_funnel', ['customerId', 'funnelId'], { unique: true })
@Index('IDX_marketing_enrollments_next', ['status', 'nextRunAt'])
export class MarketingEnrollmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  customerId: string;

  @Column()
  funnelId: string;

  @Column({ length: 24, default: 'ACTIVE' })
  status: 'ACTIVE' | 'COMPLETED' | 'PAUSED';

  @Column({ length: 64, nullable: true })
  currentStepCode: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  nextRunAt: Date | null;

  @Column({ length: 16, default: 'NONE' })
  nextActionType: 'CALL' | 'SMS' | 'NONE';

  @Column({ type: 'uuid', nullable: true })
  enrolledByUserId: string | null;

  @CreateDateColumn()
  enrolledAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
