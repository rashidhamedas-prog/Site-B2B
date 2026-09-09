import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { OrderEntity } from './order.entity';
import { FulfillmentOrderItemEntity } from './fulfillment-order-item.entity';

@Entity('fulfillment_orders')
@Index(['orderId', 'parcelIndex'], { unique: true })
export class FulfillmentOrderEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  orderId: string;

  @ManyToOne(() => OrderEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: OrderEntity;

  /** null = Taranom OWN */
  @Column({ type: 'uuid', nullable: true })
  @Index()
  vendorId: string | null;

  @Column({ type: 'int' })
  parcelIndex: number;

  /** Customer-safe unlabeled name, e.g. مرسوله ۱ */
  @Column({ type: 'varchar', length: 32 })
  parcelLabel: string;

  @Column({ type: 'varchar', length: 24, default: 'PENDING_ACCEPT' })
  status: string;

  @Column({ type: 'timestamptz', nullable: true })
  acceptBy: Date | null;

  @Column({ type: 'bigint', default: 0 })
  goodsTotal: number;

  /** Always 0 — customer shippingFee stays on parent order. */
  @Column({ type: 'bigint', default: 0 })
  shippingFee: number;

  @Column({ type: 'bigint', default: 0 })
  commissionTotal: number;

  @OneToMany(() => FulfillmentOrderItemEntity, (i) => i.fulfillmentOrder, { cascade: true })
  items: FulfillmentOrderItemEntity[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
