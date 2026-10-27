import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Live-only unique (channel, slug) for blog_posts and blog_categories so soft-deleted
 * rows do not block recreating the same slug. Mirrors categories live-unique pattern.
 */
export class BlogPostLiveSlugUnique1761523200001 implements MigrationInterface {
  name = 'BlogPostLiveSlugUnique1761523200001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_blog_posts_channel_slug"`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_blog_posts_channel_slug_live"
        ON "blog_posts" ("channel", "slug")
        WHERE "deletedAt" IS NULL
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_blog_categories_channel_slug"`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_blog_categories_channel_slug_live"
        ON "blog_categories" ("channel", "slug")
        WHERE "deletedAt" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const postDupes = await queryRunner.query(`
      SELECT "channel", "slug", COUNT(*)::int AS c
      FROM "blog_posts"
      GROUP BY "channel", "slug"
      HAVING COUNT(*) > 1
      LIMIT 1
    `);
    if (Array.isArray(postDupes) && postDupes.length > 0) {
      throw new Error(
        'Cannot restore UQ_blog_posts_channel_slug: live/deleted duplicate (channel, slug) rows exist. Resolve duplicates first.',
      );
    }

    const catDupes = await queryRunner.query(`
      SELECT "channel", "slug", COUNT(*)::int AS c
      FROM "blog_categories"
      GROUP BY "channel", "slug"
      HAVING COUNT(*) > 1
      LIMIT 1
    `);
    if (Array.isArray(catDupes) && catDupes.length > 0) {
      throw new Error(
        'Cannot restore UQ_blog_categories_channel_slug: live/deleted duplicate (channel, slug) rows exist. Resolve duplicates first.',
      );
    }

    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_blog_posts_channel_slug_live"`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_blog_posts_channel_slug"
        ON "blog_posts" ("channel", "slug")
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_blog_categories_channel_slug_live"`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_blog_categories_channel_slug"
        ON "blog_categories" ("channel", "slug")
    `);
  }
}
