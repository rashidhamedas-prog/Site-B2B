import {
  Entity, PrimaryGeneratedColumn, Column, OneToMany, ManyToOne, JoinColumn,
  CreateDateColumn, UpdateDateColumn, DeleteDateColumn, BeforeInsert, BeforeUpdate, Index,
} from 'typeorm';
import { asciiSlug, hasNonAsciiSlug } from '../../../common/ascii-slug';
import { ProductVariantEntity } from './product-variant.entity';
import { CategoryEntity } from '../../category/entities/category.entity';
import { ProductSizeType, ProductSpecs } from './product-specs';

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

  /** Retail PDP view counter — used for homepage “most viewed” sort */
  @Index()
  @Column({ type: 'int', default: 0 })
  viewCount: number;

  @Column({ type: 'bigint' })
  wholesalePrice: number;

  @Column({ type: 'bigint', nullable: true })
  retailPrice: number;

  @Column({ default: 5 })
  minOrderQty: number;

  /**
   * When true, wholesale PDP lets the buyer pick colors.
   * Order expands: each selected color × each size gets 1 piece per pack
   * (pack size = colorCount × sizeCount).
   */
  @Column({ default: false })
  allowWholesaleColorSelect: boolean;

  /** Minimum number of colors the wholesale buyer must select (when allowWholesaleColorSelect). */
  @Column({ type: 'int', default: 1 })
  minWholesaleColors: number;

  /**
   * @deprecated Prefer wholesaleStock / retailStock.
   * Kept in sync with wholesaleStock for legacy readers.
   */
  @Column({ type: 'int', default: 0 })
  stock: number;

  /** Warehouse stock for wholesale (.com) channel */
  @Column({ type: 'int', default: 0 })
  wholesaleStock: number;

  /** Warehouse stock for retail (.ir) channel */
  @Column({ type: 'int', default: 0 })
  retailStock: number;

  /** Visible on wholesale storefront (.com) */
  @Column({ default: true })
  showOnWholesale: boolean;

  /** Visible on retail storefront (.ir) */
  @Column({ default: true })
  showOnRetail: boolean;

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
    const skuSlug = this.sku ? asciiSlug(this.sku, '') : '';
    // Prefer SKU-only ASCII URLs so copied links stay readable (no %D9…).
    if (!this.slug || hasNonAsciiSlug(this.slug)) {
      if (skuSlug) {
        this.slug = skuSlug;
        return;
      }
      if (this.nameEn) {
        this.slug = asciiSlug(this.nameEn);
        return;
      }
      if (this.name) this.slug = asciiSlug(this.name);
    } else {
      this.slug = asciiSlug(this.slug, skuSlug || 'product');
    }
  }

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
