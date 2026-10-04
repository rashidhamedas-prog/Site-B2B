import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('wholesale_referral_terms_acceptances')
export class WholesaleReferralTermsAcceptanceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  partnerId: string;

  @Column({ type: 'varchar', length: 40 })
  termsVersion: string;

  @Column({ type: 'timestamptz' })
  acceptedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  phoneVerifiedAt: Date | null;
}
