import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

// Key-value application settings, one row per settings group
// (business, shipping, sms, payment). Values are free-form JSON.
@Entity('app_settings')
export class AppSettingEntity {
  @PrimaryColumn()
  key: string;

  @Column({ type: 'jsonb' })
  value: Record<string, any>;

  @UpdateDateColumn()
  updatedAt: Date;
}
