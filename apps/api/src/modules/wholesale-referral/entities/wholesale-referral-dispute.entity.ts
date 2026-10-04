import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('wholesale_referral_disputes')
export class WholesaleReferralDisputeEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  introductionId: string;

  @Index()
  @Column({ type: 'uuid' })
  partnerId: string;

  @Column({ type: 'varchar', length: 1000 })
  message: string;

  /** OPEN | RESOLVED */
  @Column({ type: 'varchar', length: 16, default: 'OPEN' })
  status: string;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  resolution: string | null;

  @Column({ type: 'uuid', nullable: true })
  resolvedByUserId: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
