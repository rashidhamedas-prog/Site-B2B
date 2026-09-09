import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ProductEntity } from './product.entity';

export type InternalLinkChannel = 'RETAIL' | 'WHOLESALE';
export type InternalLinkTargetType = 'PRODUCT' | 'CATEGORY' | 'BLOG' | 'CUSTOM';
export type InternalLinkRel = 'dofollow' | 'nofollow' | 'sponsored';

/**
 * One curated internal link on a product PDP, scoped to a single channel.
 *
 * `targetId` is a soft reference: it points to a product / category / blog row
 * by id but has no FK (different tables share the column). The service validates
 * existence + channel visibility on write and re-checks on read so a deleted
 * or channel-hidden target is never rendered as a broken link.
 */
@Entity('product_internal_link')
@Index('IDX_product_internal_link_product_channel', ['productId', 'channel'])
@Index('IDX_product_internal_link_inbound', ['channel', 'targetType', 'targetId'])
export class ProductInternalLinkEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  productId: string;

  @ManyToOne(() => ProductEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product: ProductEntity;

  @Column({ type: 'varchar', length: 10 })
  channel: InternalLinkChannel;

  @Column({ type: 'varchar', length: 12 })
  targetType: InternalLinkTargetType;

  @Column({ type: 'uuid', nullable: true })
  targetId: string | null;

  @Column({ type: 'text' })
  targetUrl: string;

  @Column({ type: 'text' })
  anchorText: string;

  @Column({ type: 'text', nullable: true })
  title: string | null;

  /** Optional admin override image for the PDP guide row. */
  @Column({ type: 'text', nullable: true })
  imageUrl: string | null;

  /** Optional admin override short description for the PDP guide row. */
  @Column({ type: 'text', nullable: true })
  excerpt: string | null;

  @Column({ type: 'varchar', length: 12, default: 'dofollow' })
  rel: InternalLinkRel;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
