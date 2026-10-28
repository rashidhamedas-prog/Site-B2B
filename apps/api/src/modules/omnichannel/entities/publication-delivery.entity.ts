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
@Index('UQ_omnichannel_deliveries_active_create', ['idempotencyKey'], {
  unique: true,
  where: `"status" IN ('PENDING','PROCESSING','RETRY','SUCCEEDED','HOLD') AND "action" = 'CREATE' AND "supersededAt" IS NULL`,
})
@Index('UQ_omnichannel_deliveries_active_mutation', ['idempotencyKey'], {
  unique: true,
  where: `"action" IN ('UPDATE','DELETE') AND "status" IN ('PENDING','PROCESSING','RETRY','HOLD') AND "supersededAt" IS NULL`,
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

  @Column({ type: 'varchar' })
  sourceType: string;

  @Column({ type: 'varchar' })
  sourceId: string;

  @Column({ type: 'varchar' })
  idempotencyKey: string;

  @Column({ type: 'boolean', default: false })
  auto: boolean;

  @Column({ type: 'varchar', nullable: true })
  deferredReason: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  supersededAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  sentAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  contentHash: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  reapprovedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
