import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('erp_variant_map')
export class ErpVariantMapEntity {
  @PrimaryColumn({ type: 'varchar', length: 191 })
  erpVariantSku: string;

  @Index()
  @Column({ type: 'uuid' })
  productId: string;

  @Index()
  @Column({ type: 'uuid' })
  variantId: string;

  /** map | color_size | barcode */
  @Column({ type: 'varchar', length: 32, default: 'map' })
  matchedBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
