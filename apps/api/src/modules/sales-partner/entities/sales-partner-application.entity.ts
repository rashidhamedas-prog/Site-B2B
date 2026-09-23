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

  @Index()
  @Column({ type: 'varchar', length: 24, default: 'PENDING_OTP' })
  status: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  reviewNote: string | null;

  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ type: 'uuid', nullable: true })
  profileId: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
