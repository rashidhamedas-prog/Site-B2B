import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import type { MarketingChannel, MarketingMode, MessageClass } from '../customer-marketing.constants';

@Entity('marketing_campaigns')
export class MarketingCampaignEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 16 })
  channel: MarketingChannel;

  @Column()
  title: string;

  @Column({ type: 'uuid', nullable: true })
  templateId: string | null;

  @Column({ length: 24, default: 'PROMO' })
  messageClass: MessageClass;

  @Column({ length: 16, default: 'OFF' })
  mode: MarketingMode;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  filter: Record<string, unknown>;

  @Column({ type: 'timestamptz', nullable: true })
  canaryAt: Date | null;

  @Column({ default: false })
  canarySucceeded: boolean;

  @Column({ type: 'uuid', nullable: true })
  createdByUserId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
