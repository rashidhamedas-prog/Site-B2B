import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index,
} from 'typeorm';
import type { ActivityType, MarketingChannel } from '../customer-marketing.constants';

@Entity('marketing_activities')
@Index('IDX_marketing_activities_customer_time', ['customerId', 'occurredAt'])
export class MarketingActivityEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  customerId: string;

  @Column({ length: 16 })
  channel: MarketingChannel;

  @Column({ length: 16 })
  type: ActivityType;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  payload: Record<string, unknown>;

  @Column({ type: 'uuid', nullable: true })
  actorUserId: string | null;

  @Column({ type: 'timestamptz' })
  occurredAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
