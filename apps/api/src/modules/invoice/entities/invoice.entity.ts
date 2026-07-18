import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,
  CreateDateColumn, UpdateDateColumn, DeleteDateColumn,
} from 'typeorm';
import { CustomerEntity } from '../../customer/entities/customer.entity';

@Entity('invoices')
export class InvoiceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  invoiceNumber: string;

  @Column({ default: 'PROFORMA' })
  type: string;

  @ManyToOne(() => CustomerEntity)
  @JoinColumn({ name: 'customerId' })
  customer: CustomerEntity;

  @Column()
  customerId: string;

  @Column({ nullable: true })
  orderId: string;

  @Column({ default: 'DRAFT' })
  status: string;

  @Column({ type: 'bigint' })
  subtotal: number;

  @Column({ type: 'bigint', default: 0 })
  taxAmount: number;

  @Column({ type: 'bigint', default: 0 })
  discount: number;

  /** Intra-city transport cost (IRR) */
  @Column({ type: 'bigint', default: 0 })
  intraCityFee: number;

  /** Per-kilogram shipping fee (IRR) */
  @Column({ type: 'bigint', default: 0 })
  perKgFee: number;

  @Column({ default: false })
  freeShipping: boolean;

  @Column({ type: 'bigint' })
  total: number;

  @Column({ type: 'bigint', default: 0 })
  paidAmount: number;

  @Column({ nullable: true })
  dueDate: Date;

  @Column({ nullable: true, type: 'text' })
  notes: string;

  @Column({ nullable: true })
  pdfUrl: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
