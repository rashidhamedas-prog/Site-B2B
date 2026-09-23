import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('sales_partner_order_drafts')
export class SalesPartnerOrderDraftEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  salesPartnerId: string;

  @Index()
  @Column({ type: 'varchar', length: 32, default: 'DRAFT' })
  status: string;

  @Column({ type: 'varchar', length: 15, nullable: true })
  customerPhone: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  customerPhoneHash: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  customerName: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  confirmationTokenHash: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  @Column({ type: 'int', default: 0 })
  sentCount: number;

  @Column({ type: 'timestamptz', nullable: true })
  lastSentAt: Date | null;

  @Column({ type: 'uuid', nullable: true, unique: true })
  convertedOrderId: string | null;

  @Column({ type: 'int', default: 0 })
  estimatedCommissionIrr: number;

  @Column({ type: 'int', default: 0 })
  merchandiseIrr: number;

  @Column({ type: 'int', default: 0 })
  shippingFeeIrr: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
