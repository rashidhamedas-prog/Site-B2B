import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, ManyToOne, JoinColumn,
} from 'typeorm';
import { PublicationDeliveryEntity } from './publication-delivery.entity';

export const POST_BACKUP_KINDS = ['pre_delete', 'pre_edit', 'post_edit'] as const;
export type PostBackupKind = (typeof POST_BACKUP_KINDS)[number];

@Entity('omnichannel_post_backups')
@Index('IDX_omnichannel_post_backups_delivery_created', ['deliveryId', 'createdAt'])
export class OmnichannelPostBackupEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  deliveryId: string;

  @ManyToOne(() => PublicationDeliveryEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'deliveryId' })
  delivery: PublicationDeliveryEntity;

  @Column({ type: 'uuid' })
  publicationId: string;

  @Column({ type: 'uuid' })
  destinationId: string;

  @Column({ type: 'varchar' })
  kind: PostBackupKind | string;

  @Column({ type: 'text', nullable: true })
  caption: string | null;

  @Column({ type: 'jsonb', default: [] })
  mediaUrls: string[];

  @Column({ type: 'jsonb', default: [] })
  messageIds: string[];

  @Column({ type: 'varchar', nullable: true })
  contentHash: string | null;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ type: 'uuid' })
  actorId: string;

  @Column({ type: 'varchar', nullable: true })
  goRef: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
