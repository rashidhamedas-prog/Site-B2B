import {
  Entity, PrimaryGeneratedColumn, Column, OneToMany, ManyToOne, JoinColumn,
  CreateDateColumn, UpdateDateColumn, DeleteDateColumn, BeforeInsert, BeforeUpdate,
} from 'typeorm';
import { ProductVariantEntity } from './product-variant.entity';
import { CategoryEntity } from '../../category/entities/category.entity';

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

  @Column({ nullable: true, type: 'text' })
  description: string;

  @Column()
  fabric: string;

  @Column({ nullable: true })
  fabricComposition: string;

  @Column({ default: 'ACTIVE' })
  status: string;

  @Column({ default: false })
  isFeatured: boolean;

  @Column({ default: false })
  isNew: boolean;

  @Column({ type: 'bigint' })
  wholesalePrice: number;

  @Column({ type: 'bigint', nullable: true })
  retailPrice: number;

  @Column({ default: 5 })
  minOrderQty: number;

  @Column({ nullable: true })
  categoryId: string;

  // Optional relation (category can be added later).
  // Note: this is nullable for backward compatibility.
  @ManyToOne(() => CategoryEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'categoryId' })
  category: CategoryEntity;

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
