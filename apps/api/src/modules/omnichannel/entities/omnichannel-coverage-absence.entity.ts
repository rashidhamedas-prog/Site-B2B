import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

/**
 * PR-8: operator «دلیل عدم‌پوشش» per product (row-wide) or product×destination.
 * destinationId null = applies to all destinations for the product.
 */
@Entity('omnichannel_coverage_absence')
@Index('UQ_omnichannel_coverage_absence_product_dest', ['productId', 'destinationId'], {
  unique: true,
  where: `"destinationId" IS NOT NULL`,
})
@Index('UQ_omnichannel_coverage_absence_product_row', ['productId'], {
  unique: true,
  where: `"destinationId" IS NULL`,
})
export class OmnichannelCoverageAbsenceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  productId: string;

  /** null = row-wide default for all destinations. */
  @Column({ type: 'uuid', nullable: true })
  destinationId: string | null;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'uuid' })
  actorId: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
