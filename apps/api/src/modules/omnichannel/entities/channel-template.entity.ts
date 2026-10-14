import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

@Entity('omnichannel_channel_templates')
/** Channel-wide fallback rows only (connectionId IS NULL). Per-bot rows use a separate partial unique. */
@Index('UQ_omnichannel_templates_fallback_provider_channel_event_version', ['provider', 'channel', 'eventType', 'version'], {
  unique: true,
  where: '"connectionId" IS NULL',
})
@Index('UQ_omnichannel_templates_connection_event_version', ['connectionId', 'eventType', 'version'], {
  unique: true,
  where: '"connectionId" IS NOT NULL',
})
export class ChannelTemplateEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  provider: string;

  @Column({ type: 'varchar' })
  channel: string;

  /** When set, this template belongs to one bot connection; null = channel-wide fallback. */
  @Column({ type: 'uuid', nullable: true })
  connectionId: string | null;

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
