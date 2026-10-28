import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * PR-6: audit goRef/source, users.omnichannelRole, append-only trigger on omnichannel_audits.
 * Additive only — keeps 20260829-001 baseline.
 */
export class OmnichannelAuditRbac1761624000001 implements MigrationInterface {
  name = 'OmnichannelAuditRbac1761624000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "omnichannel_audits"
        ADD COLUMN IF NOT EXISTS "goRef" varchar NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "omnichannel_audits"
        ADD COLUMN IF NOT EXISTS "source" varchar NOT NULL DEFAULT 'panel'
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_omnichannel_audits_createdAt"
      ON "omnichannel_audits" ("createdAt" DESC)
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "omnichannelRole" varchar(32) NULL
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION omnichannel_audits_append_only()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        RAISE EXCEPTION 'omnichannel_audits is append-only';
      END;
      $$
    `);
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS trg_omnichannel_audits_append_only ON "omnichannel_audits"
    `);
    await queryRunner.query(`
      CREATE TRIGGER trg_omnichannel_audits_append_only
      BEFORE UPDATE OR DELETE ON "omnichannel_audits"
      FOR EACH ROW
      EXECUTE FUNCTION omnichannel_audits_append_only()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS trg_omnichannel_audits_append_only ON "omnichannel_audits"
    `);
    await queryRunner.query(`DROP FUNCTION IF EXISTS omnichannel_audits_append_only()`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_omnichannel_audits_createdAt"`);
    await queryRunner.query(`
      ALTER TABLE "omnichannel_audits" DROP COLUMN IF EXISTS "goRef"
    `);
    await queryRunner.query(`
      ALTER TABLE "omnichannel_audits" DROP COLUMN IF EXISTS "source"
    `);
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN IF EXISTS "omnichannelRole"
    `);
  }
}
