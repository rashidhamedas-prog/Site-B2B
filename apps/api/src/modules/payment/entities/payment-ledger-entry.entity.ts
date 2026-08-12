import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Append-only payment ledger (manual/online/refund/adjustments).
 * Never UPDATE/DELETE from app code. Amounts BIGINT IRR integers.
 */
@Entity('payment_ledger_entries')
export class PaymentLedgerEntryEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  @Index('IDX_payment_ledger_paymentId')
  paymentId: string | null;

  @Column({ type: 'uuid', nullable: true })
  @Index('IDX_payment_ledger_orderId')
  orderId: string | null;

  @Column({ type: 'uuid', nullable: true })
  @Index('IDX_payment_ledger_invoiceId')
  invoiceId: string | null;

  /**
   * CHARGE | CAPTURE | MANUAL_PAYMENT | REFUND | ADJUSTMENT | VOID
   */
  @Column({ type: 'varchar' })
  @Index('IDX_payment_ledger_entryType')
  entryType: string;

  /** Signed BIGINT IRR — positive = inbound, negative = outbound/refund. */
  @Column({ type: 'bigint' })
  amount: number;

  @Column({ type: 'varchar', default: 'IRR' })
  currency: string;

  /** Partial unique when set — enforced in migration. */
  @Column({ type: 'varchar', nullable: true })
  @Index('IDX_payment_ledger_idempotencyKey')
  idempotencyKey: string | null;

  @Column({ type: 'uuid', nullable: true })
  actorUserId: string | null;

  @Column({ type: 'varchar', nullable: true })
  correlationId: string | null;

  /** Sanitized audit snapshot — never store secrets or raw PSP payloads. */
  @Column({ type: 'jsonb', nullable: true })
  meta: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
