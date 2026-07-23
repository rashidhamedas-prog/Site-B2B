import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

@Entity('return_requests')
export class ReturnRequestEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  orderId: string;

  @Column()
  orderItemId: string;

  @Column()
  customerId: string;

  @Column({ type: 'text' })
  reason: string;

  @Column({ nullable: true })
  requestedSize: string;

  /** RETURN | EXCHANGE */
  @Column({ default: 'RETURN' })
  requestType: string;

  /** PENDING | APPROVED | REJECTED | COMPLETED */
  @Column({ default: 'PENDING' })
  status: string;

  /** WALLET | BANK | NONE */
  @Column({ default: 'WALLET' })
  refundType: string;

  @Column({ type: 'text', nullable: true })
  adminNote: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
