import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index,
} from 'typeorm';

/**
 * PR-13 / PR-14 prep: bot message lines (preview only; no secrets).
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

  @Column({ type: 'varchar', length: 128, nullable: true })
  providerMessageId: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
