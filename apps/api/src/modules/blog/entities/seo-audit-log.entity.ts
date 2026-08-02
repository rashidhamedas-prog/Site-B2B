import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('seo_audit_logs')
export class SeoAuditLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  @Index()
  channel: string | null;

  @Column()
  @Index()
  action: string;

  @Column({ nullable: true })
  entityType: string | null;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  entityId: string | null;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  actorId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  meta: Record<string, unknown> | null;

  @CreateDateColumn()
  @Index()
  createdAt: Date;
}
