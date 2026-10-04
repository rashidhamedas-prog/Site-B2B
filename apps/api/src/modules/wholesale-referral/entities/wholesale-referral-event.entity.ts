import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('wholesale_referral_events')
export class WholesaleReferralEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  introductionId: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  fromStage: string | null;

  @Column({ type: 'varchar', length: 32 })
  toStage: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  reasonCode: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  partnerExplanation: string | null;

  @Column({ type: 'text', nullable: true })
  internalNote: string | null;

  @Column({ type: 'uuid', nullable: true })
  actorUserId: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
