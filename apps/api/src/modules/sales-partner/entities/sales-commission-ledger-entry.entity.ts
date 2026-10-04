import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('sales_commission_ledger_entries')
export class SalesCommissionLedgerEntryEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  salesPartnerId: string;

  @Column({ type: 'uuid', nullable: true })
  orderId: string | null;

  @Column({ type: 'uuid', nullable: true })
  orderItemId: string | null;

  @Column({ type: 'bigint' })
  amountIrr: string;

  @Column({ type: 'varchar', length: 32 })
  entryType: string;

  @Column({ type: 'timestamptz', nullable: true })
  availableAt: Date | null;

  @Column({ type: 'varchar', length: 80, unique: true })
  idempotencyKey: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  reasonCode: string | null;

  /** held | available — which bucket a reversal reduces. Null on earnings. */
  @Column({ type: 'varchar', length: 16, nullable: true })
  bucket: string | null;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string | null;

  @Column({ type: 'uuid', nullable: true })
  payoutId: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
