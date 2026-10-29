import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

/**
 * PR-13 / PR-14 prep: bot conversation store.
 * Inbound writers land in PR-14; PR-13 scanner + tests seed rows only.
 */
@Entity('omnichannel_bot_conversations')
@Index('IDX_omnichannel_bot_conversations_dest_status', ['destinationId', 'status'])
@Index('IDX_omnichannel_bot_conversations_last_customer', ['lastCustomerMessageAt'])
export class OmnichannelBotConversationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  destinationId: string;

  @Column({ type: 'varchar', length: 32 })
  provider: string;

  /** Customer chat id as reported by provider — never invent; empty only for test fixtures when unused. */
  @Column({ type: 'varchar', length: 128 })
  customerChatId: string;

  @Column({ type: 'timestamptz', nullable: true })
  lastCustomerMessageAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastStaffReplyAt: Date | null;

  @Column({ type: 'varchar', length: 16, default: 'open' })
  status: 'open' | 'closed';

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
