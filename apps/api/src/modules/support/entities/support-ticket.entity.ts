import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { SupportTicketMessageEntity } from './support-ticket-message.entity';

@Entity('support_tickets')
@Index('IDX_support_tickets_customer_channel', ['customerId', 'channel', 'createdAt'])
@Index('IDX_support_tickets_status_channel', ['status', 'channel', 'updatedAt'])
@Index('IDX_support_tickets_assignee', ['assigneeUserId', 'status'])
@Index('UQ_support_tickets_publicNumber', ['publicNumber'], { unique: true })
export class SupportTicketEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Human-facing id e.g. SUP-20261002-A3F2 */
  @Column({ type: 'varchar', length: 32 })
  publicNumber: string;

  @Column({ type: 'uuid' })
  customerId: string;

  /** RETAIL | WHOLESALE */
  @Column({ type: 'varchar', length: 16 })
  channel: string;

  @Column({ type: 'varchar', length: 200 })
  subject: string;

  /** ORDER | PRODUCT | PAYMENT | SHIPPING | ACCOUNT | OTHER */
  @Column({ type: 'varchar', length: 32, default: 'OTHER' })
  category: string;

  /** LOW | NORMAL | HIGH | URGENT */
  @Column({ type: 'varchar', length: 16, default: 'NORMAL' })
  priority: string;

  /** OPEN | IN_PROGRESS | WAITING_CUSTOMER | RESOLVED | CLOSED */
  @Column({ type: 'varchar', length: 32, default: 'OPEN' })
  status: string;

  @Column({ type: 'uuid', nullable: true })
  orderId: string | null;

  @Column({ type: 'uuid', nullable: true })
  assigneeUserId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastCustomerMessageAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastStaffMessageAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  closedAt: Date | null;

  @OneToMany(() => SupportTicketMessageEntity, (m) => m.ticket)
  messages?: SupportTicketMessageEntity[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
