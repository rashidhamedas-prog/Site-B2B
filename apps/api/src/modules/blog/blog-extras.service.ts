import { Injectable, NotFoundException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
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

type Actor = { id?: string; role?: string; blogRole?: string | null };

@Injectable()
export class BlogExtrasService {
  constructor(
    @InjectRepository(BlogPostEntity) private readonly postRepo: Repository<BlogPostEntity>,
    @InjectRepository(BlogArticleRevisionEntity) private readonly revRepo: Repository<BlogArticleRevisionEntity>,
    @InjectRepository(BlogMediaAssetEntity) private readonly mediaRepo: Repository<BlogMediaAssetEntity>,
    @InjectRepository(BlogCommentEntity) private readonly commentRepo: Repository<BlogCommentEntity>,
    @InjectRepository(BlogAnalyticsEntity) private readonly analyticsRepo: Repository<BlogAnalyticsEntity>,
    @InjectRepository(BlogAuthorEntity) private readonly authorRepo: Repository<BlogAuthorEntity>,
    @InjectRepository(ProductEntity) private readonly productRepo: Repository<ProductEntity>,
    private readonly storage: StorageService,
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
      }),
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
    actor?: Actor,
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
      }),
    );
    return { ...saved, duplicate: false };
  }

  async updateMedia(id: string, data: Partial<BlogMediaAssetEntity>) {
    const row = await this.mediaRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('رسانه یافت نشد');
    Object.assign(row, data);
    return this.mediaRepo.save(row);
  }

  async removeMedia(id: string) {
    const row = await this.mediaRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('رسانه یافت نشد');
    await this.storage.deleteByUrls([row.publicUrl]);
    await this.mediaRepo.delete(id);
    return { deleted: true };
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
    meta?: { ip?: string; userAgent?: string },
  ) {
    if (data.honeypot) return { ok: true }; // silently drop bots
    const post = await this.postRepo.findOne({ where: { id: articleId, status: 'PUBLISHED' } });
    if (!post) throw new NotFoundException('مطلب یافت نشد');
    if (post.commentsEnabled === false) throw new ForbiddenException('نظرات این مطلب غیرفعال است');

    const content = sanitizeBlogHtml(data.content).replace(/<[^>]+>/g, '').trim();
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
      }),
    );
  }

  async moderateComment(id: string, status: 'APPROVED' | 'REJECTED' | 'SPAM') {
    const row = await this.commentRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('نظر یافت نشد');
    row.status = status;
    return this.commentRepo.save(row);
  }

  // ── Analytics ─────────────────────────────────────────────

  async trackEvent(
    articleId: string,
    event: 'view' | 'scroll25' | 'scroll50' | 'scroll75' | 'scroll90' | 'cta' | 'product' | 'internal',
  ) {
    let row = await this.analyticsRepo.findOne({ where: { articleId } });
    if (!row) {
      row = this.analyticsRepo.create({ articleId });
    }
    if (event === 'view') {
      row.pageViews += 1;
      row.uniqueViews += 1;
    } else if (event === 'scroll25') row.scroll25 += 1;
    else if (event === 'scroll50') row.scroll50 += 1;
    else if (event === 'scroll75') row.scroll75 += 1;
    else if (event === 'scroll90') row.scroll90 += 1;
    else if (event === 'cta') row.ctaClicks += 1;
    else if (event === 'product') row.productClicks += 1;
    else if (event === 'internal') row.internalLinkClicks += 1;
    return this.analyticsRepo.save(row);
  }

  async getAnalytics(articleId: string) {
    let row = await this.analyticsRepo.findOne({ where: { articleId } });
    if (!row) {
      row = await this.analyticsRepo.save(this.analyticsRepo.create({ articleId }));
    }
    return row;
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
