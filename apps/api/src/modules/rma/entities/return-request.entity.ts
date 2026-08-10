import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

@Entity('return_requests')
@Index('IDX_return_requests_status_createdAt', ['status', 'createdAt'])
@Index('IDX_return_requests_customerId', ['customerId'])
@Index('IDX_return_requests_orderItemId', ['orderItemId'])
export class ReturnRequestEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  orderId: string;

  @Column()
  orderItemId: string;

  @Column()
  customerId: string;

  @Column({ type: 'text' })
  reason: string;

  @Column({ nullable: true })
  requestedSize: string;

  /** RETURN | EXCHANGE */
  @Column({ default: 'RETURN' })
  requestType: string;

  /** PENDING | APPROVED | REJECTED | COMPLETED */
  @Column({ default: 'PENDING' })
  status: string;

  /** WALLET | BANK | NONE */
  @Column({ default: 'WALLET' })
  refundType: string;

  @Column({ type: 'text', nullable: true })
  adminNote: string;

  /** One-time processing marker — unique when set (replay/CAS guard). */
  @Column({ type: 'varchar', nullable: true, unique: true })
  processingMarker: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  processedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  processedByUserId: string | null;

  @Column({ type: 'bigint', nullable: true })
  walletCreditAmount: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
