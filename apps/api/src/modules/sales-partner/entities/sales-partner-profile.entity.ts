import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('sales_partner_profiles')
export class SalesPartnerProfileEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  userId: string;

  @Index()
  @Column({ type: 'varchar', length: 15, unique: true })
  phone: string;

  @Column({ type: 'varchar', length: 80 })
  displayName: string;

  @Index()
  @Column({ type: 'varchar', length: 24, default: 'PENDING_REVIEW' })
  status: string;

  /** Public share-link code. Not a secret and not affiliateId. */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 16, nullable: true })
  publicCode: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  statusReason: string | null;

  @Column({ type: 'int', nullable: true })
  commissionRateOverride: number | null;

  @Column({ type: 'varchar', length: 4, nullable: true })
  ibanLast4: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ibanFingerprint: string | null;

  @Column({ type: 'text', nullable: true })
  ibanCipher: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  termsVersion: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  termsAcceptedAt: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  riskFlags: string[] | null;

  @Column({ type: 'timestamptz', nullable: true })
  closedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
