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

  @Index({ unique: true })
  @Column({ nullable: true })
  slug: string | null;

  @Column({ type: 'varchar', nullable: true })
  nameEn: string | null;

  @Column({ type: 'text', nullable: true })
  seoTitle: string | null;

  @Column({ type: 'text', nullable: true })
  seoDescription: string | null;

  @Column({ type: 'text', nullable: true })
  h1: string | null;

  @Column({ type: 'text', nullable: true })
  introText: string | null;

  @Column({ type: 'text', nullable: true })
  bottomContent: string | null;

  @Column({ type: 'text', nullable: true })
  heroImage: string | null;

  @Column({ type: 'text', nullable: true })
  heroImageAlt: string | null;

  @Column({ type: 'text', nullable: true })
  ogImage: string | null;

  @Column({ type: 'text', nullable: true })
  canonicalOverride: string | null;

  @Column({ default: true })
  isIndexable: boolean;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @Column({ default: 'ACTIVE' })
  status: string;

  @Column({ type: 'jsonb', nullable: true })
  faqItems: Array<{ question: string; answer: string }> | null;

  @Column({ type: 'text', nullable: true })
  wholesaleH1: string | null;

  @Column({ type: 'text', nullable: true })
  wholesaleSeoTitle: string | null;

  @Column({ type: 'text', nullable: true })
  wholesaleSeoDescription: string | null;

  @Column({ type: 'text', nullable: true })
  wholesaleIntroText: string | null;

  @Column({ type: 'text', nullable: true })
  wholesaleBottomContent: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
