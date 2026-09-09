import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { FulfillmentOrderEntity } from './fulfillment-order.entity';
import { OrderItemEntity } from './order-item.entity';

@Entity('fulfillment_order_items')
export class FulfillmentOrderItemEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  fulfillmentOrderId: string;

  @ManyToOne(() => FulfillmentOrderEntity, (fo) => fo.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'fulfillmentOrderId' })
  fulfillmentOrder: FulfillmentOrderEntity;

  @Column({ type: 'uuid' })
  orderItemId: string;

  @ManyToOne(() => OrderItemEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderItemId' })
  orderItem: OrderItemEntity;

  @Column()
  productName: string;

  @Column()
  sku: string;

  @Column()
  color: string;

  @Column()
  size: string;

  @Column({ nullable: true })
  imageUrl: string | null;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'bigint' })
  lineTotal: number;

  @Column({ type: 'int', nullable: true })
  commissionPercent: number | null;

  @Column({ type: 'bigint', default: 0 })
  commissionAmount: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
