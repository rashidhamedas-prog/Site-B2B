import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { VendorEntity } from './vendor.entity';
import { FulfillmentOrderEntity } from '../../order/entities/fulfillment-order.entity';
import { OrderEntity } from '../../order/entities/order.entity';

@Entity('vendor_ledger_entries')
@Index(['vendorId'])
@Index(['status', 'availableAt'])
export class VendorLedgerEntryEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  vendorId: string;

  @ManyToOne(() => VendorEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'vendorId' })
  vendor: VendorEntity;

  @Column({ type: 'uuid' })
  fulfillmentOrderId: string;

  @ManyToOne(() => FulfillmentOrderEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'fulfillmentOrderId' })
  fulfillmentOrder: FulfillmentOrderEntity;

  @Column({ type: 'uuid' })
  orderId: string;

  @ManyToOne(() => OrderEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: OrderEntity;

  @Column({ type: 'varchar', length: 32, default: 'COMMISSION_ACCRUAL' })
  entryType: string;

  /** Net IRR to partner (goods − commission). */
  @Column({ type: 'bigint' })
  amountIrr: number;

  @Column({ type: 'timestamptz' })
  availableAt: Date;

  @Column({ type: 'varchar', length: 16, default: 'HELD' })
  status: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
