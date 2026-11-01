import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

export type BotConversationState =
  | 'MENU'
  | 'PRODUCT_LOOKUP'
  | 'VARIANT'
  | 'QTY'
  | 'CUSTOMER_INFO'
  | 'SUMMARY'
  | 'PFI_CREATED'
  | 'SENSITIVE_HOLD'
  | 'SUPPORT'
  | 'TRACK';

/**
 * PR-13 / PR-14: bot conversation store (FSM + inbox + unanswered scanner).
 */
@Entity('omnichannel_bot_conversations')
@Index('IDX_omnichannel_bot_conversations_dest_status', ['destinationId', 'status'])
@Index('IDX_omnichannel_bot_conversations_last_customer', ['lastCustomerMessageAt'])
export class OmnichannelBotConversationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  destinationId: string;

  @Column({ type: 'uuid', nullable: true })
  connectionId: string | null;

  @Column({ type: 'varchar', length: 32 })
  provider: string;

  /** Customer chat id as reported by provider — never invent. */
  @Column({ type: 'varchar', length: 128 })
  customerChatId: string;

  /** Usually = customerChatId; optional denorm for adapters. */
  @Column({ type: 'varchar', length: 128, nullable: true })
  externalChatId: string | null;

  @Column({ type: 'varchar', length: 32, default: 'MENU' })
  state: BotConversationState;

  /** SKU/variant/qty/… — never tokens/secrets. */
  @Column({ type: 'jsonb', default: () => "'{}'" })
  statePayload: Record<string, unknown>;

  /** e.g. ["sensitive", "spam_flag"]. */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  tags: string[];

  @Column({ type: 'timestamptz', nullable: true })
  unansweredSince: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  autoRepliedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastInboundAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastOutboundAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastCustomerMessageAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastStaffReplyAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  orderId: string | null;

  @Column({ type: 'uuid', nullable: true })
  invoiceId: string | null;

  @Column({ type: 'varchar', length: 16, default: 'open' })
  status: 'open' | 'closed';

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
