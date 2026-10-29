import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * PR-11: additive health columns on omnichannel_media_assets.
 * No messenger schema. Owner: Postgres backup on Iran before apply.
 */
export class OmnichannelMediaHealth1761740000001 implements MigrationInterface {
  name = 'OmnichannelMediaHealth1761740000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "omnichannel_media_assets"
      ADD COLUMN IF NOT EXISTS "healthStatus" varchar NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "omnichannel_media_assets"
      ADD COLUMN IF NOT EXISTS "healthCheckedAt" TIMESTAMPTZ NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "omnichannel_media_assets"
      ADD COLUMN IF NOT EXISTS "healthDetail" varchar NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_omnichannel_media_healthStatus"
      ON "omnichannel_media_assets" ("healthStatus")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_omnichannel_media_healthStatus"`);
    await queryRunner.query(`
      ALTER TABLE "omnichannel_media_assets" DROP COLUMN IF EXISTS "healthDetail"
    `);
    await queryRunner.query(`
      ALTER TABLE "omnichannel_media_assets" DROP COLUMN IF EXISTS "healthCheckedAt"
    `);
    await queryRunner.query(`
      ALTER TABLE "omnichannel_media_assets" DROP COLUMN IF EXISTS "healthStatus"
    `);
  }
}
