import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

@Entity('blog_media_assets')
export class BlogMediaAssetEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  @Index()
  channel: string | null;

  @Column()
  originalFileName: string;

  @Column()
  storedFileName: string;

  @Column()
  mimeType: string;

  @Column()
  extension: string;

  @Column({ type: 'int', default: 0 })
  width: number;

  @Column({ type: 'int', default: 0 })
  height: number;

  @Column({ type: 'int', default: 0 })
  fileSize: number;

  @Column({ default: 'S3' })
  storageProvider: string;

  @Column()
  storageKey: string;

  @Column()
  publicUrl: string;

  @Column({ nullable: true })
  title: string | null;

  @Column({ default: '' })
  altText: string;

  @Column({ nullable: true, type: 'text' })
  caption: string | null;

  @Column({ nullable: true, type: 'text' })
  description: string | null;

  @Column({ nullable: true })
  creditName: string | null;

  @Column({ nullable: true })
  creditUrl: string | null;

  @Column({ type: 'float', nullable: true })
  focalPointX: number | null;

  @Column({ type: 'float', nullable: true })
  focalPointY: number | null;

  @Column({ default: false })
  isDecorative: boolean;

  @Column({ nullable: true })
  contentHash: string | null;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
