import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

@Entity('installment_contracts')
export class InstallmentContractEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  customerId: string;

  @Column()
  @Index()
  orderId: string;

  /** INTERNAL | provider code */
  @Column({ default: 'INTERNAL' })
  providerCode: string;

  @Column({ type: 'bigint' })
  principalIrr: number;

  @Column({ type: 'bigint', default: 0 })
  downPaymentIrr: number;

  @Column({ type: 'int' })
  termCount: number;

  @Column({ type: 'bigint' })
  effectiveAmountIrr: number;

  /** DRAFT | ACTIVE | COMPLETED | DEFAULTED | CANCELLED */
  @Column({ default: 'DRAFT' })
  @Index()
  status: string;

  @Column({ nullable: true })
  externalContractId: string;

  @Column({ nullable: true, type: 'text' })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('installment_schedules')
@Index(['contractId', 'installmentNo'], { unique: true })
export class InstallmentScheduleEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  contractId: string;

  @Column({ type: 'int' })
  installmentNo: number;

  @Column({ type: 'timestamptz' })
  dueAt: Date;

  @Column({ type: 'bigint' })
  amountIrr: number;

  @Column({ type: 'bigint', default: 0 })
  paidAmountIrr: number;

  /** PENDING | PARTIAL | PAID | OVERDUE | CANCELLED */
  @Column({ default: 'PENDING' })
  @Index()
  status: string;

  @Column({ nullable: true })
  providerReference: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
