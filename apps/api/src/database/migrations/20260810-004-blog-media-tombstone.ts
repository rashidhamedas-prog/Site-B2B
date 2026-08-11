import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Soft-delete / purge outbox columns for blog media.
 * Physical object delete happens after tombstone commit; metadata purge is retryable.
 */
export class BlogMediaTombstone1754823600001 implements MigrationInterface {
  name = 'BlogMediaTombstone1754823600001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "blog_media_assets"
      ADD COLUMN IF NOT EXISTS "purgeStatus" varchar DEFAULT 'ACTIVE'
    `);
    await queryRunner.query(`
      ALTER TABLE "blog_media_assets"
      ADD COLUMN IF NOT EXISTS "tombstonedAt" TIMESTAMPTZ
    `);
    await queryRunner.query(`
      ALTER TABLE "blog_media_assets"
      ADD COLUMN IF NOT EXISTS "tombstonedByUserId" uuid
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "blog_media_delete_audits" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "mediaId" uuid NOT NULL,
        "publicUrl" text,
        "actorUserId" uuid,
        "action" varchar NOT NULL,
        "detail" text,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_blog_media_delete_audits_mediaId"
      ON "blog_media_delete_audits" ("mediaId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_blog_media_delete_audits_mediaId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "blog_media_delete_audits"`);
    await queryRunner.query(
      `ALTER TABLE "blog_media_assets" DROP COLUMN IF EXISTS "tombstonedByUserId"`
    );
    await queryRunner.query(`ALTER TABLE "blog_media_assets" DROP COLUMN IF EXISTS "tombstonedAt"`);
    await queryRunner.query(`ALTER TABLE "blog_media_assets" DROP COLUMN IF EXISTS "purgeStatus"`);
  }
}
