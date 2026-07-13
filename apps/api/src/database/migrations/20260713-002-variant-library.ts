import { MigrationInterface, QueryRunner } from 'typeorm';

export class VariantLibrary1783881600001 implements MigrationInterface {
  name = 'VariantLibrary1783881600001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "variant_colors" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" varchar NOT NULL,
        "hex" varchar,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_variant_colors_id" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_variant_colors_name_unique" ON "variant_colors" ("name");`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "variant_sizes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "label" varchar NOT NULL,
        "sort" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_variant_sizes_id" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_variant_sizes_label_unique" ON "variant_sizes" ("label");`);

    await queryRunner.query(`ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "colorId" uuid;`);
    await queryRunner.query(`ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "sizeId" uuid;`);

    await queryRunner.query(`
      INSERT INTO "variant_colors" ("name", "hex")
      SELECT DISTINCT pv."color" as name,
        NULLIF(pv."colorHex", '') as hex
      FROM "product_variants" pv
      WHERE pv."color" IS NOT NULL AND pv."color" <> ''
      ON CONFLICT ("name") DO NOTHING;
    `);

    await queryRunner.query(`
      INSERT INTO "variant_sizes" ("label", "sort")
      SELECT DISTINCT pv."size" as label, 0
      FROM "product_variants" pv
      WHERE pv."size" IS NOT NULL AND pv."size" <> ''
      ON CONFLICT ("label") DO NOTHING;
    `);

    await queryRunner.query(`
      UPDATE "product_variants" pv
      SET "colorId" = vc."id"
      FROM "variant_colors" vc
      WHERE pv."colorId" IS NULL AND vc."name" = pv."color";
    `);

    await queryRunner.query(`
      UPDATE "product_variants" pv
      SET "sizeId" = vs."id"
      FROM "variant_sizes" vs
      WHERE pv."sizeId" IS NULL AND vs."label" = pv."size";
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "product_variants"
          ADD CONSTRAINT "FK_product_variants_colorId"
          FOREIGN KEY ("colorId") REFERENCES "variant_colors"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "product_variants"
          ADD CONSTRAINT "FK_product_variants_sizeId"
          FOREIGN KEY ("sizeId") REFERENCES "variant_sizes"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "product_variants" DROP CONSTRAINT IF EXISTS "FK_product_variants_sizeId";`);
    await queryRunner.query(`ALTER TABLE "product_variants" DROP CONSTRAINT IF EXISTS "FK_product_variants_colorId";`);
    await queryRunner.query(`ALTER TABLE "product_variants" DROP COLUMN IF EXISTS "sizeId";`);
    await queryRunner.query(`ALTER TABLE "product_variants" DROP COLUMN IF EXISTS "colorId";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_variant_sizes_label_unique";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "variant_sizes";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_variant_colors_name_unique";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "variant_colors";`);
  }
}
