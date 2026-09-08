import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

@Entity('marketing_checkout_intents')
@Index('UQ_marketing_checkout_intents_customer_channel', ['customerId', 'channel'], { unique: true })
@Index('IDX_marketing_checkout_intents_started', ['channel', 'startedAt'])
export class MarketingCheckoutIntentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  customerId: string;

  @Column({ length: 16 })
  channel: 'RETAIL' | 'WHOLESALE';

  @Column({ type: 'timestamptz' })
  startedAt: Date;

  @Column({ type: 'uuid', nullable: true })
  completedOrderId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
