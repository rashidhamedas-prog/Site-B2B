import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('sales_partner_applications')
export class SalesPartnerApplicationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 15 })
  phone: string;

  @Column({ type: 'varchar', length: 80 })
  displayName: string;

  @Column({ type: 'jsonb', nullable: true })
  socialHandles: Record<string, string> | null;

  /** Structured apply answers (province, city, nationalId, custom_*, …). */
  @Column({ type: 'jsonb', nullable: true })
  answers: Record<string, string | boolean> | null;

  /**
   * Newer answers held until OTP succeeds. Canonical fields stay unchanged
   * so an unauthenticated resubmit cannot overwrite a reviewed application.
   */
  @Column({ type: 'jsonb', nullable: true })
  pendingRevision: {
    displayName: string;
    socialHandles: Record<string, string> | null;
    answers: Record<string, string | boolean> | null;
  } | null;

  @Index()
  @Column({ type: 'varchar', length: 24, default: 'PENDING_OTP' })
  status: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  reviewNote: string | null;

  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ type: 'uuid', nullable: true })
  profileId: string | null;

  /** Last OTP/credentials SMS attempt metadata (no codes or passwords). */
  @Column({ type: 'jsonb', nullable: true })
  lastSmsAttempt: {
    at: string;
    purpose: 'otp' | 'credentials' | 'welcome';
    result: 'sent' | 'pending' | 'failed';
    errorCode?: string;
    errorMessage?: string;
    via?: string;
    durationMs?: number;
    phoneMasked: string;
  } | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
