import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/**
 * Append-only panel audit stream (DB trigger blocks UPDATE/DELETE).
 * payload may hold before/after summaries — never provider tokens.
 * source: panel | out_of_panel (future ingest).
 */
@Entity('omnichannel_audits')
@Index('IDX_omnichannel_audits_entity', ['entityType', 'entityId'])
@Index('IDX_omnichannel_audits_createdAt', ['createdAt'])
export class OmnichannelAuditEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  actorId: string;

  @Column({ type: 'varchar' })
  action: string;

  @Column({ type: 'varchar' })
  entityType: string;

  @Column({ type: 'varchar' })
  entityId: string;

  @Column({ type: 'varchar', nullable: true })
  channel: string | null;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  /** Written GO from Hamed for Owner-tier mutations when RBAC is on. */
  @Column({ type: 'varchar', nullable: true })
  goRef: string | null;

  /** panel (default) | out_of_panel — never tokens. */
  @Column({ type: 'varchar', default: 'panel' })
  source: string;

  /**
   * Structured summary / before-after. Secrets forbidden (assertNoPlaintextSecrets on write).
   */
  @Column({ type: 'jsonb', default: {} })
  payload: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
