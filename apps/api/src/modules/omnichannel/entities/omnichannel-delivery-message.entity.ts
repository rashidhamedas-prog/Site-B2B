import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, ManyToOne, JoinColumn,
} from 'typeorm';
import { PublicationDeliveryEntity } from './publication-delivery.entity';

@Entity('omnichannel_delivery_messages')
@Index('UQ_omnichannel_delivery_messages_delivery_msg', ['deliveryId', 'providerMessageId'], { unique: true })
@Index('IDX_omnichannel_delivery_messages_delivery', ['deliveryId'])
export class OmnichannelDeliveryMessageEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  deliveryId: string;

  @ManyToOne(() => PublicationDeliveryEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'deliveryId' })
  delivery: PublicationDeliveryEntity;

  @Column({ type: 'varchar' })
  providerMessageId: string;

  @Column({ type: 'int', default: 0 })
  albumIndex: number;

  @Column({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
