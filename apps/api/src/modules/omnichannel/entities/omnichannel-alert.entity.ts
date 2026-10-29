import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

/**
 * PR-13 unanswered (and future ops) alerts. Payload must never include bot tokens.
 */
@Entity('omnichannel_alerts')
@Index('IDX_omnichannel_alerts_status_created', ['status', 'createdAt'])
@Index('UQ_omnichannel_alerts_open_conversation', ['conversationId'], {
  unique: true,
  where: `"status" IN ('open', 'acked') AND "type" = 'bot_unanswered'`,
})
export class OmnichannelAlertEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 32, default: 'bot_unanswered' })
  type: 'bot_unanswered';

  @Column({ type: 'uuid' })
  destinationId: string;

  @Column({ type: 'uuid' })
  conversationId: string;

  @Column({ type: 'varchar', length: 16, default: 'warn' })
  severity: 'info' | 'warn' | 'critical';

  @Column({ type: 'varchar', length: 16, default: 'open' })
  status: 'open' | 'acked' | 'resolved';

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  notifiedOwnerAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  panelSeenAt: Date | null;

  /** Safe detail: ageSec, provider, ownerChatConfigured, notifyErrorCode, notifyAttempts — no secrets. */
  @Column({ type: 'jsonb', default: {} })
  detail: Record<string, unknown>;
}
