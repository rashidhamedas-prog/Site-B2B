import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('wholesale_referral_introductions')
@Index('IDX_wr_intro_partner', ['partnerId', 'updatedAt'])
export class WholesaleReferralIntroductionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  partnerId: string;

  @Index()
  @Column({ type: 'varchar', length: 20 })
  normalizedPhone: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  customerId: string | null;

  @Column({ type: 'uuid', nullable: true })
  orderId: string | null;

  /** LINK | MANUAL */
  @Column({ type: 'varchar', length: 16 })
  source: string;

  @Column({ type: 'boolean', default: false })
  consentToShareContact: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  consentAt: Date | null;

  @Column({ type: 'varchar', length: 32, default: 'SUBMITTED' })
  stage: string;

  /** AWAITING_POLICY | OWNED | EXPIRED | CONFLICT | REJECTED */
  @Column({ type: 'varchar', length: 32, default: 'AWAITING_POLICY' })
  ownershipStatus: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  reasonCode: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  partnerExplanation: string | null;

  @Column({ type: 'text', nullable: true })
  internalNote: string | null;

  @Column({ type: 'varchar', length: 240, nullable: true })
  nextAction: string | null;

  @Column({ type: 'uuid', nullable: true })
  assignedStaffId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  acquiredAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  boutiqueName: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
