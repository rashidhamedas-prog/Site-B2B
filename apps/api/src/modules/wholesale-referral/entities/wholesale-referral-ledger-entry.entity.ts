import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('wholesale_referral_ledger_entries')
export class WholesaleReferralLedgerEntryEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  partnerId: string;

  @Index()
  @Column({ type: 'uuid' })
  introductionId: string;

  @Column({ type: 'uuid', nullable: true })
  orderId: string | null;

  @Column({ type: 'varchar', length: 40 })
  entryType: string;

  @Column({ type: 'varchar', length: 16 })
  bucket: string;

  @Column({ type: 'bigint' })
  amount: number;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 160 })
  idempotencyKey: string;

  @Column({ type: 'jsonb', nullable: true })
  ruleSnapshot: Record<string, unknown> | null;

  @Column({ type: 'uuid', nullable: true })
  reversesEntryId: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
