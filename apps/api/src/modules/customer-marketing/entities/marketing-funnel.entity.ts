import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, OneToMany,
} from 'typeorm';
import type { MarketingChannel } from '../customer-marketing.constants';
import { MarketingFunnelStepEntity } from './marketing-funnel-step.entity';

@Entity('marketing_funnels')
@Index('UQ_marketing_funnels_channel_code', ['channel', 'code'], { unique: true })
export class MarketingFunnelEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 16 })
  channel: MarketingChannel;

  @Column({ length: 64 })
  code: string;

  @Column()
  title: string;

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => MarketingFunnelStepEntity, (s) => s.funnel)
  steps: MarketingFunnelStepEntity[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
