import { MigrationInterface, QueryRunner } from 'typeorm';

/** Lower number is shown first in the partner catalog and order picker. Null stays after ranked products. */
export class SalesPartnerDisplayPriority1760822400003 implements MigrationInterface {
  name = 'SalesPartnerDisplayPriority1760822400003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "sales_partner_product_eligibility" ADD COLUMN IF NOT EXISTS "displayPriority" integer`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "sales_partner_product_eligibility" DROP COLUMN IF EXISTS "displayPriority"`,
    );
  }
}
