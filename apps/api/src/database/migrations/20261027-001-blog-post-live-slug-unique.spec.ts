/**
 * npx ts-node --transpile-only src/database/migrations/20261027-001-blog-post-live-slug-unique.spec.ts
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { BlogPostLiveSlugUnique1761523200001 } from './20261027-001-blog-post-live-slug-unique';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const src = readFileSync(join(__dirname, '20261027-001-blog-post-live-slug-unique.ts'), 'utf8');

assert(/UQ_blog_posts_channel_slug_live/.test(src), 'live post unique');
assert(/UQ_blog_categories_channel_slug_live/.test(src), 'live category unique');
assert(/WHERE "deletedAt" IS NULL/.test(src), 'partial unique');
assert(/DROP INDEX IF EXISTS "UQ_blog_posts_channel_slug"/.test(src), 'drop full post unique');
assert(/DROP INDEX IF EXISTS "UQ_blog_categories_channel_slug"/.test(src), 'drop full category unique');
assert(/CREATE UNIQUE INDEX IF NOT EXISTS "UQ_blog_posts_channel_slug_live"/.test(src), 'idempotent create');
assert(/live\/deleted duplicate/.test(src), 'down refuses when duplicates exist');
assert(/DROP INDEX IF EXISTS "UQ_blog_posts_channel_slug_live"/.test(src), 'down drops live unique');
assert(!!new BlogPostLiveSlugUnique1761523200001(), 'class');
console.log('20261027-001-blog-post-live-slug-unique.spec ok');
