import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';

@Entity('categories')
export class CategoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column()
  name: string;

  // Example: "LINEN-" or "LSH-"
  @Column({ default: '' })
  skuPrefix: string;

  // Next sequence number for auto-SKU generation.
  @Column({ type: 'int', default: 1 })
  nextSequence: number;

  /** Square 1:1 category banner for retail homepage grid */
  @Column({ type: 'text', nullable: true })
  bannerUrl: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
