/**
 * npx ts-node --transpile-only src/modules/blog/blog-soft-deleted-slug.spec.ts
 *
 * Behavioral coverage for live-only slug reuse after soft delete (no real DB).
 */
import { ConflictException } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { BlogService } from './blog.service';
import {
  BLOG_RESTORE_SLUG_CONFLICT,
  BLOG_SLUG_LIVE_CONFLICT,
  blogArticlePath,
} from './blog-slug-live';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

type PostRow = {
  id: string;
  channel: string;
  slug: string;
  title: string;
  content: string;
  status: string;
  deletedAt: Date | null;
  version: number;
  redirectOnSlugChange?: boolean;
  publishedAt?: Date | null;
  category?: string;
  categoryId?: string | null;
  tags?: string[];
  authorId?: string | null;
  createdBy?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
  views?: number;
  wordCount?: number;
};

type RedirectRow = {
  id: string;
  channel: string;
  sourcePath: string;
  destinationUrl: string;
  reason: string;
  isActive: boolean;
  statusCode?: number;
  createdBy?: string | null;
};

function makeService(opts?: { failSaveUnique?: boolean; failRestoreUnique?: boolean }) {
  const posts: PostRow[] = [];
  const redirects: RedirectRow[] = [];
  const audits: Array<Record<string, unknown>> = [];
  let seq = 0;

  const postRepo: any = {
    findOne: async (findOpts: {
      where: Partial<PostRow> & { id?: string };
      withDeleted?: boolean;
    }) => {
      const w = findOpts.where || {};
      return (
        posts.find((p) => {
          if (w.id && p.id !== w.id) return false;
          if (w.slug && p.slug !== w.slug) return false;
          if (w.channel && p.channel !== w.channel) return false;
          if (!findOpts.withDeleted && p.deletedAt) return false;
          return true;
        }) || null
      );
    },
    find: async () => posts.filter((p) => !p.deletedAt),
    create: (data: Partial<PostRow>) => ({ ...data }),
    save: async (row: PostRow) => {
      if (opts?.failSaveUnique) {
        const err = new Error('duplicate') as Error & { code: string };
        err.code = '23505';
        throw err;
      }
      if (!row.id) {
        row.id = `p${++seq}`;
        row.createdAt = new Date();
        posts.push(row);
      } else {
        const i = posts.findIndex((p) => p.id === row.id);
        if (i >= 0) posts[i] = row;
        else posts.push(row);
      }
      return row;
    },
    softDelete: async (id: string) => {
      const p = posts.find((x) => x.id === id);
      if (p) p.deletedAt = new Date();
      return { affected: p ? 1 : 0 };
    },
    restore: async (id: string) => {
      if (opts?.failRestoreUnique) {
        const err = new Error('duplicate') as Error & { code: string };
        err.code = '23505';
        throw err;
      }
      const p = posts.find((x) => x.id === id);
      if (!p || !p.deletedAt) return { affected: 0 };
      p.deletedAt = null;
      return { affected: 1 };
    },
    delete: async (id: string) => {
      const i = posts.findIndex((x) => x.id === id);
      if (i >= 0) posts.splice(i, 1);
      return { affected: i >= 0 ? 1 : 0 };
    },
    manager: {
      transaction: async (fn: (m: any) => Promise<unknown>) => {
        const manager = {
          getRepository: (entity: { name?: string }) => {
            const name = entity?.name || '';
            if (name.includes('SeoRedirect') || name === 'SeoRedirectEntity') {
              return {
                find: async (findOpts: { where: Partial<RedirectRow> }) =>
                  redirects.filter((r) => {
                    const w = findOpts.where || {};
                    if (w.channel && r.channel !== w.channel) return false;
                    if (w.sourcePath && r.sourcePath !== w.sourcePath) return false;
                    if (w.reason && r.reason !== w.reason) return false;
                    if (w.isActive != null && r.isActive !== w.isActive) return false;
                    return true;
                  }),
                save: async (row: RedirectRow) => {
                  const i = redirects.findIndex((r) => r.id === row.id);
                  if (i >= 0) redirects[i] = row;
                  else redirects.push(row);
                  return row;
                },
                create: (d: Partial<RedirectRow>) => ({ id: `r${++seq}`, ...d }),
              };
            }
            if (name.includes('SeoAudit') || name === 'SeoAuditLogEntity') {
              return {
                create: (d: Record<string, unknown>) => d,
                save: async (d: Record<string, unknown>) => {
                  audits.push(d);
                  return d;
                },
              };
            }
            return {
              findOne: postRepo.findOne,
              save: async (row: PostRow) => postRepo.save(row),
              restore: async (id: string) => postRepo.restore(id),
            };
          },
        };
        return fn(manager);
      },
    },
  };

  const redirectRepo: any = {
    create: (d: Partial<RedirectRow>) => ({ id: `r${++seq}`, isActive: true, ...d }),
    save: async (row: RedirectRow) => {
      const i = redirects.findIndex((r) => r.id === row.id);
      if (i >= 0) redirects[i] = row;
      else redirects.push(row);
      return row;
    },
    find: async () => redirects,
    findOne: async () => null,
  };

  const auditRepo: any = {
    create: (d: Record<string, unknown>) => d,
    save: async (d: Record<string, unknown>) => {
      audits.push(d);
      return d;
    },
  };

  const emptyRepo: any = {
    findOne: async () => null,
    find: async () => [],
    create: (d: unknown) => d,
    save: async (d: unknown) => d,
    softDelete: async () => ({ affected: 0 }),
  };

  const outbox: any = { enqueue: async () => undefined };

  const svc = new BlogService(
    postRepo,
    emptyRepo,
    emptyRepo,
    emptyRepo,
    redirectRepo,
    emptyRepo,
    auditRepo,
    outbox,
  );

  return { svc, posts, redirects, audits };
}

async function run() {
  const svcSrc = readFileSync(join(__dirname, 'blog.service.ts'), 'utf8');
  assert(/assertLiveSlugAvailable/.test(svcSrc), 'live slug helper used');
  assert(/deactivateArticleDeletedRedirects/.test(svcSrc), 'redirect deactivate on create');
  assert(/BLOG_RESTORE_SLUG_CONFLICT/.test(svcSrc), 'restore conflict wired');
  assert(/deleted\?: 'only' \| 'include'/.test(svcSrc), 'admin trash filter');

  const entitySrc = readFileSync(join(__dirname, 'entities/blog-post.entity.ts'), 'utf8');
  assert(/UQ_blog_posts_channel_slug_live/.test(entitySrc), 'entity live index');
  assert(/where:\s*'"deletedAt" IS NULL'/.test(entitySrc), 'entity partial where');

  {
    const { svc, posts, redirects } = makeService();
    const first = await svc.create({
      channel: 'RETAIL',
      title: 'اول',
      slug: 'my-article',
      content: 'متن',
      status: 'PUBLISHED',
    } as any);
    redirects.push({
      id: 'rd1',
      channel: 'RETAIL',
      sourcePath: blogArticlePath('my-article'),
      destinationUrl: '/blog/other',
      reason: 'ARTICLE_DELETED',
      isActive: true,
    });
    await svc.remove(first.id, { strategy: 'UNPUBLISH' });
    assert(posts[0].deletedAt != null, 'soft deleted');

    const second = await svc.create({
      channel: 'RETAIL',
      title: 'دوم',
      slug: 'my-article',
      content: 'متن جدید',
      status: 'DRAFT',
    } as any);
    assert(second.slug === 'my-article', 'reuse slug after soft delete');
    assert(redirects.find((r) => r.id === 'rd1')?.isActive === false, 'ARTICLE_DELETED redirect deactivated');
  }

  {
    const { svc } = makeService();
    await svc.create({
      channel: 'WHOLESALE',
      title: 'A',
      slug: 'dup',
      content: 'x',
    } as any);
    let hit = false;
    try {
      await svc.create({
        channel: 'WHOLESALE',
        title: 'B',
        slug: 'dup',
        content: 'y',
      } as any);
    } catch (e) {
      hit = e instanceof ConflictException && String((e as any).message).includes(BLOG_SLUG_LIVE_CONFLICT);
    }
    assert(hit, 'live duplicate 409');
  }

  {
    const { svc, posts } = makeService();
    const old = await svc.create({
      channel: 'RETAIL',
      title: 'قدیم',
      slug: 'shared',
      content: 'a',
    } as any);
    await svc.remove(old.id, {});
    await svc.create({
      channel: 'RETAIL',
      title: 'جدید',
      slug: 'shared',
      content: 'b',
    } as any);
    let hit = false;
    try {
      await svc.restore(old.id);
    } catch (e) {
      hit =
        e instanceof ConflictException &&
        String((e as any).message).includes(BLOG_RESTORE_SLUG_CONFLICT);
    }
    assert(hit, 'restore conflict 409');
    assert(posts.find((p) => p.id === old.id)?.deletedAt != null, 'tombstone remains');
  }

  // create maps Postgres 23505 → ConflictException
  {
    const { svc } = makeService({ failSaveUnique: true });
    // bypass live check by using a free slug, then fail on save
    let hit = false;
    try {
      await svc.create({
        channel: 'RETAIL',
        title: 'race',
        slug: 'race-slug',
        content: 'x',
      } as any);
    } catch (e) {
      hit = e instanceof ConflictException && String((e as any).message).includes(BLOG_SLUG_LIVE_CONFLICT);
    }
    assert(hit, 'create 23505 → live conflict');
  }

  // restore maps Postgres 23505 → ConflictException (race after live check)
  {
    const { svc } = makeService({ failRestoreUnique: true });
    const old = await svc.create({
      channel: 'RETAIL',
      title: 'tomb',
      slug: 'race-restore',
      content: 'a',
    } as any);
    await svc.remove(old.id, {});
    let hit = false;
    try {
      await svc.restore(old.id);
    } catch (e) {
      hit =
        e instanceof ConflictException &&
        String((e as any).message).includes(BLOG_RESTORE_SLUG_CONFLICT);
    }
    assert(hit, 'restore 23505 → restore conflict');
  }

  console.log('blog-soft-deleted-slug.spec ok');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
