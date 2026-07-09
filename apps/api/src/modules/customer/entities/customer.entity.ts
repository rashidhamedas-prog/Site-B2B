import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn,
} from 'typeorm';

@Entity('customers')
export class CustomerEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  code: string;

  @Column()
  businessName: string;

  @Column()
  ownerName: string;

  @Column({ unique: true })
  phone: string;

  @Column({ nullable: true })
  phone2: string;

  @Column({ nullable: true })
  email: string;

  @Column({ default: 'B2B' })
  type: string;

  @Column({ default: 'C' })
  segment: string;

  @Column({ default: 'PENDING' })
  status: string;

  @Column()
  province: string;

  @Column()
  city: string;

  @Column({ nullable: true, type: 'text' })
  address: string;

  @Column({ nullable: true })
  postalCode: string;

  @Column({ nullable: true })
  nationalId: string;

  @Column({ default: 'RETAIL' })
  businessType: string;

  @Column({ type: 'bigint', default: 0 })
  creditLimit: number;

  @Column({ type: 'bigint', default: 0 })
  balance: number;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true, type: 'text' })
  notes: string;

  @Column({ nullable: true })
  referredBy: string;

  @Column({ nullable: true })
  assignedAgentId: string;

  @Column({ nullable: true })
  telegramId: string;

  @Column({ nullable: true })
  instagramHandle: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
