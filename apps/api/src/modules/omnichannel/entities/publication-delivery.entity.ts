import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn,
} from 'typeorm';
import { PublicationEntity } from './publication.entity';
import { ChannelDestinationEntity } from './channel-destination.entity';
import { OutboxEventEntity } from './outbox-event.entity';

@Entity('omnichannel_publication_deliveries')
@Index('UQ_omnichannel_deliveries_event_destination_action', ['eventId', 'destinationId', 'action'], {
  unique: true,
})
export class PublicationDeliveryEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  publicationId: string;

  @ManyToOne(() => PublicationEntity, (p) => p.deliveries, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'publicationId' })
  publication: PublicationEntity;

  @Column({ type: 'uuid' })
  destinationId: string;

  @ManyToOne(() => ChannelDestinationEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'destinationId' })
  destination: ChannelDestinationEntity;

  @Column({ type: 'uuid' })
  eventId: string;

  @ManyToOne(() => OutboxEventEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'eventId' })
  event: OutboxEventEntity;

  @Column({ type: 'varchar' })
  action: string;

  @Column({ type: 'varchar', default: 'PENDING' })
  status: string;

  @Column({ type: 'varchar', nullable: true })
  providerMessageId: string | null;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ type: 'timestamptz', nullable: true })
  nextAttemptAt: Date | null;

  @Column({ type: 'text', nullable: true })
  lastError: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
