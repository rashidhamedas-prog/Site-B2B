import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCategories1783881600000 implements MigrationInterface {
  name = 'CreateCategories1783881600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "categories" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" varchar NOT NULL,
        "skuPrefix" varchar NOT NULL DEFAULT '',
        "nextSequence" integer NOT NULL DEFAULT 1,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP,
        CONSTRAINT "PK_categories_id" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_categories_name_unique" ON "categories" ("name");`);

    await queryRunner.query(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "categoryId" uuid;`);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "products"
          ADD CONSTRAINT "FK_products_categoryId"
          FOREIGN KEY ("categoryId") REFERENCES "categories"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_products_categoryId" ON "products" ("categoryId");`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_products_categoryId";`);
    await queryRunner.query(`ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "FK_products_categoryId";`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "categoryId";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_categories_name_unique";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "categories";`);
  }
}
