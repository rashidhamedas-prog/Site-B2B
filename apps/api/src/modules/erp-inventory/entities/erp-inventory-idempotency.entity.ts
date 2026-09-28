import { Entity, PrimaryColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('erp_inventory_idempotency')
export class ErpInventoryIdempotencyEntity {
  @PrimaryColumn({ type: 'varchar', length: 191 })
  idempotencyKey: string;

  @Column({ type: 'jsonb' })
  response: Record<string, unknown>;

  @Index()
  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
