import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * PDP guide cards: optional image + short excerpt on each internal link.
 * Additive / reversible. Existing rows stay valid (both columns nullable).
 */
export class InternalLinkGuideCards1757462400001 implements MigrationInterface {
  name = 'InternalLinkGuideCards1757462400001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "product_internal_link"
        ADD COLUMN IF NOT EXISTS "imageUrl" text NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "product_internal_link"
        ADD COLUMN IF NOT EXISTS "excerpt" text NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "product_internal_link" DROP COLUMN IF EXISTS "excerpt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_internal_link" DROP COLUMN IF EXISTS "imageUrl"`,
    );
  }
}
