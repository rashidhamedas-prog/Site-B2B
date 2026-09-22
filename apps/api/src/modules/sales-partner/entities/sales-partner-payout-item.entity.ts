import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('sales_partner_payout_items')
export class SalesPartnerPayoutItemEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  payoutId: string;

  @Column({ type: 'uuid', unique: true })
  ledgerEntryId: string;

  @Column({ type: 'bigint' })
  amountIrr: string;
}
