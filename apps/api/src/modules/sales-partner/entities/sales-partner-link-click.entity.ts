import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('sales_partner_link_clicks')
export class SalesPartnerLinkClickEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 16 })
  code: string;

  @Column({ type: 'uuid' })
  productId: string;

  @Column({ type: 'varchar', length: 64 })
  ipHash: string;

  @Column({ type: 'varchar', length: 64 })
  uaHash: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
