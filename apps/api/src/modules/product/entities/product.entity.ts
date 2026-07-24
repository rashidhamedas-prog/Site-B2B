import {
  Entity, PrimaryGeneratedColumn, Column, OneToMany, ManyToOne, JoinColumn,
  CreateDateColumn, UpdateDateColumn, DeleteDateColumn, BeforeInsert, BeforeUpdate,
} from 'typeorm';
import { ProductVariantEntity } from './product-variant.entity';
import { CategoryEntity } from '../../category/entities/category.entity';
import { ProductSizeType, ProductSpecs } from './product-specs';

function toSlug(text: string): string {
  return text
    .replace(/\s+/g, '-')
    .replace(/[^\w؀-ۿ-]/g, '')
    .toLowerCase()
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

@Entity('products')
export class ProductEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  sku: string;

  @Column({ unique: true, nullable: true })
  slug: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  nameEn: string;

  /** SEO-only description (separate from product specs on PDP) */
  @Column({ nullable: true, type: 'text' })
  description: string;

  /** Legacy fabric column — kept nullable for backward compatibility */
  @Column({ nullable: true, default: '' })
  fabric: string;

  /** Legacy — no longer used in admin UI */
  @Column({ nullable: true })
  fabricComposition: string;

  @Column({ type: 'jsonb', nullable: true })
  specs: ProductSpecs;

  @Column({ default: 'FREE' })
  sizeType: ProductSizeType;

  @Column({ default: 'ACTIVE' })
  status: string;

  /** @deprecated use isDiscounted / computed badges */
  @Column({ default: false })
  isFeatured: boolean;

  /** @deprecated auto-badge from createdAt */
  @Column({ default: false })
  isNew: boolean;

  @Column({ default: false })
  isDiscounted: boolean;

  @Column({ type: 'bigint' })
  wholesalePrice: number;

  @Column({ type: 'bigint', nullable: true })
  retailPrice: number;

  @Column({ default: 5 })
  minOrderQty: number;

  /** Product-level stock (independent of color variants). Must be a multiple of minOrderQty. */
  @Column({ type: 'int', default: 0 })
  stock: number;

  @Column({ nullable: true })
  categoryId: string;

  @ManyToOne(() => CategoryEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'categoryId' })
  category: CategoryEntity;

  @Column({ nullable: true })
  collectionId: string;

  @Column({ default: false })
  isPreOrder: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  preOrderDate: Date | null;

  @Column({ type: 'text', nullable: true })
  modelInfo: string | null;

  @Column({ type: 'text', nullable: true })
  videoUrl: string | null;

  @Column({ type: 'jsonb', nullable: true })
  images: string[];

  @Column({ type: 'jsonb', nullable: true })
  seoMeta: Record<string, string>;

  @OneToMany(() => ProductVariantEntity, (v) => v.product, { cascade: true })
  variants: ProductVariantEntity[];

  @BeforeInsert()
  @BeforeUpdate()
  generateSlug() {
    if (!this.slug && this.name) {
      this.slug = `${toSlug(this.name)}-${this.sku.toLowerCase()}`;
    }
  }

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
