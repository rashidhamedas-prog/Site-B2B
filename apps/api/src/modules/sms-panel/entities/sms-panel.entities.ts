import {
  Entity,
  PrimaryGeneratedColumn,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('sms_template')
export class SmsTemplateEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 80, unique: true })
  key: string;

  @Column({ length: 160 })
  name: string;

  @Column({ length: 24 })
  messageClass: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'jsonb', default: [] })
  variables: string[];

  @Column({ type: 'varchar', length: 64, nullable: true })
  providerTemplateId: string | null;

  @Column({ type: 'int', default: 1 })
  version: number;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string | null;

  @UpdateDateColumn()
  updatedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}

@Entity('sms_contact_list')
export class SmsContactListEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 160 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ length: 16 })
  type: string; // STATIC | DYNAMIC

  @Column({ type: 'jsonb', nullable: true })
  filter: Record<string, unknown> | null;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('sms_contact_list_member')
export class SmsContactListMemberEntity {
  @PrimaryColumn({ type: 'uuid' })
  listId: string;

  @PrimaryColumn({ length: 16 })
  phoneNormalized: string;

  @Column({ type: 'varchar', nullable: true })
  customerId: string | null;

  @Column({ type: 'jsonb', default: {} })
  vars: Record<string, string>;

  @CreateDateColumn({ name: 'addedAt' })
  addedAt: Date;
}

@Entity('sms_campaign')
export class SmsCampaignEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 200 })
  name: string;

  @Column({ length: 24 })
  messageClass: string;

  @Column({ type: 'uuid', nullable: true })
  templateId: string | null;

  @Column({ type: 'text' })
  bodySnapshot: string;

  @Column({ type: 'uuid', nullable: true })
  listId: string | null;

  @Column({ type: 'uuid', nullable: true })
  segmentId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  audienceSpec: { sources?: string[]; rules?: unknown[] } | null;

  @Column({ type: 'jsonb', nullable: true })
  varFallbacks: Record<string, string> | null;

  @Column({ type: 'jsonb', nullable: true })
  segmentFilter: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  audienceSnapshotHash: string | null;

  @Column({ type: 'int', default: 0 })
  recipientCount: number;

  @Column({ type: 'int', default: 0 })
  estimatedParts: number;

  @Column({ type: 'int', default: 0 })
  estimatedCost: number;

  @Column({ type: 'timestamp', nullable: true })
  scheduledAt: Date | null;

  @Column({ length: 32, default: 'DRAFT' })
  status: string;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string | null;

  @Column({ type: 'uuid', nullable: true })
  confirmedBy: string | null;

  @Column({ type: 'uuid', nullable: true })
  approvedBy: string | null;

  @Column({ type: 'timestamp', nullable: true })
  confirmedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  approvedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  rejectReason: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('sms_confirmation')
export class SmsConfirmationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  campaignId: string;

  @Column({ length: 128 })
  tokenHash: string;

  @Column({ length: 128 })
  payloadHash: string;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  usedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  actorId: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  otpHash: string | null;

  @Column({ type: 'timestamp', nullable: true })
  otpExpiresAt: Date | null;

  @Column({ type: 'int', default: 0 })
  otpAttempts: number;

  @CreateDateColumn()
  createdAt: Date;
}

@Entity('sms_campaign_recipient')
export class SmsCampaignRecipientEntity {
  @PrimaryColumn({ type: 'uuid' })
  campaignId: string;

  @PrimaryColumn({ length: 16 })
  phoneNormalized: string;

  @Column({ type: 'varchar', nullable: true })
  customerId: string | null;

  @Column({ type: 'int', default: 1 })
  parts: number;
}

@Entity('sms_message')
@Index(['status', 'nextAttemptAt'])
@Index(['phoneNormalized', 'createdAt'])
export class SmsMessageEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  campaignId: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  templateKey: string | null;

  @Column({ length: 24 })
  messageClass: string;

  @Column({ length: 16 })
  phoneNormalized: string;

  @Column({ type: 'varchar', nullable: true })
  customerId: string | null;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'int', default: 1 })
  parts: number;

  @Column({ length: 32, default: 'QUEUED' })
  status: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  skipReason: string | null;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ type: 'timestamp', nullable: true })
  nextAttemptAt: Date | null;

  @Column({ length: 160, unique: true })
  idempotencyKey: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  provider: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  providerMessageId: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  packId: string | null;

  @Column({ type: 'int', nullable: true })
  cost: number | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  deliveryState: string | null;

  @Column({ type: 'timestamp', nullable: true })
  deliveredAt: Date | null;

  @Column({ type: 'text', nullable: true })
  lastError: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('sms_unsubscribe')
export class SmsUnsubscribeEntity {
  @PrimaryColumn({ length: 16 })
  phoneNormalized: string;

  @Column({ length: 16, default: 'PROMO' })
  scope: string;

  @Column({ length: 24 })
  source: string;

  @Column({ type: 'timestamp', default: () => 'now()' })
  at: Date;

  @Column({ type: 'timestamp', nullable: true })
  resubscribedAt: Date | null;
}

@Entity('sms_blacklist')
export class SmsBlacklistEntity {
  @PrimaryColumn({ length: 16 })
  phoneNormalized: string;

  @Column({ length: 16, default: 'ALL' })
  scope: string;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string | null;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}

@Entity('sms_inbound')
export class SmsInboundEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 120, unique: true })
  providerId: string;

  @Column({ name: 'from', length: 16 })
  from: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'timestamp' })
  receivedAt: Date;

  @Column({ type: 'varchar', length: 32, nullable: true })
  handledAs: string | null;

  @CreateDateColumn()
  createdAt: Date;
}

@Entity('sms_audit_log')
export class SmsAuditLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  actorId: string | null;

  @Column({ length: 64 })
  action: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  targetType: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  targetId: string | null;

  @Column({ type: 'jsonb', default: {} })
  meta: Record<string, unknown>;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip: string | null;

  @Column({ type: 'text', nullable: true })
  userAgent: string | null;

  @Column({ type: 'timestamp', default: () => 'now()' })
  at: Date;
}

@Entity('sms_credit_snapshot')
export class SmsCreditSnapshotEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int' })
  amount: number;

  @Column({ length: 8, default: 'SMS' })
  unit: string;

  @Column({ type: 'timestamp', default: () => 'now()' })
  at: Date;
}

@Entity('sms_segment')
export class SmsSegmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 120 })
  name: string;

  @Column({ type: 'text', array: true, default: '{}' })
  sources: string[];

  @Column({ type: 'jsonb', default: () => "'[]'" })
  rules: Array<{ field: string; op: string; value: unknown }>;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

export const SMS_PANEL_ENTITIES = [
  SmsTemplateEntity,
  SmsContactListEntity,
  SmsContactListMemberEntity,
  SmsCampaignEntity,
  SmsConfirmationEntity,
  SmsCampaignRecipientEntity,
  SmsMessageEntity,
  SmsUnsubscribeEntity,
  SmsBlacklistEntity,
  SmsInboundEntity,
  SmsAuditLogEntity,
  SmsCreditSnapshotEntity,
  SmsSegmentEntity,
];
