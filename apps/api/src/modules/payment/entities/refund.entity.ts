import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * Refund lifecycle (wallet vs provider paths separated via refundChannel).
 * Idempotent per (paymentId, idempotencyKey). Amounts BIGINT IRR.
 */
@Entity('refunds')
@Index('UQ_refunds_payment_idempotency', ['paymentId', 'idempotencyKey'], {
  unique: true,
})
export class RefundEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index('IDX_refunds_paymentId')
  paymentId: string;

  @Column({ type: 'bigint' })
  amount: number;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  /** REQUESTED | PROCESSING | SUCCEEDED | FAILED | CANCELLED */
  @Column({ type: 'varchar', default: 'REQUESTED' })
  @Index('IDX_refunds_status')
  status: string;

  /** WALLET | PROVIDER | MANUAL */
  @Column({ type: 'varchar', default: 'WALLET' })
  refundChannel: string;

  @Column({ type: 'varchar', nullable: true })
  providerRefundId: string | null;

  @Column({ type: 'varchar' })
  idempotencyKey: string;

  @Column({ type: 'uuid', nullable: true })
  requestedBy: string | null;

  @Column({ type: 'varchar', nullable: true })
  failureCode: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  requestedAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
