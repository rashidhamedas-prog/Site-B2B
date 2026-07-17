import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export type SideDiscountType =
  | 'FIRST_INVOICE'
  | 'INVOICE_COUNT'
  | 'INVOICE_SUM'
  | 'PRODUCT_COUNT';

@Entity('side_discounts')
export class SideDiscountEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  type: SideDiscountType;

  @Column({ type: 'int' })
  percent: number;

  /** Threshold meaning depends on type (count or IRR amount) */
  @Column({ type: 'bigint', default: 0 })
  threshold: number;

  @Column({ nullable: true })
  categoryId: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
