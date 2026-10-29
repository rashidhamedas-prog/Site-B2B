import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index,
} from 'typeorm';

/**
 * PR-13 / PR-14: bot message lines (preview + optional masked body; no secrets).
 */
@Entity('omnichannel_bot_messages')
@Index('IDX_omnichannel_bot_messages_conversation', ['conversationId', 'createdAt'])
export class OmnichannelBotMessageEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  conversationId: string;

  @Column({ type: 'varchar', length: 16 })
  direction: 'inbound' | 'outbound' | 'system';

  /** Truncated preview ≤ 200 chars. */
  @Column({ type: 'varchar', length: 200, default: '' })
  bodyPreview: string;

  /** Optional thread body (masked PII); never tokens. */
  @Column({ type: 'text', nullable: true })
  body: string | null;

  /** Denorm for unique (provider, providerMessageId) idempotency. */
  @Column({ type: 'varchar', length: 32, nullable: true })
  provider: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  providerMessageId: string | null;

  /** Buttons/sku meta — no secrets. */
  @Column({ type: 'jsonb', nullable: true })
  meta: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
