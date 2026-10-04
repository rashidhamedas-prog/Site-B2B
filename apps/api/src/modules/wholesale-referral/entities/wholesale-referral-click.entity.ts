import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Diagnostic only. Not a success metric and not ownership. */
@Entity('wholesale_referral_clicks')
export class WholesaleReferralClickEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 8 })
  publicCode: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
