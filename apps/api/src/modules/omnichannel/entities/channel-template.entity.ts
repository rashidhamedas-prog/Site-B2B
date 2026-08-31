import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

@Entity('omnichannel_channel_templates')
@Index('UQ_omnichannel_templates_provider_channel_event_version', ['provider', 'channel', 'eventType', 'version'], {
  unique: true,
})
export class ChannelTemplateEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  provider: string;

  @Column({ type: 'varchar' })
  channel: string;

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
