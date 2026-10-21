import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, Unique,
} from 'typeorm';

/**
 * Exactly-once ledger for server-side GA4 events (Measurement Protocol).
 * Unique (eventName, transactionId) prevents duplicate purchase on retry/refresh.
 * No PII is stored here.
 */
@Entity('analytics_event_log')
@Unique('UQ_analytics_event_log_event_txn', ['eventName', 'transactionId'])
export class AnalyticsEventLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** e.g. purchase */
  @Column({ length: 40 })
  eventName: string;

  /** Order number (GA4 transaction_id). */
  @Column({ length: 64 })
  transactionId: string;

  @Column({ length: 20 })
  channel: string;

  @Column({ length: 20, nullable: true })
  measurementId: string | null;

  @Column({ type: 'uuid', nullable: true })
  @Index('IDX_analytics_event_log_order')
  orderId: string | null;

  @Column({ type: 'uuid', nullable: true })
  paymentId: string | null;

  /**
   * PENDING | SENDING | SENT | FAILED (server-owned, retried by job) |
   * CLIENT_FALLBACK (browser owns it; server never sends) | SKIPPED
   */
  @Column({ length: 16, default: 'PENDING' })
  @Index('IDX_analytics_event_log_status')
  status: string;

  /** Pseudonymous `_ga` client id, kept only so FAILED rows can be retried. */
  @Column({ length: 32, nullable: true })
  gaClientId: string | null;

  @Column({ length: 20, nullable: true })
  gaSessionId: string | null;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ type: 'bigint', default: 0 })
  valueIrr: number;

  @Column({ type: 'text', nullable: true })
  lastError: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  sentAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
