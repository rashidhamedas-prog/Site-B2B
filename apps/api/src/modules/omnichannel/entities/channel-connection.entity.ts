import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, OneToMany,
} from 'typeorm';
import { ChannelDestinationEntity } from './channel-destination.entity';

@Entity('omnichannel_channel_connections')
@Index('UQ_omnichannel_connections_provider_channel_name', ['provider', 'channel', 'name'], {
  unique: true,
})
export class ChannelConnectionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  provider: string;

  @Column({ type: 'varchar' })
  channel: string;

  @Column({ type: 'varchar' })
  name: string;

  /** Runtime secret name only — never the secret value. */
  @Column({ type: 'varchar' })
  secretRef: string;

  @Column({ type: 'varchar', default: 'DISABLED' })
  status: string;

  @Column({ type: 'timestamptz', nullable: true })
  lastCheckedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  lastError: string | null;

  @OneToMany(() => ChannelDestinationEntity, (d) => d.connection)
  destinations: ChannelDestinationEntity[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
