import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import { asciiSlug, hasNonAsciiSlug } from '../../../common/ascii-slug';

@Entity('collections')
export class CollectionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  slug: string;

  @Column({ nullable: true })
  season: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  imageUrl: string;

  /** WHOLESALE | RETAIL */
  @Column({ default: 'WHOLESALE' })
  channel: string;

  @Column({ default: true })
  isActive: boolean;

  @BeforeInsert()
  @BeforeUpdate()
  ensureSlug() {
    if (!this.slug || hasNonAsciiSlug(this.slug)) {
      this.slug = asciiSlug(this.name || this.slug || 'collection');
    } else {
      this.slug = asciiSlug(this.slug, 'collection');
    }
  }

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
