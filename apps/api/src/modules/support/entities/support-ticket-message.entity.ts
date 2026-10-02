import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { SupportTicketEntity } from './support-ticket.entity';

@Entity('support_ticket_messages')
@Index('IDX_support_ticket_messages_ticket_created', ['ticketId', 'createdAt'])
export class SupportTicketMessageEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  ticketId: string;

  @ManyToOne(() => SupportTicketEntity, (t) => t.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ticketId' })
  ticket?: SupportTicketEntity;

  /** CUSTOMER | STAFF | SYSTEM */
  @Column({ type: 'varchar', length: 16 })
  authorType: string;

  @Column({ type: 'uuid', nullable: true })
  authorUserId: string | null;

  @Column({ type: 'text' })
  body: string;

  /** Staff-only notes never shown to customer */
  @Column({ type: 'boolean', default: false })
  isInternal: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
