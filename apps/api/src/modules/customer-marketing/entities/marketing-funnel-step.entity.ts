import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index,
} from 'typeorm';
import type { MessageClass } from '../customer-marketing.constants';
import { MarketingFunnelEntity } from './marketing-funnel.entity';

@Entity('marketing_funnel_steps')
@Index('UQ_marketing_funnel_steps_order', ['funnelId', 'sortOrder'], { unique: true })
export class MarketingFunnelStepEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  funnelId: string;

  @ManyToOne(() => MarketingFunnelEntity, (f) => f.steps, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'funnelId' })
  funnel: MarketingFunnelEntity;

  @Column()
  sortOrder: number;

  @Column({ length: 64 })
  code: string;

  @Column()
  title: string;

  @Column({ default: 0 })
  delaySeconds: number;

  @Column({ length: 16, default: 'SMS' })
  actionType: 'SMS' | 'CALL';

  @Column({ length: 24, default: 'NURTURE' })
  messageClass: MessageClass;

  @Column({ length: 80 })
  templateCode: string;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  conditions: Record<string, unknown>;

  @Column({ default: true })
  isActive: boolean;
}
