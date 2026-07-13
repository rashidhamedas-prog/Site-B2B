import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { ProductEntity } from './product.entity';
import { VariantColorEntity } from './variant-color.entity';
import { VariantSizeEntity } from './variant-size.entity';

@Entity('product_variants')
export class ProductVariantEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ProductEntity, (p) => p.variants, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product: ProductEntity;

  @Column()
  productId: string;

  @Column()
  color: string;

  @Column()
  colorHex: string;

  @Column()
  size: string;

  @Column({ nullable: true })
  colorId: string;

  @ManyToOne(() => VariantColorEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'colorId' })
  colorRef: VariantColorEntity;

  @Column({ nullable: true })
  sizeId: string;

  @ManyToOne(() => VariantSizeEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'sizeId' })
  sizeRef: VariantSizeEntity;

  @Column({ default: 0 })
  stock: number;

  @Column({ nullable: true })
  barcode: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
