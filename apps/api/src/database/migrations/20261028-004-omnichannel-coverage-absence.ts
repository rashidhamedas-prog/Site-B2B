import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * PR-8: coverage absence-reason table (additive, nullable destination).
 * No backup required for empty table; owner GO still gates deploy.
 */
export class OmnichannelCoverageAbsence1761640000001 implements MigrationInterface {
  name = 'OmnichannelCoverageAbsence1761640000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "omnichannel_coverage_absence" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "productId" uuid NOT NULL,
        "destinationId" uuid NULL,
        "reason" text NOT NULL,
        "actorId" uuid NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_omnichannel_coverage_absence_product"
          FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_omnichannel_coverage_absence_product_dest"
      ON "omnichannel_coverage_absence" ("productId", "destinationId")
      WHERE "destinationId" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_omnichannel_coverage_absence_product_row"
      ON "omnichannel_coverage_absence" ("productId")
      WHERE "destinationId" IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_omnichannel_coverage_absence_product"
      ON "omnichannel_coverage_absence" ("productId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_omnichannel_coverage_absence_product"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_omnichannel_coverage_absence_product_row"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_omnichannel_coverage_absence_product_dest"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "omnichannel_coverage_absence"`);
  }
}
