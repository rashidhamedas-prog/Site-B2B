import { MigrationInterface, QueryRunner } from 'typeorm';

/** Phase 2: revisions, media library, comments, analytics, howto, optimistic lock */
export class BlogPhase2Extensions1722610000000 implements MigrationInterface {
  name = 'BlogPhase2Extensions1722610000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

    await queryRunner.query(`
      ALTER TABLE "blog_posts"
        ADD COLUMN IF NOT EXISTS "version" int NOT NULL DEFAULT 1,
        ADD COLUMN IF NOT EXISTS "howToData" jsonb NULL,
        ADD COLUMN IF NOT EXISTS "howToSchemaEnabled" boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS "commentsEnabled" boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS "relatedArticleMode" varchar NOT NULL DEFAULT 'HYBRID';
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "blog_media_assets" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "channel" varchar NULL,
        "originalFileName" varchar NOT NULL,
        "storedFileName" varchar NOT NULL,
        "mimeType" varchar NOT NULL,
        "extension" varchar NOT NULL,
        "width" int NOT NULL DEFAULT 0,
        "height" int NOT NULL DEFAULT 0,
        "fileSize" int NOT NULL DEFAULT 0,
        "storageProvider" varchar NOT NULL DEFAULT 'S3',
        "storageKey" varchar NOT NULL,
        "publicUrl" varchar NOT NULL,
        "title" varchar NULL,
        "altText" varchar NOT NULL DEFAULT '',
        "caption" text NULL,
        "description" text NULL,
        "creditName" varchar NULL,
        "creditUrl" varchar NULL,
        "focalPointX" double precision NULL,
        "focalPointY" double precision NULL,
        "isDecorative" boolean NOT NULL DEFAULT false,
        "contentHash" varchar NULL,
        "createdBy" uuid NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_blog_media_assets" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_blog_media_channel" ON "blog_media_assets" ("channel");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_blog_media_hash" ON "blog_media_assets" ("contentHash");`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "blog_article_revisions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "articleId" uuid NOT NULL,
        "versionNumber" int NOT NULL,
        "snapshot" jsonb NOT NULL,
        "changeSummary" text NULL,
        "createdBy" uuid NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_blog_article_revisions" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_blog_revisions_article" ON "blog_article_revisions" ("articleId", "versionNumber");`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "blog_comments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "articleId" uuid NOT NULL,
        "name" varchar NOT NULL,
        "email" varchar NOT NULL,
        "content" text NOT NULL,
        "status" varchar NOT NULL DEFAULT 'PENDING',
        "parentId" uuid NULL,
        "ipHash" varchar NULL,
        "userAgent" text NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_blog_comments" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_blog_comments_article" ON "blog_comments" ("articleId");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_blog_comments_status" ON "blog_comments" ("status");`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "blog_analytics" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "articleId" uuid NOT NULL,
        "pageViews" int NOT NULL DEFAULT 0,
        "uniqueViews" int NOT NULL DEFAULT 0,
        "avgEngagementTime" double precision NULL,
        "scroll25" int NOT NULL DEFAULT 0,
        "scroll50" int NOT NULL DEFAULT 0,
        "scroll75" int NOT NULL DEFAULT 0,
        "scroll90" int NOT NULL DEFAULT 0,
        "ctaClicks" int NOT NULL DEFAULT 0,
        "productClicks" int NOT NULL DEFAULT 0,
        "internalLinkClicks" int NOT NULL DEFAULT 0,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_blog_analytics" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_blog_analytics_article" UNIQUE ("articleId")
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "blog_analytics";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "blog_comments";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "blog_article_revisions";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "blog_media_assets";`);
    await queryRunner.query(`ALTER TABLE "blog_posts" DROP COLUMN IF EXISTS "relatedArticleMode";`);
    await queryRunner.query(`ALTER TABLE "blog_posts" DROP COLUMN IF EXISTS "commentsEnabled";`);
    await queryRunner.query(`ALTER TABLE "blog_posts" DROP COLUMN IF EXISTS "howToSchemaEnabled";`);
    await queryRunner.query(`ALTER TABLE "blog_posts" DROP COLUMN IF EXISTS "howToData";`);
    await queryRunner.query(`ALTER TABLE "blog_posts" DROP COLUMN IF EXISTS "version";`);
  }
}
