import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('sales_partner_notice_receipts')
@Unique('UQ_sales_partner_notice_receipt', ['noticeId', 'salesPartnerId'])
export class SalesPartnerNoticeReceiptEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  noticeId: string;

  @Index()
  @Column({ type: 'uuid' })
  salesPartnerId: string;

  @Column({ type: 'timestamptz' })
  seenAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  dismissedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
