import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('sales_partner_order_draft_items')
export class SalesPartnerOrderDraftItemEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  draftId: string;

  @Column({ type: 'uuid' })
  productId: string;

  @Column({ type: 'uuid', nullable: true })
  variantId: string | null;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'int' })
  unitPriceIrr: number;

  @Column({ type: 'int' })
  lineTotalIrr: number;

  @Column({ type: 'int' })
  estimatedCommissionIrr: number;

  @Column({ type: 'varchar', length: 160, nullable: true })
  productName: string | null;
}
