import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, Unique,
} from 'typeorm';

/** Idempotent inbound provider/callback events (Phase 2 residual). */
@Entity('payment_events')
@Unique('UQ_payment_events_provider_external', ['providerCode', 'externalEventId'])
export class PaymentEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  providerCode: string;

  /** Provider-unique event id (authority, webhook id, refId+status, …). */
  @Column()
  externalEventId: string;

  @Column()
  eventType: string;

  @Column({ nullable: true })
  payloadHash: string;

  @Column({ default: false })
  signatureValid: boolean;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  receivedAt: Date;

  @Column({ nullable: true, type: 'timestamptz' })
  processedAt: Date;

  /** RECEIVED | PROCESSED | IGNORED | FAILED */
  @Column({ default: 'RECEIVED' })
  @Index()
  processingStatus: string;

  @Column({ nullable: true })
  paymentId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
