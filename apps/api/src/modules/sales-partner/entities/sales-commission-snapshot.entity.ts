import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('sales_commission_snapshots')
export class SalesCommissionSnapshotEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  orderId: string;

  @Column({ type: 'uuid' })
  orderItemId: string;

  @Column({ type: 'uuid' })
  salesPartnerId: string;

  @Column({ type: 'uuid', nullable: true })
  ruleId: string | null;

  @Column({ type: 'int' })
  ruleVersion: number;

  @Column({ type: 'int' })
  percent: number;

  @Column({ type: 'bigint' })
  eligibleNetIrr: string;

  @Column({ type: 'bigint' })
  commissionIrr: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
