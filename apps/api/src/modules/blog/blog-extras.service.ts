import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, ILike } from 'typeorm';
import { createHash } from 'crypto';
import { BlogPostEntity } from './entities/blog-post.entity';
import { BlogArticleRevisionEntity } from './entities/blog-article-revision.entity';
import { BlogMediaAssetEntity } from './entities/blog-media-asset.entity';
import { BlogCommentEntity } from './entities/blog-comment.entity';
import { BlogAnalyticsEntity } from './entities/blog-analytics.entity';
import { BlogAuthorEntity } from './entities/blog-author.entity';
import { analyzeSeo, type SEOAnalysisInput } from './blog-seo-analysis';
import { sanitizeBlogHtml } from './blog-sanitize';
import { StorageService } from '../upload/storage.service';
import { ProductEntity } from '../product/entities/product.entity';
import { RedisService } from '../redis/redis.module';

type Actor = { id?: string; role?: string; blogRole?: string | null };

@Injectable()
export class BlogExtrasService {
  constructor(
    @InjectRepository(BlogPostEntity) private readonly postRepo: Repository<BlogPostEntity>,
    @InjectRepository(BlogArticleRevisionEntity)
    private readonly revRepo: Repository<BlogArticleRevisionEntity>,
    @InjectRepository(BlogMediaAssetEntity)
    private readonly mediaRepo: Repository<BlogMediaAssetEntity>,
    @InjectRepository(BlogCommentEntity)
    private readonly commentRepo: Repository<BlogCommentEntity>,
    @InjectRepository(BlogAnalyticsEntity)
    private readonly analyticsRepo: Repository<BlogAnalyticsEntity>,
    @InjectRepository(BlogAuthorEntity) private readonly authorRepo: Repository<BlogAuthorEntity>,
    @InjectRepository(ProductEntity) private readonly productRepo: Repository<ProductEntity>,
    private readonly storage: StorageService,
    private readonly dataSource: DataSource,
    private readonly redis: RedisService
  ) {}

  // ── SEO analysis ──────────────────────────────────────────

  analyze(input: SEOAnalysisInput) {
    return analyzeSeo(input);
  }

  async analyzePost(id: string) {
    const post = await this.postRepo.findOne({ where: { id } });
    if (!post) throw new NotFoundException('مطلب یافت نشد');
    return analyzeSeo({
      title: post.title,
      seoTitle: post.seoTitle,
      metaDescription: post.seoDescription,
      focusKeyword: post.focusKeyword,
      slug: post.slug,
      content: post.content,
      excerpt: post.excerpt,
      coverImage: post.coverImage,
      coverAlt: post.title,
      faqItems: post.faqItems,
      primaryCta: post.primaryCta,
      relatedArticleIds: post.relatedArticleIds,
      relatedProductIds: post.relatedProductIds,
      authorName: post.authorName,
      publishedAt: post.publishedAt,
      updatedAt: post.updatedAt,
      canonicalType: post.canonicalType,
      robotsIndex: post.robotsIndex,
      ogTitle: post.ogTitle,
      ogImage: post.ogImage,
      articleSchemaEnabled: post.articleSchemaEnabled,
      breadcrumbEnabled: post.breadcrumbEnabled,
    });
  }

  // ── Revisions + optimistic lock ───────────────────────────

  async saveRevision(articleId: string, actor?: Actor, changeSummary?: string) {
    const post = await this.postRepo.findOne({ where: { id: articleId } });
    if (!post) throw new NotFoundException('مطلب یافت نشد');
    const maxRev = Number(process.env.BLOG_MAX_REVISIONS || 50);
    const last = await this.revRepo.findOne({
      where: { articleId },
      order: { versionNumber: 'DESC' },
    });
    const versionNumber = (last?.versionNumber || 0) + 1;
    const snapshot = { ...post } as unknown as Record<string, unknown>;
    const saved = await this.revRepo.save(
      this.revRepo.create({
        articleId,
        versionNumber,
        snapshot,
        changeSummary: changeSummary || null,
        createdBy: actor?.id || null,
      })
    );

    const all = await this.revRepo.find({
      where: { articleId },
      order: { versionNumber: 'ASC' },
    });
    if (all.length > maxRev) {
      const toDelete = all.slice(0, all.length - maxRev);
      await this.revRepo.remove(toDelete);
    }
    return saved;
  }

  async listRevisions(articleId: string) {
    return this.revRepo.find({
      where: { articleId },
      order: { versionNumber: 'DESC' },
      take: 50,
    });
  }

  async restoreRevision(articleId: string, revisionId: string, actor?: Actor) {
    const rev = await this.revRepo.findOne({ where: { id: revisionId, articleId } });
    if (!rev) throw new NotFoundException('نسخه یافت نشد');
    await this.saveRevision(articleId, actor, `قبل از بازگردانی به نسخه ${rev.versionNumber}`);
    const snap = rev.snapshot as Partial<BlogPostEntity>;
    const post = await this.postRepo.findOne({ where: { id: articleId } });
    if (!post) throw new NotFoundException('مطلب یافت نشد');
    const { id: _id, createdAt: _c, ...rest } = snap as any;
    Object.assign(post, rest, {
      version: (post.version || 1) + 1,
      updatedBy: actor?.id || null,
    });
    return this.postRepo.save(post);
  }

  async autosave(
    id: string,
    data: Partial<BlogPostEntity> & { expectedVersion?: number },
    actor?: Actor
  ) {
    const post = await this.postRepo.findOne({ where: { id } });
    if (!post) throw new NotFoundException('مطلب یافت نشد');
    if (
      data.expectedVersion != null &&
      post.version != null &&
      data.expectedVersion !== post.version
    ) {
      throw new ConflictException({
        message: 'تداخل ویرایش — نسخه دیگری ذخیره شده است',
        currentVersion: post.version,
      });
    }
    if (data.content && data.contentFormat === 'HTML') {
      data.content = sanitizeBlogHtml(data.content);
    }
    const { expectedVersion: _ev, ...patch } = data as any;
    Object.assign(post, patch, {
      version: (post.version || 1) + 1,
      updatedBy: actor?.id || null,
    });
    const saved = await this.postRepo.save(post);
    await this.saveRevision(id, actor, 'autosave');
    return saved;
  }

  // ── Media library ─────────────────────────────────────────

  async listMedia(opts: { channel?: string; search?: string; page?: number; limit?: number }) {
    const page = Math.max(1, Number(opts.page) || 1);
    const limit = Math.min(50, Number(opts.limit) || 24);
    const where: any = {};
    if (opts.channel) where.channel = opts.channel.toUpperCase();
    if (opts.search) {
      return this.mediaRepo.find({
        where: [
          { ...where, originalFileName: ILike(`%${opts.search}%`) },
          { ...where, altText: ILike(`%${opts.search}%`) },
          { ...where, title: ILike(`%${opts.search}%`) },
        ],
        order: { createdAt: 'DESC' },
        skip: (page - 1) * limit,
        take: limit,
      });
    }
    return this.mediaRepo.find({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  async registerMedia(opts: {
    channel?: string;
    originalFileName: string;
    url: string;
    key: string;
    mimeType: string;
    extension: string;
    width?: number;
    height?: number;
    fileSize?: number;
    altText?: string;
    title?: string;
    caption?: string;
    createdBy?: string;
    contentHash?: string;
  }) {
    if (opts.contentHash) {
      const dup = await this.mediaRepo.findOne({ where: { contentHash: opts.contentHash } });
      if (dup) return { ...dup, duplicate: true };
    }
    const storedFileName = opts.key.split('/').pop() || opts.key;
    const saved = await this.mediaRepo.save(
      this.mediaRepo.create({
        channel: opts.channel ? opts.channel.toUpperCase() : null,
        originalFileName: opts.originalFileName,
        storedFileName,
        mimeType: opts.mimeType,
        extension: opts.extension,
        width: opts.width || 0,
        height: opts.height || 0,
        fileSize: opts.fileSize || 0,
        storageProvider: 'S3',
        storageKey: opts.key,
        publicUrl: opts.url,
        altText: opts.altText || '',
        title: opts.title || null,
        caption: opts.caption || null,
        contentHash: opts.contentHash || null,
        createdBy: opts.createdBy || null,
      })
    );
    return { ...saved, duplicate: false };
  }

  async updateMedia(id: string, data: Partial<BlogMediaAssetEntity>) {
    const row = await this.mediaRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('رسانه یافت نشد');
    Object.assign(row, data);
    return this.mediaRepo.save(row);
  }

  /**
   * Tombstone → storage delete → metadata purge (retryable).
   * Storage failure leaves TOMBSTONED metadata (never orphans a deleted object without DB state).
   * Missing object on retry is idempotent success.
   */
  async removeMedia(id: string, opts?: { forceReplace?: boolean; actorUserId?: string }) {
    const url = await this.dataSource.transaction(async (manager) => {
      const row = await manager
        .getRepository(BlogMediaAssetEntity)
        .createQueryBuilder('m')
        .setLock('pessimistic_write')
        .where('m.id = :id', { id })
        .getOne();
      if (!row) throw new NotFoundException('رسانه یافت نشد');

      if (row.purgeStatus === 'PURGED') {
        return null; // already gone — idempotent
      }

      const usages = await this.findMediaUsages(row.publicUrl);
      if (usages.length > 0 && !opts?.forceReplace) {
        throw new ConflictException({
          message: 'رسانه در مطالب ارجاع دارد',
          usages,
        });
      }

      row.purgeStatus = 'TOMBSTONED';
      row.tombstonedAt = new Date();
      row.tombstonedByUserId = opts?.actorUserId || null;
      await manager.getRepository(BlogMediaAssetEntity).save(row);
      await manager.query(
        `INSERT INTO blog_media_delete_audits ("id","mediaId","publicUrl","actorUserId","action","detail","createdAt")
         VALUES (gen_random_uuid(), $1, $2, $3, 'TOMBSTONE', $4, NOW())`,
        [row.id, row.publicUrl, opts?.actorUserId || null, 'reference-checked tombstone']
      );
      return row.publicUrl;
    });

    if (url === null) {
      return { deleted: true, idempotent: true };
    }

    try {
      await this.storage.deleteByUrls([url]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/NoSuchKey|not found|404|NotFound/i.test(msg)) {
        // Metadata remains TOMBSTONED for retry — do not delete DB row.
        await this.mediaRepo.query(
          `INSERT INTO blog_media_delete_audits ("id","mediaId","publicUrl","actorUserId","action","detail","createdAt")
           VALUES (gen_random_uuid(), $1, $2, $3, 'STORAGE_FAIL', $4, NOW())`,
          [id, url, opts?.actorUserId || null, msg.slice(0, 500)]
        );
        throw err;
      }
      // missing object → continue to purge metadata
    }

    await this.mediaRepo.delete(id);
    await this.mediaRepo.query(
      `INSERT INTO blog_media_delete_audits ("id","mediaId","publicUrl","actorUserId","action","detail","createdAt")
       VALUES (gen_random_uuid(), $1, $2, $3, 'PURGED', 'storage deleted; metadata removed', NOW())`,
      [id, url, opts?.actorUserId || null]
    );
    return { deleted: true };
  }

  /** Detect cover/OG/Twitter/body references to a media URL. */
  async findMediaUsages(url: string) {
    if (!url) return [];
    const posts = await this.postRepo
      .createQueryBuilder('p')
      .where('p.deletedAt IS NULL')
      .andWhere(
        `(p.coverImage = :url OR p.ogImage = :url OR p.twitterImage = :url OR p.content ILIKE :like)`,
        { url, like: `%${url}%` }
      )
      .select([
        'p.id',
        'p.title',
        'p.slug',
        'p.channel',
        'p.coverImage',
        'p.ogImage',
        'p.twitterImage',
        'p.content',
      ])
      .take(50)
      .getMany();

    return posts.map((p) => {
      const refs: string[] = [];
      if (p.coverImage === url) refs.push('coverImage');
      if (p.ogImage === url) refs.push('ogImage');
      if (p.twitterImage === url) refs.push('twitterImage');
      if (p.content?.includes(url)) refs.push('body');
      return { articleId: p.id, title: p.title, slug: p.slug, channel: p.channel, refs };
    });
  }

  hashBuffer(buf: Buffer): string {
    return createHash('sha256').update(buf).digest('hex');
  }

  // ── Internal links / related ──────────────────────────────

  async suggestInternalLinks(opts: {
    channel: string;
    articleId?: string;
    q?: string;
    limit?: number;
  }) {
    const channel = opts.channel.toUpperCase() === 'RETAIL' ? 'RETAIL' : 'WHOLESALE';
    const limit = Math.min(20, Number(opts.limit) || 8);
    const qb = this.postRepo
      .createQueryBuilder('p')
      .where('p.channel = :channel', { channel })
      .andWhere("p.status = 'PUBLISHED'")
      .andWhere('p.deletedAt IS NULL');
    if (opts.articleId) qb.andWhere('p.id != :id', { id: opts.articleId });
    if (opts.q) {
      qb.andWhere('(p.title ILIKE :q OR p.slug ILIKE :q OR p.focusKeyword ILIKE :q)', {
        q: `%${opts.q}%`,
      });
    }
    const posts = await qb.orderBy('p.publishedAt', 'DESC').take(limit).getMany();
    return posts.map((p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      url: `/blog/${p.slug}`,
      suggestedAnchor: p.focusKeyword || p.title,
      robotsIndex: p.robotsIndex,
    }));
  }

  async suggestRelatedArticles(articleId: string) {
    const post = await this.postRepo.findOne({ where: { id: articleId } });
    if (!post) throw new NotFoundException('مطلب یافت نشد');
    const qb = this.postRepo
      .createQueryBuilder('p')
      .where('p.channel = :channel', { channel: post.channel })
      .andWhere("p.status = 'PUBLISHED'")
      .andWhere('p.id != :id', { id: articleId })
      .andWhere('p.deletedAt IS NULL');
    if (post.categoryId) {
      qb.andWhere('(p.categoryId = :cid OR p.focusKeyword = :kw)', {
        cid: post.categoryId,
        kw: post.focusKeyword || '',
      });
    }
    const items = await qb.orderBy('p.publishedAt', 'DESC').take(6).getMany();
    return items;
  }

  async findOrphanArticles(channel: string) {
    const ch = channel.toUpperCase() === 'RETAIL' ? 'RETAIL' : 'WHOLESALE';
    const published = await this.postRepo.find({
      where: { channel: ch, status: 'PUBLISHED' },
      select: ['id', 'slug', 'title', 'relatedArticleIds'],
    });
    const incoming = new Set<string>();
    for (const p of published) {
      for (const id of p.relatedArticleIds || []) incoming.add(id);
    }
    return published.filter((p) => !incoming.has(p.id));
  }

  async resolveRelatedProducts(ids: string[], channel?: string) {
    if (!ids?.length) return [];
    const where: any = { id: ids as any };
    // TypeORM In
    const products = await this.productRepo
      .createQueryBuilder('p')
      .where('p.id IN (:...ids)', { ids })
      .andWhere('p.deletedAt IS NULL')
      .getMany();
    return products
      .filter((p) => {
        if (!channel) return true;
        const ch = channel.toUpperCase();
        if (ch === 'RETAIL') return p.showOnRetail !== false;
        return p.showOnWholesale !== false;
      })
      .map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        slug: p.slug,
        price: channel === 'RETAIL' ? p.retailPrice : p.wholesalePrice,
        image: Array.isArray(p.images) && p.images[0] ? p.images[0] : null,
        stock: p.stock,
        status: p.status,
      }));
  }

  async searchProducts(q: string, channel?: string, limit = 12) {
    const qb = this.productRepo
      .createQueryBuilder('p')
      .where('(p.name ILIKE :q OR p.sku ILIKE :q)', { q: `%${q}%` })
      .andWhere('p.deletedAt IS NULL')
      .take(Math.min(30, limit));
    if (channel?.toUpperCase() === 'RETAIL') qb.andWhere('p.showOnRetail = true');
    if (channel?.toUpperCase() === 'WHOLESALE') qb.andWhere('p.showOnWholesale = true');
    return qb.getMany();
  }

  // ── Comments ──────────────────────────────────────────────

  async listComments(articleId: string, status?: string) {
    const where: any = { articleId };
    if (status) where.status = status;
    return this.commentRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  async listPublicComments(articleId: string) {
    return this.commentRepo.find({
      where: { articleId, status: 'APPROVED' },
      order: { createdAt: 'ASC' },
      select: ['id', 'name', 'content', 'parentId', 'createdAt'],
    });
  }

  async createComment(
    articleId: string,
    data: { name: string; email: string; content: string; parentId?: string; honeypot?: string },
    meta?: { ip?: string; userAgent?: string }
  ) {
    if (data.honeypot) return { ok: true }; // silently drop bots
    const post = await this.postRepo.findOne({ where: { id: articleId, status: 'PUBLISHED' } });
    if (!post) throw new NotFoundException('مطلب یافت نشد');
    if (post.commentsEnabled === false) throw new ForbiddenException('نظرات این مطلب غیرفعال است');

    const content = sanitizeBlogHtml(data.content)
      .replace(/<[^>]+>/g, '')
      .trim();
    if (content.length < 3 || content.length > 2000) {
      throw new BadRequestException('طول نظر نامعتبر است');
    }

    // Simple rate limit via recent comments from same ip hash
    const ipHash = meta?.ip
      ? createHash('sha256').update(meta.ip).digest('hex').slice(0, 32)
      : null;
    if (ipHash) {
      const recent = await this.commentRepo
        .createQueryBuilder('c')
        .where('c.ipHash = :ipHash', { ipHash })
        .andWhere("c.createdAt > NOW() - INTERVAL '2 minutes'")
        .getCount();
      if (recent >= 3) throw new BadRequestException('تعداد درخواست‌ها زیاد است؛ کمی صبر کنید');
    }

    return this.commentRepo.save(
      this.commentRepo.create({
        articleId,
        name: data.name.trim().slice(0, 80),
        email: data.email.trim().slice(0, 120),
        content,
        status: 'PENDING',
        parentId: data.parentId || null,
        ipHash,
        userAgent: meta?.userAgent?.slice(0, 300) || null,
      })
    );
  }

  async moderateComment(id: string, status: 'APPROVED' | 'REJECTED' | 'SPAM') {
    const row = await this.commentRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('نظر یافت نشد');
    row.status = status;
    return this.commentRepo.save(row);
  }

  // ── Analytics ─────────────────────────────────────────────

  private static readonly ANALYTICS_EVENTS = new Set([
    'view',
    'scroll25',
    'scroll50',
    'scroll75',
    'scroll90',
    'cta',
    'product',
    'internal',
  ]);

  private static readonly RL_WINDOW_SEC = 60;
  private static readonly RL_MAX = 60;
  private static readonly RL_MEMORY_MAX_KEYS = 10_000;
  private static readonly UV_TTL_SEC = 86_400;
  /** Bounded in-memory fallback when Redis is down (never unbounded). */
  private static analyticsHits = new Map<string, number[]>();

  private ipHash(ip?: string): string {
    return ip ? createHash('sha256').update(ip).digest('hex').slice(0, 24) : 'anon';
  }

  private assertMemoryRateLimit(key: string) {
    const now = Date.now();
    const windowMs = BlogExtrasService.RL_WINDOW_SEC * 1000;
    const prev = (BlogExtrasService.analyticsHits.get(key) || []).filter((t) => now - t < windowMs);
    if (prev.length >= BlogExtrasService.RL_MAX) {
      throw new HttpException('تعداد درخواست‌های آمار زیاد است', HttpStatus.TOO_MANY_REQUESTS);
    }
    prev.push(now);
    BlogExtrasService.analyticsHits.set(key, prev);
    if (BlogExtrasService.analyticsHits.size > BlogExtrasService.RL_MEMORY_MAX_KEYS) {
      // Evict expired / oldest keys to keep memory bounded under spoof floods.
      for (const [k, times] of BlogExtrasService.analyticsHits) {
        const kept = times.filter((t) => now - t < windowMs);
        if (kept.length === 0) BlogExtrasService.analyticsHits.delete(k);
        else BlogExtrasService.analyticsHits.set(k, kept);
        if (BlogExtrasService.analyticsHits.size <= BlogExtrasService.RL_MEMORY_MAX_KEYS) break;
      }
      while (BlogExtrasService.analyticsHits.size > BlogExtrasService.RL_MEMORY_MAX_KEYS) {
        const first = BlogExtrasService.analyticsHits.keys().next().value;
        if (first === undefined) break;
        BlogExtrasService.analyticsHits.delete(first);
      }
    }
  }

  /** Redis-backed shared rate limit; bounded memory fallback. Throws 429 when exceeded. */
  async assertAnalyticsRateLimit(ip?: string) {
    const hash = this.ipHash(ip);
    const key = `blog:analytics:rl:${hash}`;
    if (this.redis.isReady) {
      const count = await this.redis.incrWithTtl(key, BlogExtrasService.RL_WINDOW_SEC);
      if (count !== null) {
        if (count > BlogExtrasService.RL_MAX) {
          throw new HttpException('تعداد درخواست‌های آمار زیاد است', HttpStatus.TOO_MANY_REQUESTS);
        }
        return;
      }
    }
    this.assertMemoryRateLimit(hash);
  }

  /**
   * Unique view = first view from this IP hash for this article within UV_TTL_SEC.
   * Server-derived via Redis SET NX; client headers are never trusted.
   * When Redis is unavailable, uniqueViews is not incremented (honest degrade).
   */
  private async claimUniqueView(articleId: string, ip?: string): Promise<boolean> {
    if (!this.redis.isReady) return false;
    const hash = this.ipHash(ip);
    const key = `blog:analytics:uv:${articleId}:${hash}`;
    return this.redis.setNxEx(key, BlogExtrasService.UV_TTL_SEC, '1');
  }

  private isUuid(id: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
  }

  /**
   * Atomic UPSERT/increment.
   * uniqueViews: server-derived (Redis NX per article+IP hash, 24h). Not client x-blog-uv.
   */
  async trackEvent(articleId: string, event: string, meta?: { ip?: string }) {
    if (!this.isUuid(articleId)) throw new BadRequestException('شناسه مطلب نامعتبر است');
    if (!BlogExtrasService.ANALYTICS_EVENTS.has(event)) {
      throw new BadRequestException('رویداد نامعتبر است');
    }
    await this.assertAnalyticsRateLimit(meta?.ip);

    const published = await this.postRepo.findOne({
      where: { id: articleId, status: 'PUBLISHED' },
      select: ['id'],
    });
    if (!published) throw new NotFoundException('مطلب یافت نشد');

    const colByEvent: Record<string, string> = {
      view: 'pageViews',
      scroll25: 'scroll25',
      scroll50: 'scroll50',
      scroll75: 'scroll75',
      scroll90: 'scroll90',
      cta: 'ctaClicks',
      product: 'productClicks',
      internal: 'internalLinkClicks',
    };
    const col = colByEvent[event];

    // Ensure row exists with all counters initialized (race-safe).
    await this.analyticsRepo.query(
      `
      INSERT INTO blog_analytics
        ("id", "articleId", "pageViews", "uniqueViews", "avgEngagementTime",
         "scroll25", "scroll50", "scroll75", "scroll90",
         "ctaClicks", "productClicks", "internalLinkClicks", "updatedAt")
      VALUES
        (gen_random_uuid(), $1, 0, 0, NULL, 0, 0, 0, 0, 0, 0, 0, NOW())
      ON CONFLICT ("articleId") DO NOTHING
      `,
      [articleId]
    );

    if (event === 'view') {
      const uv = (await this.claimUniqueView(articleId, meta?.ip)) ? 1 : 0;
      await this.analyticsRepo.query(
        `
        UPDATE blog_analytics
        SET "pageViews" = "pageViews" + 1,
            "uniqueViews" = "uniqueViews" + $2,
            "updatedAt" = NOW()
        WHERE "articleId" = $1
        `,
        [articleId, uv]
      );
    } else {
      await this.analyticsRepo.query(
        `
        UPDATE blog_analytics
        SET "${col}" = "${col}" + 1,
            "updatedAt" = NOW()
        WHERE "articleId" = $1
        `,
        [articleId]
      );
    }

    return this.analyticsRepo.findOne({ where: { articleId } });
  }

  async getAnalytics(articleId: string) {
    if (!this.isUuid(articleId)) throw new BadRequestException('شناسه مطلب نامعتبر است');
    let row = await this.analyticsRepo.findOne({ where: { articleId } });
    if (!row) {
      await this.analyticsRepo.query(
        `
        INSERT INTO blog_analytics
          ("id", "articleId", "pageViews", "uniqueViews", "avgEngagementTime",
           "scroll25", "scroll50", "scroll75", "scroll90",
           "ctaClicks", "productClicks", "internalLinkClicks", "updatedAt")
        VALUES
          (gen_random_uuid(), $1, 0, 0, NULL, 0, 0, 0, 0, 0, 0, 0, NOW())
        ON CONFLICT ("articleId") DO NOTHING
        `,
        [articleId]
      );
      row = await this.analyticsRepo.findOne({ where: { articleId } });
    }
    return row;
  }

  async analyticsSummary(channel?: string, limit = 30) {
    const take = Math.min(50, Math.max(1, Number(limit) || 30));
    const qb = this.analyticsRepo
      .createQueryBuilder('a')
      .innerJoin(BlogPostEntity, 'p', 'p.id = a.articleId')
      .orderBy('a.pageViews', 'DESC')
      .take(take)
      .select([
        'a.articleId AS "articleId"',
        'a.pageViews AS "pageViews"',
        'a.uniqueViews AS "uniqueViews"',
        'a.scroll25 AS scroll25',
        'a.scroll50 AS scroll50',
        'a.scroll75 AS scroll75',
        'a.scroll90 AS scroll90',
        'a.ctaClicks AS "ctaClicks"',
        'a.productClicks AS "productClicks"',
        'a.internalLinkClicks AS "internalLinkClicks"',
        'a.updatedAt AS "updatedAt"',
        'p.title AS title',
        'p.slug AS slug',
        'p.channel AS channel',
        'p.status AS status',
        'p.views AS views',
      ]);
    if (channel) qb.andWhere('p.channel = :channel', { channel: channel.toUpperCase() });
    const items = await qb.getRawMany();

    const totals = items.reduce(
      (acc, row) => {
        acc.pageViews += Number(row.pageViews) || 0;
        acc.uniqueViews += Number(row.uniqueViews) || 0;
        acc.ctaClicks += Number(row.ctaClicks) || 0;
        acc.productClicks += Number(row.productClicks) || 0;
        acc.scroll90 += Number(row.scroll90) || 0;
        return acc;
      },
      { pageViews: 0, uniqueViews: 0, ctaClicks: 0, productClicks: 0, scroll90: 0 }
    );

    return {
      channel: channel?.toUpperCase() || 'ALL',
      totals,
      items,
      integrations: {
        ga4: {
          note: 'رویدادهای view/scroll/cta از فرانت به API و در صورت فعال بودن Measurement ID به GA4 (gtag) هم ارسال می‌شوند.',
          propertyHint:
            channel?.toUpperCase() === 'RETAIL'
              ? 'marketing.ga4RetailId / NEXT_PUBLIC_GA4_RETAIL_ID'
              : 'marketing.ga4WholesaleId / NEXT_PUBLIC_GA4_WHOLESALE_ID',
        },
        gsc: {
          note: 'برای Click/Impression/CTR/Position باید Search Console API متصل شود؛ فعلاً فقط verification token در تنظیمات ذخیره می‌شود.',
          propertyHint:
            channel?.toUpperCase() === 'RETAIL'
              ? 'marketing.gscRetailVerification'
              : 'marketing.gscWholesaleVerification',
          metricsAvailable: false,
        },
      },
    };
  }

  async listPendingComments(channel?: string, limit = 50) {
    const qb = this.commentRepo
      .createQueryBuilder('c')
      .innerJoin(BlogPostEntity, 'p', 'p.id = c.articleId')
      .where("c.status = 'PENDING'")
      .orderBy('c.createdAt', 'DESC')
      .take(Math.min(100, limit))
      .select([
        'c.id AS id',
        'c.articleId AS "articleId"',
        'c.name AS name',
        'c.content AS content',
        'c.createdAt AS "createdAt"',
        'p.title AS "articleTitle"',
        'p.slug AS "articleSlug"',
        'p.channel AS channel',
      ]);
    if (channel) qb.andWhere('p.channel = :channel', { channel: channel.toUpperCase() });
    return qb.getRawMany();
  }

  async checkLinks(opts: { channel: string; content?: string; articleId?: string }) {
    const channel = opts.channel.toUpperCase() === 'RETAIL' ? 'RETAIL' : 'WHOLESALE';
    let html = opts.content || '';
    if (opts.articleId) {
      const post = await this.postRepo.findOne({ where: { id: opts.articleId } });
      if (post) html = post.content || html;
    }
    const hrefs = Array.from(html.matchAll(/href=["']([^"']+)["']/gi)).map((m) => m[1]);
    const internal = hrefs.filter((h) => h.startsWith('/blog/') || h.includes('/blog/'));
    const results: Array<{ href: string; ok: boolean; reason?: string }> = [];
    for (const href of internal.slice(0, 40)) {
      try {
        const path = href.replace(/^https?:\/\/[^/]+/i, '');
        const slug = path.replace(/^\/blog\//, '').split(/[?#]/)[0];
        if (!slug) {
          results.push({ href, ok: true });
          continue;
        }
        const found = await this.postRepo.findOne({
          where: { slug: decodeURIComponent(slug), channel, status: 'PUBLISHED' },
          select: ['id', 'robotsIndex'],
        });
        if (!found) results.push({ href, ok: false, reason: 'not_found' });
        else if (found.robotsIndex === false) results.push({ href, ok: false, reason: 'noindex' });
        else results.push({ href, ok: true });
      } catch {
        results.push({ href, ok: false, reason: 'error' });
      }
    }
    return {
      checked: results.length,
      broken: results.filter((r) => !r.ok),
      ok: results.filter((r) => r.ok),
    };
  }

  // ── Authors public ────────────────────────────────────────

  async getAuthorBySlug(slug: string) {
    const author = await this.authorRepo.findOne({ where: { slug, authorPageEnabled: true } });
    if (!author) throw new NotFoundException('نویسنده یافت نشد');
    const posts = await this.postRepo.find({
      where: { authorId: author.id, status: 'PUBLISHED' },
      order: { publishedAt: 'DESC' },
      take: 24,
    });
    return { author, posts };
  }
}
