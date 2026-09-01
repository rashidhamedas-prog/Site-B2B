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

  /** Freight cost registered when shipping (IRR) */
  @Column({ type: 'bigint', default: 0 })
  freightCost: number;

  /** Shipping receipt image URL */
  @Column({ nullable: true })
  freightReceiptUrl: string;

  /** Invoice-time shipping fee fields (IRR) */
  @Column({ type: 'bigint', default: 0 })
  intraCityFee: number;

  @Column({ type: 'bigint', default: 0 })
  perKgFee: number;

  @Column({ default: false })
  freeShipping: boolean;

  @Column({ nullable: true, type: 'text' })
  notes: string;

  /** Optional CPA / affiliate click id (Yektanet etc.) */
  @Column({ nullable: true })
  affiliateId: string;

  /** Torob click id from ?torob_clid= — order attribution for Torob Sync */
  @Column({ nullable: true })
  torobClid: string;

  /** Wallet amount applied at create (IRR) — for clean reversal */
  @Column({ type: 'bigint', default: 0 })
  walletApplied: number;

  /** Discount code id used at create — for usedCount rollback */
  @Column({ nullable: true })
  discountCodeId: string;

  /** Client idempotency key — unique when set */
  @Column({ nullable: true, unique: true })
  idempotencyKey: string;

  /** Idempotency namespace, e.g. `${customerId}:${channel}:create-order` */
  @Column({ nullable: true })
  idempotencyScope: string;

  /** SHA-256 of stable create-order payload (scoped by idempotencyScope) */
  @Column({ nullable: true })
  idempotencyPayloadHash: string;

  /** Soft-void: row stays in admin list/details, excluded from customer flows */
  @Column({ nullable: true })
  voidedAt: Date;

  @Column({ nullable: true, type: 'text' })
  voidReason: string;

  /** Idempotent flag — stock/wallet/discount already reversed */
  @Column({ nullable: true })
  effectsReversedAt: Date;

  /** Channel stock deducted (settlement). Null = unpaid/pending hold, no warehouse move. */
  @Column({ nullable: true })
  stockCommittedAt: Date;

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
