import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, OneToMany,
} from 'typeorm';
import { PublicationDeliveryEntity } from './publication-delivery.entity';

@Entity('omnichannel_publications')
@Index('UQ_omnichannel_publications_source_channel_updated', ['sourceType', 'sourceId', 'channel', 'sourceUpdatedAt'], {
  unique: true,
})
export class PublicationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  sourceType: string;

  @Column({ type: 'varchar' })
  sourceId: string;

  @Column({ type: 'varchar' })
  channel: string;

  @Column({ type: 'timestamptz' })
  sourceUpdatedAt: Date;

  @Column({ type: 'jsonb', default: {} })
  projection: Record<string, unknown>;

  @Column({ type: 'varchar', default: 'DRAFT' })
  status: string;

  @OneToMany(() => PublicationDeliveryEntity, (d) => d.publication)
  deliveries: PublicationDeliveryEntity[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
