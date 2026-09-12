import {
  Entity,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  PrimaryColumn,
  Index,
} from 'typeorm';
import { ProductEntity } from './product.entity';
import { CategoryEntity } from '../../category/entities/category.entity';

@Entity('product_category_membership')
@Index('UQ_product_category_membership_primary', ['productId'], {
  unique: true,
  where: '"isPrimary" = true',
})
@Index('IDX_product_category_membership_category', ['categoryId'])
export class ProductCategoryMembershipEntity {
  @PrimaryColumn('uuid')
  productId: string;

  @PrimaryColumn('uuid')
  categoryId: string;

  @ManyToOne(() => ProductEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product: ProductEntity;

  @ManyToOne(() => CategoryEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'categoryId' })
  category: CategoryEntity;

  @Column({ type: 'boolean', default: false })
  isPrimary: boolean;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
