import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Product ↔ many categories. products.categoryId stays the denormalized primary.
 * Additive / reversible. Backfill copies existing primary rows.
 */
export class ProductCategoryMembership1757670000002 implements MigrationInterface {
  name = 'ProductCategoryMembership1757670000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "product_category_membership" (
        "productId" uuid NOT NULL,
        "categoryId" uuid NOT NULL,
        "isPrimary" boolean NOT NULL DEFAULT false,
        "sortOrder" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_product_category_membership" PRIMARY KEY ("productId", "categoryId"),
        CONSTRAINT "FK_pcm_product" FOREIGN KEY ("productId")
          REFERENCES "products"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_pcm_category" FOREIGN KEY ("categoryId")
          REFERENCES "categories"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_product_category_membership_primary"
        ON "product_category_membership" ("productId")
        WHERE "isPrimary" = true
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_product_category_membership_category"
        ON "product_category_membership" ("categoryId")
    `);
    await queryRunner.query(`
      INSERT INTO "product_category_membership" ("productId", "categoryId", "isPrimary", "sortOrder")
      SELECT p."id", p."categoryId", true, 0
      FROM "products" p
      WHERE p."categoryId" IS NOT NULL
        AND p."deletedAt" IS NULL
      ON CONFLICT ("productId", "categoryId") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "product_category_membership"`);
  }
}
