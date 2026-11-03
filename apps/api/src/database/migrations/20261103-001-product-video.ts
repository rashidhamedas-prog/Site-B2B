import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProductVideo1762156800001 implements MigrationInterface {
  name = 'ProductVideo1762156800001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'product_video_status_enum') THEN
          CREATE TYPE "product_video_status_enum" AS ENUM (
            'uploading', 'queued', 'processing', 'ready', 'failed'
          );
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "product_video" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "product_id" uuid NULL,
        "status" "product_video_status_enum" NULL,
        "src_key" varchar NULL,
        "mp4_720_key" varchar NULL,
        "mp4_480_key" varchar NULL,
        "webm_720_key" varchar NULL,
        "poster_key" varchar NULL,
        "poster_candidates" jsonb NULL,
        "duration_sec" real NULL,
        "width" integer NULL,
        "height" integer NULL,
        "bytes_out" bigint NULL,
        "error_code" varchar NULL,
        "sort_order" integer NULL DEFAULT 1,
        "deleted_at" timestamptz NULL,
        "created_at" timestamptz NULL DEFAULT now(),
        "updated_at" timestamptz NULL DEFAULT now(),
        CONSTRAINT "PK_product_video" PRIMARY KEY ("id"),
        CONSTRAINT "FK_product_video_product_id"
          FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_product_video_product_id"
      ON "product_video" ("product_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "product_video"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "product_video_status_enum"`);
  }
}
