import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn,
} from 'typeorm';

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  phone: string;

  @Column({ nullable: true })
  email: string;

  @Column()
  passwordHash: string;

  @Column({ default: 'CUSTOMER' })
  role: string;

  /**
   * Blog ACL when role=ADMIN (null ⇒ SUPER_ADMIN for backward compatibility).
   * SUPER_ADMIN | SEO_MANAGER | CONTENT_MANAGER | EDITOR | AUTHOR | REVIEWER | VIEWER
   */
  @Column({ type: 'varchar', length: 32, nullable: true })
  blogRole: string | null;

  @Column({ nullable: true })
  customerId: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  lastLoginAt: Date;

  /** When set, JWTs with iat before this second are rejected. */
  @Column({ type: 'timestamptz', nullable: true })
  passwordChangedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
