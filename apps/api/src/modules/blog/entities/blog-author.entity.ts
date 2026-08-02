import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';

@Entity('blog_authors')
export class BlogAuthorEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  userId: string;

  @Column()
  displayName: string;

  @Column({ unique: true })
  @Index()
  slug: string;

  @Column({ type: 'text', default: '' })
  bio: string;

  @Column({ nullable: true })
  avatarUrl: string | null;

  @Column({ nullable: true })
  jobTitle: string | null;

  @Column({ type: 'simple-array', nullable: true })
  expertise: string[];

  @Column({ type: 'int', nullable: true })
  experienceYears: number | null;

  @Column({ nullable: true })
  instagramUrl: string | null;

  @Column({ nullable: true })
  linkedinUrl: string | null;

  @Column({ nullable: true })
  websiteUrl: string | null;

  @Column({ default: true })
  authorPageEnabled: boolean;

  @Column({ default: true })
  robotsIndex: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;
}
