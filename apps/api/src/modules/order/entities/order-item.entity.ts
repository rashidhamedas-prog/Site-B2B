import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn,
} from 'typeorm';
import { OrderEntity } from './order.entity';

@Entity('order_items')
export class OrderItemEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => OrderEntity, (o) => o.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: OrderEntity;

  @Column()
  orderId: string;

  @Column()
  productVariantId: string;

  @Column()
  productName: string;

  @Column()
  sku: string;

  @Column()
  color: string;

  @Column()
  size: string;

  /** Snapshot of the color photo at order time (optional) */
  @Column({ nullable: true })
  imageUrl: string;

  @Column()
  quantity: number;

  @Column({ type: 'bigint' })
  unitPrice: number;

  @Column({ type: 'bigint' })
  totalPrice: number;

  @CreateDateColumn()
  createdAt: Date;
}
