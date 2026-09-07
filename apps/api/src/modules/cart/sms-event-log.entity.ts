import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('sms_event_log')
export class SmsEventLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 160 })
  @Index({ unique: true })
  eventKey: string;

  @Column({ length: 40 })
  event: string;

  @Column({ length: 10, nullable: true })
  channel: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
