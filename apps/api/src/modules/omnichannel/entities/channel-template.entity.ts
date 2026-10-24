import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

@Entity('omnichannel_channel_templates')
/** Channel-wide fallback: both connectionId and destinationId null. */
@Index('UQ_omnichannel_templates_fallback_provider_channel_event_version', ['provider', 'channel', 'eventType', 'version'], {
  unique: true,
  where: '"connectionId" IS NULL AND "destinationId" IS NULL',
})
/** Per-bot compat rows without destination binding. */
@Index('UQ_omnichannel_templates_connection_event_version', ['connectionId', 'eventType', 'version'], {
  unique: true,
  where: '"connectionId" IS NOT NULL AND "destinationId" IS NULL',
})
/** Primary operator scope: one product template layout per destination. */
@Index('UQ_omnichannel_templates_destination_event_version', ['destinationId', 'eventType', 'version'], {
  unique: true,
  where: '"destinationId" IS NOT NULL',
})
export class ChannelTemplateEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  provider: string;

  @Column({ type: 'varchar' })
  channel: string;

  /** When set without destinationId, this template belongs to one bot (compat). */
  @Column({ type: 'uuid', nullable: true })
  connectionId: string | null;

  /** Primary scope: template for one destination chat. */
  @Column({ type: 'uuid', nullable: true })
  destinationId: string | null;

  @Column({ type: 'varchar' })
  eventType: string;

  @Column({ type: 'varchar', default: 'fa' })
  locale: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'int', default: 1 })
  version: number;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
