import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ProductEntity } from './product.entity';
import type { ProductVideoStatus } from '../../upload/video-policy';

@Entity('product_video')
@Index('IDX_product_video_product_id', ['productId'])
export class ProductVideoEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'product_id', type: 'uuid', nullable: true })
  productId: string | null;

  @ManyToOne(() => ProductEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product?: ProductEntity;

  @Column({
    type: 'enum',
    enum: ['uploading', 'queued', 'processing', 'ready', 'failed'],
    enumName: 'product_video_status_enum',
    nullable: true,
  })
  status: ProductVideoStatus | null;

  @Column({ name: 'src_key', type: 'varchar', nullable: true })
  srcKey: string | null;

  @Column({ name: 'mp4_720_key', type: 'varchar', nullable: true })
  mp4720Key: string | null;

  @Column({ name: 'mp4_480_key', type: 'varchar', nullable: true })
  mp4480Key: string | null;

  @Column({ name: 'webm_720_key', type: 'varchar', nullable: true })
  webm720Key: string | null;

  @Column({ name: 'poster_key', type: 'varchar', nullable: true })
  posterKey: string | null;

  @Column({ name: 'poster_candidates', type: 'jsonb', nullable: true })
  posterCandidates: string[] | null;

  @Column({ name: 'duration_sec', type: 'real', nullable: true })
  durationSec: number | null;

  @Column({ type: 'int', nullable: true })
  width: number | null;

  @Column({ type: 'int', nullable: true })
  height: number | null;

  @Column({ name: 'bytes_out', type: 'bigint', nullable: true })
  bytesOut: string | null;

  @Column({ name: 'error_code', type: 'varchar', nullable: true })
  errorCode: string | null;

  @Column({ name: 'sort_order', type: 'int', nullable: true, default: 1 })
  sortOrder: number | null;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', nullable: true })
  createdAt: Date | null;

  @UpdateDateColumn({ name: 'updated_at', nullable: true })
  updatedAt: Date | null;
}
