import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn,
  CreateDateColumn, UpdateDateColumn, DeleteDateColumn,
} from 'typeorm';
import { CustomerEntity } from '../../customer/entities/customer.entity';
import { OrderItemEntity } from './order-item.entity';

@Entity('orders')
export class OrderEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  orderNumber: string;

  @ManyToOne(() => CustomerEntity)
  @JoinColumn({ name: 'customerId' })
  customer: CustomerEntity;

  @Column()
  customerId: string;

  @Column({ default: 'WHOLESALE' })
  type: string;

  @Column({ default: 'PENDING_REVIEW' })
  status: string;

  @Column({ type: 'bigint' })
  subtotal: number;

  @Column({ type: 'bigint', default: 0 })
  discount: number;

  @Column({ type: 'bigint', default: 0 })
  shippingFee: number;

  @Column({ type: 'bigint' })
  total: number;

  @Column({ default: 'CREDIT' })
  paymentMethod: string;

  @Column({ default: 'CHAPAR' })
  shippingMethod: string;

  @Column({ nullable: true, type: 'text' })
  shippingAddress: string;

  @Column({ nullable: true })
  trackingCode: string;

  @Column({ nullable: true, type: 'text' })
  notes: string;

  @Column({ nullable: true })
  confirmedAt: Date;

  @Column({ nullable: true })
  shippedAt: Date;

  @Column({ nullable: true })
  deliveredAt: Date;

  @Column({ nullable: true })
  processedBy: string;

  @OneToMany(() => OrderItemEntity, (i) => i.order, { cascade: true })
  items: OrderItemEntity[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
