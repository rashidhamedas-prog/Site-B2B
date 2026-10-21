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
@Index('IDX_analytics_event_log_status_next', ['status', 'nextAttemptAt'])
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
   * PENDING → SENDING (server claimed, leased) → SENT (2xx = transport accepted
   * only, not payload validity) | FAILED (transient, retried at nextAttemptAt) |
   * INVALID (schema/4xx, terminal) | EXPIRED (71h old or attempts exhausted).
   * CLIENT_FALLBACK: browser owns it; server never sends. SKIPPED: not tracked.
   * Server-owned: SENDING, SENT, FAILED, INVALID, EXPIRED.
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

  /** Short code only (http_500, timeout, network, schema_invalid:<field>…). */
  @Column({ type: 'text', nullable: true })
  lastError: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  sentAt: Date | null;

  /** Original purchase time; sent as timestamp_micros on every attempt. */
  @Column({ type: 'timestamptz', nullable: true })
  eventAt: Date | null;

  /** When a FAILED row is next due (backoff schedule). */
  @Column({ type: 'timestamptz', nullable: true })
  nextAttemptAt: Date | null;

  /** SENDING claim lease; an expired lease lets another worker reclaim. */
  @Column({ type: 'timestamptz', nullable: true })
  leaseUntil: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
