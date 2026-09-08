import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';
import type { MarketingChannel, MessageClass } from '../customer-marketing.constants';

@Entity('marketing_templates')
@Index('UQ_marketing_templates_channel_code_ver', ['channel', 'code', 'version'], { unique: true })
export class MarketingTemplateEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 16 })
  channel: MarketingChannel;

  @Column({ length: 80 })
  code: string;

  @Column({ default: 1 })
  version: number;

  @Column()
  title: string;

  @Column({ length: 16, default: 'SMS' })
  medium: 'SMS' | 'CALL';

  @Column({ length: 24, default: 'NURTURE' })
  messageClass: MessageClass;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'text', nullable: true })
  callScript: string | null;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
