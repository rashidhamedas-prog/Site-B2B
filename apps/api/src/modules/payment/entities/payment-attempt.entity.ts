import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * One gateway start/verify attempt for a payment.
 * Enables recovery after failed start without inventing a new payment row.
 * Amounts are BIGINT IRR integers.
 */
@Entity('payment_attempts')
@Index('UQ_payment_attempts_payment_attemptNo', ['paymentId', 'attemptNo'], {
  unique: true,
})
export class PaymentAttemptEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index('IDX_payment_attempts_paymentId')
  paymentId: string;

  @Column({ type: 'varchar', default: 'ZARINPAL' })
  providerCode: string;

  @Column({ type: 'int', default: 1 })
  attemptNo: number;

  @Column({ type: 'varchar', nullable: true })
  @Index('IDX_payment_attempts_idempotencyKey')
  idempotencyKey: string | null;

  @Column({ type: 'varchar', nullable: true })
  providerToken: string | null;

  @Column({ type: 'varchar', nullable: true })
  providerTransactionId: string | null;

  @Column({ type: 'bigint' })
  amount: number;

  @Column({ type: 'varchar', default: 'IRR' })
  currency: string;

  /** PENDING | REDIRECTED | FAILED | EXPIRED | VERIFIED */
  @Column({ type: 'varchar', default: 'PENDING' })
  @Index('IDX_payment_attempts_status')
  status: string;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  requestFingerprint: string | null;

  /** Sanitized request snapshot — never store merchant secrets. */
  @Column({ type: 'jsonb', nullable: true })
  sanitizedRequest: Record<string, unknown> | null;

  /** Sanitized provider response — never store merchant secrets. */
  @Column({ type: 'jsonb', nullable: true })
  sanitizedResponse: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
