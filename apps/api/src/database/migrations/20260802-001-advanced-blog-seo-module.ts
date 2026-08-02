import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Advanced multi-site blog + SEO module (phase 1).
 * - users.blogRole
 * - expand blog_posts SEO / workflow fields
 * - unique (channel, slug)
 * - blog_categories, blog_tags, blog_authors, blog_settings
 * - seo_redirects, seo_audit_logs
 */
export class AdvancedBlogSeoModule1722600000000 implements MigrationInterface {
  name = 'AdvancedBlogSeoModule1722600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "blogRole" varchar(32) NULL;
    `);

    // Drop global unique on slug if present (name varies by TypeORM version)
    await queryRunner.query(`
      DO $$ DECLARE r record;
      BEGIN
        FOR r IN
          SELECT con.conname
          FROM pg_constraint con
          JOIN pg_class rel ON rel.oid = con.conrelid
          WHERE rel.relname = 'blog_posts'
            AND con.contype = 'u'
        LOOP
          EXECUTE format('ALTER TABLE blog_posts DROP CONSTRAINT IF EXISTS %I', r.conname);
        END LOOP;
      END $$;
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_blog_posts_slug";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_blog_posts_slug";`);

    // Resolve slug collisions across channels before composite unique
    await queryRunner.query(`
      WITH dups AS (
        SELECT slug, array_agg(id ORDER BY "createdAt") AS ids
        FROM blog_posts
        GROUP BY slug
        HAVING COUNT(*) > 1
      )
      UPDATE blog_posts p
      SET slug = p.slug || '-' || lower(left(p.channel, 1)) || '-' || left(replace(p.id::text, '-', ''), 6)
      FROM dups
      WHERE p.slug = dups.slug
        AND p.id <> dups.ids[1];
    `);

    const alterCols = `
      ALTER TABLE "blog_posts"
        ADD COLUMN IF NOT EXISTS "contentFormat" varchar NOT NULL DEFAULT 'MARKDOWN',
        ADD COLUMN IF NOT EXISTS "categoryId" uuid NULL,
        ADD COLUMN IF NOT EXISTS "publishAt" TIMESTAMP NULL,
        ADD COLUMN IF NOT EXISTS "focusKeyword" varchar NULL,
        ADD COLUMN IF NOT EXISTS "secondaryKeywords" text NULL,
        ADD COLUMN IF NOT EXISTS "searchIntent" varchar NULL,
        ADD COLUMN IF NOT EXISTS "canonicalType" varchar NOT NULL DEFAULT 'SELF',
        ADD COLUMN IF NOT EXISTS "canonicalUrl" text NULL,
        ADD COLUMN IF NOT EXISTS "robotsIndex" boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS "robotsFollow" boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS "robotsNoArchive" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "robotsNoSnippet" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "maxSnippet" int NULL,
        ADD COLUMN IF NOT EXISTS "maxImagePreview" varchar NOT NULL DEFAULT 'large',
        ADD COLUMN IF NOT EXISTS "maxVideoPreview" int NULL,
        ADD COLUMN IF NOT EXISTS "ogTitle" varchar NULL,
        ADD COLUMN IF NOT EXISTS "ogDescription" text NULL,
        ADD COLUMN IF NOT EXISTS "ogImage" varchar NULL,
        ADD COLUMN IF NOT EXISTS "twitterTitle" varchar NULL,
        ADD COLUMN IF NOT EXISTS "twitterDescription" text NULL,
        ADD COLUMN IF NOT EXISTS "twitterImage" varchar NULL,
        ADD COLUMN IF NOT EXISTS "twitterCard" varchar NOT NULL DEFAULT 'summary_large_image',
        ADD COLUMN IF NOT EXISTS "schemaType" varchar NOT NULL DEFAULT 'BlogPosting',
        ADD COLUMN IF NOT EXISTS "breadcrumbEnabled" boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS "articleSchemaEnabled" boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS "faqSchemaEnabled" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "faqItems" jsonb NULL DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS "primaryCta" jsonb NULL,
        ADD COLUMN IF NOT EXISTS "secondaryCta" jsonb NULL,
        ADD COLUMN IF NOT EXISTS "relatedProductIds" text NULL,
        ADD COLUMN IF NOT EXISTS "relatedArticleIds" text NULL,
        ADD COLUMN IF NOT EXISTS "readingTimeMinutes" int NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "wordCount" int NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "tableOfContentsEnabled" boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS "tableOfContentsDepth" int NOT NULL DEFAULT 3,
        ADD COLUMN IF NOT EXISTS "sitemapEnabled" boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS "sitemapPriority" double precision NOT NULL DEFAULT 0.6,
        ADD COLUMN IF NOT EXISTS "sitemapChangeFrequency" varchar NOT NULL DEFAULT 'monthly',
        ADD COLUMN IF NOT EXISTS "rssEnabled" boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS "isCornerstone" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "isEvergreen" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "redirectOnSlugChange" boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS "authorId" uuid NULL,
        ADD COLUMN IF NOT EXISTS "reviewerId" uuid NULL,
        ADD COLUMN IF NOT EXISTS "createdBy" uuid NULL,
        ADD COLUMN IF NOT EXISTS "updatedBy" uuid NULL;
    `;
    await queryRunner.query(alterCols);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_blog_posts_channel_slug"
      ON "blog_posts" ("channel", "slug");
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_blog_posts_categoryId" ON "blog_posts" ("categoryId");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_blog_posts_authorId" ON "blog_posts" ("authorId");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_blog_posts_focusKeyword" ON "blog_posts" ("focusKeyword");`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "blog_categories" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "channel" varchar NOT NULL,
        "name" varchar NOT NULL,
        "slug" varchar NOT NULL,
        "description" text NULL,
        "seoTitle" varchar NULL,
        "metaDescription" text NULL,
        "focusKeyword" varchar NULL,
        "canonicalUrl" text NULL,
        "robotsIndex" boolean NOT NULL DEFAULT true,
        "robotsFollow" boolean NOT NULL DEFAULT true,
        "featuredImage" varchar NULL,
        "parentId" uuid NULL,
        "sortOrder" int NOT NULL DEFAULT 0,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP NULL,
        CONSTRAINT "PK_blog_categories" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_blog_categories_channel_slug"
      ON "blog_categories" ("channel", "slug");
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_blog_categories_channel" ON "blog_categories" ("channel");`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "blog_tags" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "channel" varchar NOT NULL,
        "name" varchar NOT NULL,
        "slug" varchar NOT NULL,
        "description" text NULL,
        "seoTitle" varchar NULL,
        "metaDescription" text NULL,
        "robotsIndex" boolean NOT NULL DEFAULT false,
        "robotsFollow" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP NULL,
        CONSTRAINT "PK_blog_tags" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_blog_tags_channel_slug"
      ON "blog_tags" ("channel", "slug");
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "blog_authors" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "displayName" varchar NOT NULL,
        "slug" varchar NOT NULL,
        "bio" text NOT NULL DEFAULT '',
        "avatarUrl" varchar NULL,
        "jobTitle" varchar NULL,
        "expertise" text NULL,
        "experienceYears" int NULL,
        "instagramUrl" varchar NULL,
        "linkedinUrl" varchar NULL,
        "websiteUrl" varchar NULL,
        "authorPageEnabled" boolean NOT NULL DEFAULT true,
        "robotsIndex" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP NULL,
        CONSTRAINT "PK_blog_authors" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_blog_authors_userId" UNIQUE ("userId"),
        CONSTRAINT "UQ_blog_authors_slug" UNIQUE ("slug")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "seo_redirects" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "channel" varchar NOT NULL,
        "sourcePath" varchar NOT NULL,
        "destinationUrl" text NOT NULL,
        "statusCode" int NOT NULL DEFAULT 301,
        "reason" varchar NOT NULL DEFAULT 'MANUAL',
        "isActive" boolean NOT NULL DEFAULT true,
        "hitCount" int NOT NULL DEFAULT 0,
        "lastHitAt" TIMESTAMP NULL,
        "createdBy" uuid NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_seo_redirects" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_seo_redirects_channel_source"
      ON "seo_redirects" ("channel", "sourcePath");
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "blog_settings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "channel" varchar NOT NULL,
        "blogTitle" varchar NOT NULL DEFAULT 'وبلاگ ترنم',
        "blogDescription" text NOT NULL DEFAULT '',
        "articlesPerPage" int NOT NULL DEFAULT 12,
        "commentsEnabled" boolean NOT NULL DEFAULT false,
        "rssEnabled" boolean NOT NULL DEFAULT true,
        "defaultAuthorId" uuid NULL,
        "defaultCategoryId" uuid NULL,
        "defaultOgImage" varchar NULL,
        "defaultSchemaType" varchar NOT NULL DEFAULT 'BlogPosting',
        "defaultRobotsIndex" boolean NOT NULL DEFAULT true,
        "defaultRobotsFollow" boolean NOT NULL DEFAULT true,
        "autoGenerateSlug" boolean NOT NULL DEFAULT true,
        "autoCreateRedirect" boolean NOT NULL DEFAULT true,
        "autoGenerateToc" boolean NOT NULL DEFAULT true,
        "autoGenerateReadingTime" boolean NOT NULL DEFAULT true,
        "showAuthor" boolean NOT NULL DEFAULT true,
        "showPublishDate" boolean NOT NULL DEFAULT true,
        "showReadingTime" boolean NOT NULL DEFAULT true,
        "relatedArticlesEnabled" boolean NOT NULL DEFAULT true,
        "relatedProductsEnabled" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_blog_settings" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_blog_settings_channel" UNIQUE ("channel")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "seo_audit_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "channel" varchar NULL,
        "action" varchar NOT NULL,
        "entityType" varchar NULL,
        "entityId" uuid NULL,
        "actorId" uuid NULL,
        "meta" jsonb NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_seo_audit_logs" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_seo_audit_logs_action" ON "seo_audit_logs" ("action");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_seo_audit_logs_createdAt" ON "seo_audit_logs" ("createdAt");`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "seo_audit_logs";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "blog_settings";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "seo_redirects";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "blog_authors";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "blog_tags";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "blog_categories";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_blog_posts_channel_slug";`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "blogRole";`);
    // Column drops omitted intentionally for safety on down in production;
    // re-add unique slug if rolling back fully:
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_blog_posts_slug_rollback" ON "blog_posts" ("slug");
    `);
  }
}
