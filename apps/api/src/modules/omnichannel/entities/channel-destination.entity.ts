import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn,
} from 'typeorm';
import { ChannelConnectionEntity } from './channel-connection.entity';

@Entity('omnichannel_channel_destinations')
@Index('UQ_omnichannel_destinations_connection_key', ['connectionId', 'destinationKey'], {
  unique: true,
})
export class ChannelDestinationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  connectionId: string;

  @ManyToOne(() => ChannelConnectionEntity, (c) => c.destinations, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'connectionId' })
  connection: ChannelConnectionEntity;

  @Column({ type: 'varchar' })
  destinationKey: string;

  @Column({ type: 'varchar' })
  displayName: string;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @Column({ type: 'jsonb', default: {} })
  settings: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
