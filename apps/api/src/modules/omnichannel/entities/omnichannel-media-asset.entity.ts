import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('omnichannel_media_assets')
@Index('UQ_omnichannel_media_publicUrl', ['publicUrl'], { unique: true })
export class OmnichannelMediaAssetEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  publicUrl: string;

  @Column({ type: 'varchar' })
  storageKey: string;

  @Column({ type: 'varchar', default: '' })
  altText: string;

  @Column({ type: 'varchar', default: 'UPLOAD' })
  ownerType: string;

  @Column({ type: 'varchar', nullable: true })
  ownerId: string | null;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
