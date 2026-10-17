import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('sales_partner_product_eligibility')
export class SalesPartnerProductEligibilityEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  productId: string;

  @Column({ type: 'boolean', default: false })
  eligible: boolean;

  /** Lower number is listed first in the partner catalog. Null sorts after ranked products. */
  @Column({ type: 'int', nullable: true })
  displayPriority: number | null;

  @Column({ type: 'jsonb', nullable: true })
  allowedImageKeys: string[] | null;

  @Column({ type: 'jsonb', nullable: true })
  marginCheck: Record<string, unknown> | null;

  @Column({ type: 'uuid', nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
