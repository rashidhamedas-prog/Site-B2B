import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
} from 'typeorm';

@Entity('inventory_movements')
export class InventoryMovementEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  productVariantId: string;

  @Column()
  type: string;

  @Column()
  quantity: number;

  @Column()
  balanceAfter: number;

  @Column({ nullable: true })
  referenceId: string;

  @Column({ nullable: true })
  referenceType: string;

  @Column({ nullable: true, type: 'text' })
  notes: string;

  @Column({ nullable: true })
  createdBy: string;

  @CreateDateColumn()
  createdAt: Date;
}
