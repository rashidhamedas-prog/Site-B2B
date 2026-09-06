import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Product internal-link SEO feature.
 *
 * Adds a dedicated `product_internal_link` table so each product can carry a
 * curated, channel-scoped list of internal links (anchor text + rel + target)
 * for SEO. Links are fully separated per channel (RETAIL vs WHOLESALE):
 *   - a `channel` column scopes every row
 *   - the source product FK cascades on hard delete
 *   - targetId is a soft reference (validated in the service) so it can point
 *     to products, categories, blog posts, or be null for CUSTOM urls
 *
 * Additive / backward compatible. No data backfill. Reversible.
 */
export class ProductInternalLinks1757116800001 implements MigrationInterface {
  name = 'ProductInternalLinks1757116800001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "product_internal_link" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "productId" uuid NOT NULL,
        "channel" varchar(10) NOT NULL,
        "targetType" varchar(12) NOT NULL,
        "targetId" uuid NULL,
        "targetUrl" text NOT NULL,
        "anchorText" text NOT NULL,
        "title" text NULL,
        "rel" varchar(12) NOT NULL DEFAULT 'dofollow',
        "sortOrder" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_product_internal_link_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_product_internal_link_product" FOREIGN KEY ("productId")
          REFERENCES "products"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_product_internal_link_channel"
          CHECK ("channel" IN ('RETAIL','WHOLESALE')),
        CONSTRAINT "CHK_product_internal_link_targetType"
          CHECK ("targetType" IN ('PRODUCT','CATEGORY','BLOG','CUSTOM')),
        CONSTRAINT "CHK_product_internal_link_rel"
          CHECK ("rel" IN ('dofollow','nofollow','sponsored')),
        CONSTRAINT "CHK_product_internal_link_custom_url"
          CHECK ("targetType" <> 'CUSTOM' OR "targetUrl" IS NOT NULL)
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_product_internal_link_product_channel"
         ON "product_internal_link" ("productId", "channel")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_product_internal_link_inbound"
         ON "product_internal_link" ("channel", "targetType", "targetId")`,
    );

    // Prevent duplicate PRODUCT/CATEGORY/BLOG targets (targetId NOT NULL) per product+channel.
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_product_internal_link_named_target"
         ON "product_internal_link" ("productId", "channel", "targetType", "targetId")
         WHERE "targetId" IS NOT NULL`,
    );
    // Prevent duplicate CUSTOM urls per product+channel.
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_product_internal_link_custom"
         ON "product_internal_link" ("productId", "channel", "targetUrl")
         WHERE "targetType" = 'CUSTOM'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_product_internal_link_custom"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_product_internal_link_named_target"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_product_internal_link_inbound"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_product_internal_link_product_channel"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "product_internal_link"`);
  }
}
