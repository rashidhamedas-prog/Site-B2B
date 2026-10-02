import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('erp_product_map')
export class ErpProductMapEntity {
  @PrimaryColumn({ type: 'varchar', length: 191 })
  erpProductSku: string;

  @Index()
  @Column({ type: 'uuid' })
  productId: string;

  /** barcode | manual (future) */
  @Column({ type: 'varchar', length: 32, default: 'barcode' })
  matchedBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
