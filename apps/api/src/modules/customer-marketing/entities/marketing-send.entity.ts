import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';
import type { MarketingChannel, MarketingMode, MessageClass, SendStatus } from '../customer-marketing.constants';

@Entity('marketing_sends')
@Index('UQ_marketing_sends_idempotency', ['idempotencyKey'], { unique: true })
@Index('IDX_marketing_sends_phone_created', ['phoneNormalized', 'createdAt'])
export class MarketingSendEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  customerId: string | null;

  @Column({ length: 16 })
  channel: MarketingChannel;

  @Column({ length: 20, default: '' })
  phoneNormalized: string;

  @Column({ type: 'uuid', nullable: true })
  campaignId: string | null;

  @Column({ type: 'uuid', nullable: true })
  enrollmentId: string | null;

  @Column({ type: 'uuid', nullable: true })
  templateId: string | null;

  @Column({ length: 80, nullable: true })
  templateCode: string | null;

  @Column({ length: 24, default: 'NURTURE' })
  messageClass: MessageClass;

  @Column({ length: 16, default: 'OFF' })
  mode: MarketingMode;

  @Column({ length: 16, default: 'QUEUED' })
  status: SendStatus;

  @Column({ length: 32, nullable: true })
  skipReason: string | null;

  @Column({ type: 'uuid', nullable: true })
  outboxEventId: string | null;

  @Column({ type: 'varchar', nullable: true })
  providerMessageId: string | null;

  @Column({ type: 'text' })
  bodySnapshot: string;

  @Column()
  idempotencyKey: string;

  @Column({ type: 'varchar', nullable: true })
  recipientActual: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
