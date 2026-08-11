import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/**
 * Append-only RMA financial audit. Never UPDATE/DELETE these rows from app code.
 */
@Entity('return_request_audits')
@Index('IDX_return_request_audits_requestId', ['returnRequestId'])
@Index('UQ_return_request_audits_marker', ['processingMarker'], { unique: true })
export class ReturnRequestAuditEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  returnRequestId: string;

  /** Actor who performed the transition (admin user id). */
  @Column({ type: 'uuid', nullable: true })
  actorUserId: string | null;

  @Column({ type: 'varchar' })
  fromStatus: string;

  @Column({ type: 'varchar' })
  toStatus: string;

  /** Same CAS marker as return_requests.processingMarker — unique for replay safety. */
  @Column({ type: 'varchar', nullable: true })
  processingMarker: string | null;

  @Column({ type: 'varchar', nullable: true })
  requestType: string | null;

  @Column({ type: 'varchar', nullable: true })
  refundType: string | null;

  @Column({ type: 'bigint', nullable: true })
  walletCreditAmount: number | null;

  @Column({ type: 'uuid', nullable: true })
  variantId: string | null;

  @Column({ type: 'int', nullable: true })
  stockBefore: number | null;

  @Column({ type: 'int', nullable: true })
  stockAfter: number | null;

  @Column({ type: 'varchar', nullable: true })
  correlationId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  meta: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
