import { MigrationInterface, QueryRunner } from 'typeorm';

/** Shared product/CMS media registry: url, alt, owner. Additive. */
export class OmnichannelMedia1756471000001 implements MigrationInterface {
  name = 'OmnichannelMedia1756471000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "omnichannel_media_assets" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "publicUrl" varchar NOT NULL,
        "storageKey" varchar NOT NULL,
        "altText" varchar NOT NULL DEFAULT '',
        "ownerType" varchar NOT NULL DEFAULT 'UPLOAD',
        "ownerId" varchar,
        "createdBy" uuid,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_omnichannel_media_publicUrl"
      ON "omnichannel_media_assets" ("publicUrl")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "omnichannel_media_assets"`);
  }
}
