import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

@Entity('cart_signals')
@Index(['channel', 'sessionId'], { unique: true })
export class CartSignalEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 10 })
  channel: 'WHOLESALE' | 'RETAIL';

  @Column({ length: 80 })
  sessionId: string;

  @Column({ length: 16, default: '' })
  phone: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  items: Array<{ productId?: string; name?: string; quantity?: number }>;

  @Column({ type: 'timestamptz' })
  lastItemAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  reminderSentAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
