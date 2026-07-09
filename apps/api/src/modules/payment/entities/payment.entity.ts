import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

// Payment transaction record. Amounts in IRR (Rial) as BIGINT — no floating point.
@Entity('payments')
export class PaymentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'bigint' })
  amount: number; // IRR (Rial)

  @Column({ default: 'IRR' })
  currency: string;

  @Column({ default: 'ZARINPAL' })
  gateway: string; // ZARINPAL | MANUAL | CARD_TO_CARD

  // PENDING | PAID | FAILED | CANCELLED | REFUNDED
  @Column({ default: 'PENDING' })
  @Index()
  status: string;

  // Gateway-issued token used to build the redirect + verify the payment
  @Column({ nullable: true })
  @Index()
  authority: string;

  // Gateway reference id returned after a successful verification (receipt no.)
  @Column({ nullable: true })
  refId: string;

  @Column({ nullable: true })
  @Index()
  orderId: string;

  @Column({ nullable: true })
  invoiceId: string;

  @Column({ nullable: true })
  customerId: string;

  @Column({ nullable: true, type: 'text' })
  description: string;

  @Column({ nullable: true, type: 'text' })
  callbackUrl: string;

  // Free-form gateway response payload for auditing/debugging
  @Column({ nullable: true, type: 'jsonb' })
  meta: Record<string, any>;

  @Column({ nullable: true })
  paidAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
