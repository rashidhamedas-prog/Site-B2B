import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Append-only customer store-credit ledger (Medusa/Shopify store-credit pattern).
 * Never UPDATE/DELETE from app code. Amounts are positive BIGINT IRR.
 * customers.balance is the cached projection updated in the same transaction.
 */
@Entity('customer_wallet_entries')
export class CustomerWalletEntryEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index('IDX_customer_wallet_customerId')
  customerId: string;

  /** CREDIT | DEBIT */
  @Column({ type: 'varchar', length: 16 })
  direction: string;

  @Column({ type: 'bigint' })
  amount: number;

  @Column({ type: 'varchar', length: 32 })
  reasonCode: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  referenceType: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  referenceId: string | null;

  @Column({ type: 'varchar', length: 120, unique: true })
  idempotencyKey: string;

  @Column({ type: 'uuid', nullable: true })
  actorUserId: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note: string | null;

  @Column({ type: 'bigint' })
  balanceAfter: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
