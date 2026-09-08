import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';
import type { ConsentSource, ConsentStatus, MarketingChannel } from '../customer-marketing.constants';

@Entity('marketing_consents')
@Index('UQ_marketing_consents_customer_channel', ['customerId', 'channel'], { unique: true })
export class MarketingConsentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  customerId: string;

  @Column({ length: 16 })
  channel: MarketingChannel;

  @Column({ length: 24 })
  status: ConsentStatus;

  @Column({ length: 32 })
  source: ConsentSource;

  @Column({ type: 'uuid', nullable: true })
  updatedByUserId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
