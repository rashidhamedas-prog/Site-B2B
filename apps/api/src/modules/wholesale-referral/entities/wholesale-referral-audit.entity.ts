import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('wholesale_referral_audits')
export class WholesaleReferralAuditEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  actorUserId: string | null;

  @Column({ type: 'varchar', length: 40 })
  action: string;

  @Index()
  @Column({ type: 'varchar', length: 40 })
  entityType: string;

  @Column({ type: 'varchar', length: 64 })
  entityId: string;

  @Column({ type: 'jsonb', nullable: true })
  payload: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
