import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('wholesale_referral_partners')
export class WholesaleReferralPartnerEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 20 })
  phone: string;

  @Column({ type: 'varchar', length: 120 })
  displayName: string;

  @Index({ unique: true })
  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 8, nullable: true })
  publicCode: string | null;

  /** PENDING_PHONE | PENDING_REVIEW | APPROVED | REJECTED | SUSPENDED */
  @Column({ type: 'varchar', length: 32, default: 'PENDING_PHONE' })
  status: string;

  /** Owner policy: partners start with promo consent and leave via لغو11 (phone-level). */
  @Column({ type: 'boolean', default: true })
  smsPromoConsent: boolean;

  @Column({ type: 'varchar', length: 32, default: 'OWNER_DEFAULT_POLICY' })
  smsPromoConsentSource: string;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  smsPromoConsentAt: Date;

  @Column({ type: 'varchar', length: 40, nullable: true })
  termsVersion: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  termsAcceptedAt: Date | null;

  @Column({ type: 'varchar', length: 34, nullable: true })
  payoutIban: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  payoutBeneficiary: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
