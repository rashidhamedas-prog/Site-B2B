import { Entity, PrimaryColumn, Column, CreateDateColumn, Index } from 'typeorm';

/** Previous storefront SKUs kept after aligning products.sku with ERP codes. */
@Entity('product_sku_aliases')
export class ProductSkuAliasEntity {
  @PrimaryColumn({ type: 'varchar', length: 191 })
  sku: string;

  @Index()
  @Column({ type: 'uuid' })
  productId: string;

  @CreateDateColumn()
  createdAt: Date;
}
