import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

/**
 * Provider registry — enabled/APPROVED is required for checkout eligibility.
 * Enum presence alone never means supported.
 */
@Entity('payment_providers')
export class PaymentProviderEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  code: string;

  @Column()
  displayName: string;

  /** PSP | BNPL | MANUAL | INSTALLMENT_INTERNAL */
  @Column({ default: 'PSP' })
  type: string;

  @Column({ default: false })
  enabled: boolean;

  /** WHOLESALE | RETAIL | BOTH */
  @Column({ default: 'BOTH' })
  channel: string;

  @Column({ type: 'jsonb', default: {} })
  capabilities: Record<string, boolean>;

  /** Reference key into env/vault — never store secrets here */
  @Column({ nullable: true })
  configReference: string;

  @Column({ type: 'bigint', nullable: true })
  minAmountIrr: number;

  @Column({ type: 'bigint', nullable: true })
  maxAmountIrr: number;

  @Column({ type: 'jsonb', nullable: true })
  supportedCategories: string[];

  @Column({ type: 'int', default: 100 })
  sortOrder: number;

  /** UNKNOWN | HEALTHY | DEGRADED | DOWN */
  @Column({ default: 'UNKNOWN' })
  healthStatus: string;

  /** NOT_STARTED | PENDING | APPROVED | SUSPENDED */
  @Column({ default: 'NOT_STARTED' })
  contractStatus: string;

  @Column({ default: false })
  maintenanceMode: boolean;

  @Column({ nullable: true, type: 'text' })
  lastErrorSanitized: string;

  @Column({ nullable: true })
  logoUrl: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
