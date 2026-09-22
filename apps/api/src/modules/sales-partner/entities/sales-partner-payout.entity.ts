import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('sales_partner_payouts')
export class SalesPartnerPayoutEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  salesPartnerId: string;

  @Column({ type: 'varchar', length: 24, default: 'DRAFT' })
  status: string;

  @Column({ type: 'bigint' })
  amountIrr: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  bankReference: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  method: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  @Column({ type: 'uuid' })
  createdBy: string;

  @Column({ type: 'varchar', length: 240, nullable: true })
  note: string | null;

  @Column({ type: 'varchar', length: 240, nullable: true })
  receiptKey: string | null;

  @Column({ type: 'varchar', length: 80, unique: true })
  idempotencyKey: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
